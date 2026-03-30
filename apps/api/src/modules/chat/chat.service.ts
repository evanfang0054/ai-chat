import { Injectable, NotFoundException } from '@nestjs/common';
import type { ToolExecution } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { env } from '../../common/config/env';
import type {
  ChatMessage,
  ChatSessionSummary,
  GetChatTimelineResponse,
  ListChatSessionsResponse,
  ToolExecutionSummary
} from '@ai-chat/shared';

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async listSessions(userId: string): Promise<ListChatSessionsResponse> {
    const sessions = await this.prisma.chatSession.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' }
    });

    return {
      sessions: sessions.map((session) => this.formatSessionSummary(session))
    };
  }

  async getSessionMessages(userId: string, sessionId: string): Promise<GetChatTimelineResponse> {
    return this.getSessionTimeline(userId, sessionId);
  }

  async getSessionTimeline(userId: string, sessionId: string): Promise<GetChatTimelineResponse> {
    const session = await this.getSessionOrThrow(userId, sessionId);
    const [messages, toolExecutions] = await Promise.all([
      this.prisma.chatMessage.findMany({
        where: { sessionId },
        orderBy: { createdAt: 'asc' }
      }),
      this.prisma.toolExecution.findMany({
        where: { sessionId },
        orderBy: { startedAt: 'asc' }
      })
    ]);

    return {
      session: this.formatSessionSummary(session),
      messages: messages.map((message) => this.formatMessage(message)),
      toolExecutions: toolExecutions.map((execution) => this.formatToolExecution(execution))
    };
  }

  async getSessionOrThrow(userId: string, sessionId: string) {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId }
    });

    if (!session) {
      throw new NotFoundException('Chat session not found');
    }

    return session;
  }

  async listMessages(userId: string, sessionId: string): Promise<{ messages: ChatMessage[] }> {
    const session = await this.prisma.chatSession.findFirst({
      where: { id: sessionId, userId },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!session) {
      throw new NotFoundException('Chat session not found');
    }

    return {
      messages: session.messages.map((message) => this.formatMessage(message))
    };
  }

  async createSessionWithFirstMessage(userId: string, content: string) {
    const session = await this.prisma.chatSession.create({
      data: {
        userId,
        title: this.buildTitleFromFirstMessage(content),
        model: this.getDefaultModel()
      }
    });

    const userMessage = await this.prisma.chatMessage.create({
      data: {
        sessionId: session.id,
        role: 'USER',
        content
      }
    });

    return { session, userMessage };
  }

  async addUserMessage(sessionId: string, content: string) {
    return this.prisma.chatMessage.create({
      data: { sessionId, role: 'USER', content }
    });
  }

  async saveAssistantMessage(sessionId: string, content: string) {
    const message = await this.prisma.chatMessage.create({
      data: { sessionId, role: 'ASSISTANT', content }
    });

    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() }
    });

    return message;
  }

  async finalizeAssistantReply(sessionId: string, assistantText: string) {
    const message = await this.saveAssistantMessage(sessionId, assistantText);
    const session = await this.prisma.chatSession.findUniqueOrThrow({ where: { id: sessionId } });

    return {
      session: this.formatSessionSummary(session),
      message: this.formatMessage(message)
    };
  }

  private buildTitleFromFirstMessage(content: string) {
    const trimmed = content.trim();
    if (trimmed.length <= 50) {
      return trimmed;
    }
    return trimmed.slice(0, 47) + '...';
  }

  private getDefaultModel() {
    return env.DEEPSEEK_MODEL;
  }

  formatSessionSummary(session: { id: string; title: string; model: string; createdAt: Date; updatedAt: Date }): ChatSessionSummary {
    return {
      id: session.id,
      title: session.title,
      model: session.model,
      createdAt: session.createdAt.toISOString(),
      updatedAt: session.updatedAt.toISOString()
    };
  }

  formatMessage(message: { id: string; sessionId: string; role: 'USER' | 'ASSISTANT' | 'SYSTEM'; content: string; createdAt: Date }): ChatMessage {
    return {
      id: message.id,
      sessionId: message.sessionId,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt.toISOString()
    };
  }

  formatToolExecution(execution: ToolExecution): ToolExecutionSummary {
    return {
      id: execution.id,
      sessionId: execution.sessionId,
      toolName: execution.toolName as ToolExecutionSummary['toolName'],
      status: execution.status,
      input: this.toNullableJsonString(execution.input),
      output: this.toNullableJsonString(execution.output),
      errorMessage: execution.errorMessage,
      startedAt: execution.startedAt.toISOString(),
      finishedAt: execution.finishedAt ? execution.finishedAt.toISOString() : null
    };
  }

  private toNullableJsonString(value: unknown) {
    if (value === null || value === undefined) {
      return null;
    }

    return typeof value === 'string' ? value : JSON.stringify(value);
  }
}
