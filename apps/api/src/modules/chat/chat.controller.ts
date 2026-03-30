import { formatDataStreamPart, pipeDataStreamToResponse } from 'ai';
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

    let session;
    let userMessage;

    if (dto.sessionId) {
      session = await this.chatService.getSessionOrThrow(user.userId, dto.sessionId);
      userMessage = await this.chatService.addUserMessage(session.id, content);
    } else {
      ({ session, userMessage } = await this.chatService.createSessionWithFirstMessage(user.userId, content));
    }

    const historyResult = await this.chatService.listMessages(user.userId, session.id);
    const history = historyResult.messages.slice(0, -1).map((message) => ({
      role: message.role,
      content: message.content
    }));
    const assistantMessageId = `assistant-${session.id}`;
    const sessionSummary = this.chatService.formatSessionSummary(session);
    const userMessageSummary = this.chatService.formatMessage(userMessage);

    pipeDataStreamToResponse(res, {
      status: 201,
      execute: async (writer) => {
        let assistantText = '';

        writer.writeData(
          this.toJsonValue({
            type: 'session-start',
            sessionId: sessionSummary.id,
            userMessageId: userMessageSummary.id,
            session: sessionSummary,
            message: userMessageSummary
          })
        );
        writer.write(formatDataStreamPart('start_step', { messageId: assistantMessageId }));

        for await (const event of this.agentService.streamChatReply({
          userId: user.userId,
          sessionId: session.id,
          history,
          prompt: content
        })) {
          if (event.type === 'text-delta') {
            assistantText += event.textDelta;
            writer.write(formatDataStreamPart('text', event.textDelta));
            continue;
          }

          if (event.type === 'tool-input-start') {
            const toolExecution = this.normalizeToolExecutionSessionId(event.toolExecution, session.id);
            writer.writeData(
              this.toJsonValue({
                type: 'tool-input-start',
                toolCallId: toolExecution.id,
                toolName: toolExecution.toolName,
                toolExecution
              })
            );
            continue;
          }

          if (event.type === 'tool-input-available') {
            const toolExecution = this.normalizeToolExecutionSessionId(event.toolExecution, session.id);
            writer.write(
              formatDataStreamPart('tool_call', {
                toolCallId: toolExecution.id,
                toolName: toolExecution.toolName,
                args: this.parseJsonString(toolExecution.input)
              })
            );
            writer.writeData(
              this.toJsonValue({
                type: 'tool-input-available',
                toolCallId: toolExecution.id,
                toolName: toolExecution.toolName,
                input: toolExecution.input,
                toolExecution
              })
            );
            continue;
          }

          if (event.type === 'tool-output-available') {
            const toolExecution = this.normalizeToolExecutionSessionId(event.toolExecution, session.id);
            writer.write(
              formatDataStreamPart('tool_result', {
                toolCallId: toolExecution.id,
                result: this.parseJsonString(toolExecution.output)
              })
            );
            writer.writeData(
              this.toJsonValue({
                type: 'tool-output-available',
                toolCallId: toolExecution.id,
                toolName: toolExecution.toolName,
                output: toolExecution.output,
                toolExecution
              })
            );
            continue;
          }

          if (event.type === 'tool-output-error') {
            const toolExecution = this.normalizeToolExecutionSessionId(event.toolExecution, session.id);
            writer.writeData(
              this.toJsonValue({
                type: 'tool-output-error',
                toolCallId: toolExecution.id,
                toolName: toolExecution.toolName,
                errorText: toolExecution.errorMessage,
                toolExecution
              })
            );
            throw new Error(toolExecution.errorMessage);
          }
        }

        const finalized = await this.chatService.finalizeAssistantReply(session.id, assistantText);
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
        writer.writeData(
          this.toJsonValue({
            type: 'session-finish',
            sessionId: finalized.session.id,
            assistantMessageId: finalized.message.id,
            session: finalized.session,
            message: finalized.message
          })
        );
      },
      onError: (error: unknown) => (error instanceof Error ? error.message : 'Chat stream failed')
    });
  }
}
