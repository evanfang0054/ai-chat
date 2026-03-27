import { Injectable } from '@nestjs/common';

import { ChatService } from '../chat/chat.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AgentService } from '../agent/agent.service';
import { computeNextRunAt } from './schedule.utils';

interface ScheduleRecord {
  id: string;
  userId: string;
  title: string;
  taskPrompt: string;
  type: 'CRON' | 'ONE_TIME';
  cronExpr: string | null;
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
                runAt: schedule.runAt?.toISOString() ?? null,
                timezone: schedule.timezone,
                now
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
        prompt: schedule.taskPrompt
      })) {
        if (event.type === 'text_delta') {
          assistantText += event.delta;
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
}
