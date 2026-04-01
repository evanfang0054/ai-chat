import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { ToolExecution } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { env } from '../../common/config/env';
import type {
  ChatMessage,
  ChatRunStatusTimelineEntry,
  ChatSessionSummary,
  ChatTimelineEntry,
  GetChatTimelineResponse,
  ListChatSessionsResponse,
  RunSummary,
  ToolExecutionSummary
} from '@ai-chat/shared';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

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

    const formattedMessages = messages.map((message) => this.formatMessage(message));
    const formattedToolExecutions = toolExecutions.map((execution) => this.formatToolExecution(execution));
    const latestToolExecution = formattedToolExecutions.at(-1) ?? null;
    const run = this.buildRunSummary(session.id, latestToolExecution, formattedMessages.at(-1) ?? null);

    return {
      session: this.formatSessionSummary(session),
      run,
      messages: formattedMessages,
      toolExecutions: formattedToolExecutions,
      timeline: this.buildTimeline(formattedMessages, formattedToolExecutions, run)
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

  async createSessionWithFirstMessage(userId: string, content: string, runId?: string | null) {
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
        runId: runId ?? null,
        role: 'USER',
        content
      }
    });

    return { session, userMessage };
  }

  async addUserMessage(sessionId: string, content: string, runId?: string | null) {
    return await this.prisma.chatMessage.create({
      data: { sessionId, runId: runId ?? null, role: 'USER', content }
    });
  }

  async saveAssistantMessage(sessionId: string, content: string, runId?: string | null) {
    const message = await this.prisma.chatMessage.create({
      data: { sessionId, runId: runId ?? null, role: 'ASSISTANT', content }
    });

    await this.prisma.chatSession.update({
      where: { id: sessionId },
      data: { updatedAt: new Date() }
    });

    return message;
  }

  async finalizeAssistantReply(sessionId: string, assistantText: string, runId?: string | null) {
    const message = await this.saveAssistantMessage(sessionId, assistantText, runId ?? null);
    const session = await this.prisma.chatSession.findUniqueOrThrow({ where: { id: sessionId } });

    return {
      session: this.formatSessionSummary(session),
      message: this.formatMessage(message)
    };
  }

  private attachRunId<T extends { id: string; sessionId: string; role: 'USER' | 'ASSISTANT' | 'SYSTEM'; content: string; createdAt: Date }>(
    message: T,
    runId: string | null
  ) {
    return {
      ...message,
      runId
    };
  }

  private buildTimeline(messages: ChatMessage[], toolExecutions: ToolExecutionSummary[], run: RunSummary | null): ChatTimelineEntry[] {
    const messageEntries: ChatTimelineEntry[] = messages.map((message) => ({
      kind: 'message',
      id: `message-${message.id}`,
      sessionId: message.sessionId,
      runId: message.runId ?? null,
      messageId: message.id,
      createdAt: message.createdAt,
      message
    }));

    const toolEntries: ChatTimelineEntry[] = toolExecutions.map((toolExecution) => ({
      kind: 'tool_execution',
      id: `tool-${toolExecution.id}`,
      sessionId: toolExecution.sessionId,
      runId: toolExecution.runId,
      messageId: toolExecution.messageId,
      createdAt: toolExecution.startedAt ?? toolExecution.finishedAt ?? new Date(0).toISOString(),
      toolExecution
    }));

    const runEntries: ChatTimelineEntry[] = run
      ? [
          {
            kind: 'run_status',
            id: `run-${run.id}`,
            sessionId: run.sessionId ?? '',
            runId: run.id,
            messageId: run.messageId,
            createdAt: run.finishedAt ?? run.startedAt ?? new Date(0).toISOString(),
            run
          } satisfies ChatRunStatusTimelineEntry
        ]
      : [];

    return [...messageEntries, ...toolEntries, ...runEntries].sort((left, right) =>
      left.createdAt.localeCompare(right.createdAt)
    );
  }

  private buildRunSummary(
    sessionId: string,
    latestToolExecution: ToolExecutionSummary | null,
    latestMessage: ChatMessage | null
  ): RunSummary | null {
    if (!latestToolExecution && !latestMessage?.runId) {
      return null;
    }

    const status = latestToolExecution?.status === 'FAILED'
      ? 'FAILED'
      : latestToolExecution?.status === 'RUNNING' || latestToolExecution?.status === 'PENDING'
        ? 'RUNNING'
        : 'COMPLETED';
    const stage = latestToolExecution?.status === 'FAILED'
      ? 'TOOL_RUNNING'
      : latestToolExecution?.status === 'RUNNING' || latestToolExecution?.status === 'PENDING'
        ? 'TOOL_RUNNING'
        : 'FINALIZING';

    return {
      id: latestToolExecution?.runId ?? latestMessage?.runId ?? `session-${sessionId}`,
      sessionId,
      messageId: latestMessage?.id ?? latestToolExecution?.messageId ?? null,
      scheduleId: null,
      status,
      stage,
      triggerSource: 'USER',
      failureCategory: latestToolExecution?.errorCategory ?? null,
      failureCode: null,
      failureMessage: latestToolExecution?.errorMessage ?? null,
      startedAt: latestToolExecution?.startedAt ?? latestMessage?.createdAt ?? null,
      finishedAt: latestToolExecution?.finishedAt ?? (status === 'COMPLETED' ? latestMessage?.createdAt ?? null : null)
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

  formatMessage(message: { id: string; sessionId: string; runId?: string | null; role: 'USER' | 'ASSISTANT' | 'SYSTEM'; content: string; createdAt: Date | string }): ChatMessage {
    return {
      id: message.id,
      sessionId: message.sessionId,
      runId: message.runId ?? null,
      role: message.role,
      content: message.content,
      createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : message.createdAt
    };
  }

  formatToolExecution(execution: ToolExecution & { runId?: string | null; messageId?: string | null; progressMessage?: string | null; partialOutput?: string | null }): ToolExecutionSummary {
    const status = execution.status as 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

    return {
      id: execution.id,
      sessionId: execution.sessionId,
      runId: execution.runId ?? null,
      messageId: execution.messageId ?? null,
      toolName: execution.toolName as ToolExecutionSummary['toolName'],
      status,
      progressMessage: execution.progressMessage ?? (status === 'FAILED' ? 'Tool failed' : status === 'SUCCEEDED' ? 'Tool completed' : 'Tool running'),
      input: this.toNullableJsonString(execution.input),
      output: status === 'SUCCEEDED' ? this.toNullableJsonString(execution.output) : null,
      partialOutput: execution.partialOutput ?? null,
      errorCategory: status === 'FAILED' ? 'TOOL_ERROR' : null,
      errorMessage: execution.errorMessage,
      canRetry: status === 'FAILED',
      canCancel: status === 'PENDING' || status === 'RUNNING',
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
