import { Injectable, Logger } from '@nestjs/common';
import type { ErrorCategory, RunStage } from '@ai-chat/shared';

import { env } from '../../common/config/env';
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

interface RunFailureDetails {
  stage: RunStage;
  errorCategory: ErrorCategory;
  errorMessage: string;
}

@Injectable()
export class ScheduleRunnerService {
  private readonly logger = new Logger(ScheduleRunnerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chatService: ChatService,
    private readonly agentService: AgentService
  ) {}

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
        if (typeof timer === 'object' && typeof timer.unref === 'function') {
          timer.unref();
        }
      })
    ]);
  }

  async processDueSchedules(now = new Date()) {
    this.logger.debug('schedule_runner_scan_started', { now: now.toISOString() });

    const schedules = await this.prisma.schedule.findMany({
      where: {
        enabled: true,
        nextRunAt: { lte: now }
      },
      orderBy: { nextRunAt: 'asc' },
      take: 20
    });

    this.logger.debug('schedule_runner_scan_completed', { now: now.toISOString(), dueCount: schedules.length });

    for (const schedule of schedules) {
      await this.processSchedule(schedule, now);
    }
  }

  private async processSchedule(schedule: ScheduleRecord, now: Date) {
    this.logger.debug('schedule_runner_claim_started', {
      scheduleId: schedule.id,
      userId: schedule.userId,
      now: now.toISOString()
    });

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
      this.logger.warn('schedule_runner_claim_skipped', {
        scheduleId: schedule.id,
        userId: schedule.userId
      });
      return;
    }

    const run = await this.prisma.scheduleRun.create({
      data: {
        scheduleId: schedule.id,
        userId: schedule.userId,
        status: 'RUNNING',
        stage: 'AGENT',
        triggerSource: 'SCHEDULE',
        taskPromptSnapshot: schedule.taskPrompt,
        startedAt: now
      }
    });

    this.logger.log('schedule_runner_run_created', {
      scheduleId: schedule.id,
      runId: run.id,
      userId: schedule.userId,
      type: schedule.type
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
    this.logger.debug('schedule_runner_execution_started', {
      scheduleId: schedule.id,
      runId: run.id,
      userId: schedule.userId
    });

    const { session } = await this.chatService.createSessionWithFirstMessage(schedule.userId, schedule.taskPrompt);
    let assistantText = '';

    try {
      await this.withTimeout(
        (async () => {
          for await (const event of this.agentService.streamChatReply({
            userId: schedule.userId,
            sessionId: session.id,
            history: [],
            prompt: schedule.taskPrompt,
            forcedToolCall: this.buildForcedToolCall(schedule.taskPrompt),
            scheduleId: schedule.id,
            runId: run.id
          })) {
            if (event.type === 'text-delta') {
              assistantText += event.textDelta;
            }
          }
        })(),
        env.SCHEDULE_RUN_TIMEOUT_MS,
        `Schedule run (${schedule.id})`
      );

      await this.chatService.saveAssistantMessage(session.id, assistantText);
      await this.prisma.scheduleRun.update({
        where: { id: run.id },
        data: {
          status: 'SUCCEEDED',
          stage: 'COMPLETED',
          errorCategory: null,
          resultSummary: assistantText.slice(0, 280),
          chatSessionId: session.id,
          finishedAt: new Date()
        }
      });
      this.logger.log('schedule_runner_execution_succeeded', {
        scheduleId: schedule.id,
        runId: run.id,
        userId: schedule.userId,
        sessionId: session.id,
        resultSummaryLength: assistantText.slice(0, 280).length
      });
    } catch (error) {
      const failure = this.toRunFailureDetails(error);
      await this.prisma.scheduleRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          stage: failure.stage,
          errorCategory: failure.errorCategory,
          errorMessage: failure.errorMessage,
          chatSessionId: session.id,
          finishedAt: new Date()
        }
      });
      this.logger.warn('schedule_runner_execution_failed', {
        scheduleId: schedule.id,
        runId: run.id,
        userId: schedule.userId,
        sessionId: session.id,
        stage: failure.stage,
        errorCategory: failure.errorCategory,
        errorMessage: failure.errorMessage
      });
    }
  }

  private toRunFailureDetails(error: unknown): RunFailureDetails {
    if (
      typeof error === 'object' &&
      error !== null &&
      'stage' in error &&
      'errorCategory' in error &&
      'errorMessage' in error &&
      typeof error.stage === 'string' &&
      typeof error.errorCategory === 'string' &&
      typeof error.errorMessage === 'string'
    ) {
      return {
        stage: error.stage as RunStage,
        errorCategory: error.errorCategory as ErrorCategory,
        errorMessage: error.errorMessage
      };
    }

    if (error instanceof Error && /timeout$/i.test(error.message)) {
      return {
        stage: 'AGENT',
        errorCategory: 'EXTERNAL_ERROR',
        errorMessage: error.message
      };
    }

    return {
      stage: 'AGENT',
      errorCategory: 'INTERNAL_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Schedule run failed'
    };
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
