import { randomUUID } from 'node:crypto';
import { formatDataStreamPart, pipeDataStreamToResponse } from 'ai';
import type { ChatRunEvent, RunSummary } from '@ai-chat/shared';
import type { JSONValue } from 'ai';
import { BadRequestException, Body, Controller, Get, Param, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ChatService } from './chat.service';
import { AgentService } from '../agent/agent.service';
import { CreateChatMessageDto } from './dto/create-chat-message.dto';
import type { CurrentUser as CurrentUserPayload } from './chat.types';

@Controller('chat')
@UseGuards(JwtAuthGuard)
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly agentService: AgentService
  ) {}

  private normalizeToolExecutionSessionId<T extends { sessionId: string }>(toolExecution: T, sessionId: string): T {
    return {
      ...toolExecution,
      sessionId
    };
  }

  private parseJsonString(value: string | null) {
    if (!value) {
      return {};
    }

    try {
      return JSON.parse(value) as Record<string, unknown>;
    } catch {
      return { value };
    }
  }

  private toJsonValue<T>(value: T): JSONValue {
    return JSON.parse(JSON.stringify(value)) as JSONValue;
  }

  private toRunEventData(event: ChatRunEvent) {
    return this.toJsonValue(event);
  }

  private writeRunEvent(
    writer: Parameters<Parameters<typeof pipeDataStreamToResponse>[1]['execute']>[0],
    event: ChatRunEvent,
    sessionId: string
  ) {
    writer.writeData(this.toRunEventData(event));

    if (event.type === 'text_delta') {
      writer.write(formatDataStreamPart('text', event.textDelta));
      return;
    }

    if (event.type === 'tool_started' || event.type === 'tool_progressed') {
      const toolExecution = this.normalizeToolExecutionSessionId(event.toolExecution, sessionId);
      writer.write(
        formatDataStreamPart('tool_call', {
          toolCallId: toolExecution.id,
          toolName: toolExecution.toolName,
          args: this.parseJsonString(toolExecution.input)
        })
      );
      return;
    }

    if (event.type === 'tool_completed') {
      const toolExecution = this.normalizeToolExecutionSessionId(event.toolExecution, sessionId);
      writer.write(
        formatDataStreamPart('tool_result', {
          toolCallId: toolExecution.id,
          result: this.parseJsonString(toolExecution.output)
        })
      );
    }
  }

  @Get('sessions')
  listSessions(@CurrentUser() user: CurrentUserPayload) {
    return this.chatService.listSessions(user.userId);
  }

  @Get('sessions/:sessionId/messages')
  getSessionMessages(@CurrentUser() user: CurrentUserPayload, @Param('sessionId') sessionId: string) {
    return this.chatService.getSessionMessages(user.userId, sessionId);
  }

  @Post('stream')
  async streamChat(
    @CurrentUser() user: CurrentUserPayload,
    @Body() dto: CreateChatMessageDto,
    @Res() res: Response
  ) {
    const content = dto.content.trim();
    if (!content) {
      throw new BadRequestException('Message content is required');
    }

    const runId = randomUUID();
    const assistantMessageId = `assistant-${runId}`;
    let session;
    let userMessage;

    if (dto.sessionId) {
      session = await this.chatService.getSessionOrThrow(user.userId, dto.sessionId);
      userMessage = await this.chatService.addUserMessage(session.id, content, runId);
    } else {
      ({ session, userMessage } = await this.chatService.createSessionWithFirstMessage(user.userId, content, runId));
    }

    const historyResult = await this.chatService.listMessages(user.userId, session.id);
    const history = historyResult.messages.slice(0, -1).map((message) => ({
      role: message.role,
      content: message.content
    }));
    const sessionSummary = this.chatService.formatSessionSummary(session);
    const userMessageSummary = this.chatService.formatMessage(userMessage);

    pipeDataStreamToResponse(res, {
      status: 201,
      execute: async (writer) => {
        const initialRun: RunSummary = {
          id: runId,
          sessionId: session.id,
          messageId: userMessageSummary.id,
          scheduleId: null,
          status: 'RUNNING',
          stage: 'PREPARING',
          triggerSource: 'USER',
          failureCategory: null,
          failureCode: null,
          failureMessage: null,
          startedAt: null,
          finishedAt: null
        };

        writer.write(formatDataStreamPart('start_step', { messageId: assistantMessageId }));
        this.writeRunEvent(
          writer,
          {
            type: 'run_started',
            run: initialRun,
            session: sessionSummary,
            message: userMessageSummary
          },
          session.id
        );

        try {
          const result = await this.agentService.execute(
            {
              userId: user.userId,
              sessionId: session.id,
              messageId: assistantMessageId,
              runId,
              triggerSource: 'USER',
              history,
              prompt: content
            },
            (event) => {
              this.writeRunEvent(writer, event, session.id);
            }
          );

          const finalized = await this.chatService.finalizeAssistantReply(session.id, result.text, runId);
          this.writeRunEvent(
            writer,
            {
              type: 'run_completed',
              run: result.run,
              message: finalized.message
            },
            session.id
          );
          writer.write(
            formatDataStreamPart('finish_step', {
              isContinued: false,
              finishReason: 'stop'
            })
          );
          writer.write(
            formatDataStreamPart('finish_message', {
              finishReason: 'stop'
            })
          );
        } catch (error) {
          const failedRun: RunSummary = {
            ...initialRun,
            status: 'FAILED',
            stage: 'FINALIZING',
            failureCategory: 'SYSTEM_ERROR',
            failureMessage: error instanceof Error ? error.message : 'Chat stream failed'
          };
          this.writeRunEvent(
            writer,
            {
              type: 'run_failed',
              run: failedRun
            },
            session.id
          );
          throw error;
        }
      },
      onError: (error: unknown) => (error instanceof Error ? error.message : 'Chat stream failed')
    });
  }
}
