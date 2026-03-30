import { Injectable } from '@nestjs/common';

import { ChatService } from '../chat/chat.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AgentService } from '../agent/agent.service';
import { computeNextRunAt } from './schedule.utils';

const FORCE_GET_CURRENT_TIME_PATTERNS = [/\bget_current_time\b/i, /当前时间/i, /current time/i];

interface ScheduleRecord {
  id: string;
  userId: string;
  title: string;
  taskPrompt: string;
  type: 'CRON' | 'ONE_TIME' | 'INTERVAL';
  cronExpr: string | null;
  intervalMs: number | null;
  runAt: Date | null;
  timezone: string;
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
}

interface ScheduleRunRecord {
  id: string;
}

@Injectable()
export class ScheduleRunnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly agentService: AgentService
  ) {}

  async processDueSchedules(now = new Date()) {
    const schedules = await this.prisma.schedule.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: now }
      },
      orderBy: { nextRunAt: 'asc' },
      take: 20
    });

    for (const schedule of schedules) {
      await this.processSchedule(schedule, now);
    }
  }

  private async processSchedule(schedule: ScheduleRecord, now: Date) {
    const claimed = await this.prisma.schedule.updateMany({
      where: {
        id: schedule.id,
        enabled: true,
        nextRunAt: schedule.nextRunAt
      },
      data: {
        lastRunAt: now,
        nextRunAt:
          schedule.type === 'ONE_TIME'
            ? null
            : computeNextRunAt({
                type: schedule.type,
                cronExpr: schedule.cronExpr,
                intervalMs: schedule.intervalMs,
                runAt: schedule.runAt?.toISOString() ?? null,
                timezone: schedule.timezone,
                now: schedule.type === 'INTERVAL' ? (schedule.nextRunAt ?? now) : now
              })
      }
    });

    if (claimed.count === 0) {
      return;
    }

    const run = await this.prisma.scheduleRun.create({
      data: {
        scheduleId: schedule.id,
        userId: schedule.userId,
        status: 'RUNNING',
        taskPromptSnapshot: schedule.taskPrompt,
        startedAt: now
      }
    });

    await this.executeRun(schedule, run);

    if (schedule.type === 'ONE_TIME') {
      await this.prisma.schedule.update({
        where: { id: schedule.id },
        data: { enabled: false, nextRunAt: null, lastRunAt: now }
      });
    }
  }

  private async executeRun(schedule: ScheduleRecord, run: ScheduleRunRecord) {
    const { session } = await this.chatService.createSessionWithFirstMessage(schedule.userId, schedule.taskPrompt);
    let assistantText = '';

    try {
      for await (const event of this.agentService.streamChatReply({
        userId: schedule.userId,
        sessionId: session.id,
        history: [],
        prompt: schedule.taskPrompt,
        forcedToolCall: this.buildForcedToolCall(schedule.taskPrompt)
      })) {
        if (event.type === 'text-delta') {
          assistantText += event.textDelta;
        }
      }

      await this.chatService.saveAssistantMessage(session.id, assistantText);
      await this.prisma.scheduleRun.update({
        where: { id: run.id },
        data: {
          status: 'SUCCEEDED',
          resultSummary: assistantText.slice(0, 280),
          chatSessionId: session.id,
          finishedAt: new Date()
        }
      });
    } catch (error) {
      await this.prisma.scheduleRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : 'Schedule run failed',
          chatSessionId: session.id,
          finishedAt: new Date()
        }
      });
    }
  }

  private buildForcedToolCall(taskPrompt: string) {
    if (!FORCE_GET_CURRENT_TIME_PATTERNS.some((pattern) => pattern.test(taskPrompt))) {
      return undefined;
    }

    return {
      name: 'get_current_time' as const,
      input: { timezone: 'UTC' }
    };
  }
}
