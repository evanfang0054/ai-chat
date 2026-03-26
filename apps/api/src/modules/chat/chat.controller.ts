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
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

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

    res.write(
      `event: message\ndata: ${JSON.stringify({
        type: 'run_started',
        session: this.chatService.formatSessionSummary(session),
        userMessage: this.chatService.formatMessage(userMessage)
      })}\n\n`
    );

    const historyResult = await this.chatService.listMessages(user.userId, session.id);
    const history = historyResult.messages.slice(0, -1).map((message) => ({
      role: message.role,
      content: message.content
    }));
    let assistantText = '';

    try {
      for await (const event of this.agentService.streamChatReply({ history, prompt: content })) {
        if (event.type === 'text_delta') {
          assistantText += event.delta;
          res.write(`event: message\ndata: ${JSON.stringify(event)}\n\n`);
        }
      }

      const assistantMessage = await this.chatService.saveAssistantMessage(session.id, assistantText);
      const refreshedSession = await this.chatService.getSessionOrThrow(user.userId, session.id);
      res.write(
        `event: message\ndata: ${JSON.stringify({
          type: 'run_completed',
          session: this.chatService.formatSessionSummary(refreshedSession),
          message: this.chatService.formatMessage(assistantMessage)
        })}\n\n`
      );
      res.end();
    } catch {
      res.write(`event: message\ndata: ${JSON.stringify({ type: 'run_failed', message: 'Chat stream failed' })}\n\n`);
      res.end();
    }
  }
}
