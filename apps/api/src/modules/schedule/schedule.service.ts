import { BadRequestException, Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import type {
  CreateScheduleRequest,
  ListScheduleRunsResponse,
  ListSchedulesResponse,
  RetryScheduleRunResponse,
  ScheduleRunStatus,
  ScheduleRunSummary,
  UpdateScheduleRequest
} from '@ai-chat/shared';

import { PrismaService } from '../../common/prisma/prisma.service';
import { ScheduleRunnerService } from './schedule-runner.service';
import type { ScheduleFilters, ScheduleRunFilters, ScheduleSummaryLike } from './schedule.types';
import { computeNextRunAt, toScheduleSummary, validateScheduleInput } from './schedule.utils';

@Injectable()
export class ScheduleService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(forwardRef(() => ScheduleRunnerService)) private readonly scheduleRunnerService: ScheduleRunnerService
  ) {}

  async createSchedule(userId: string, input: CreateScheduleRequest) {
    validateScheduleInput(input);

    const timezone = input.timezone ?? 'UTC';
    const nextRunAt = computeNextRunAt({
      type: input.type,
      cronExpr: input.type === 'CRON' ? input.cronExpr : undefined,
      intervalMs: input.type === 'INTERVAL' ? input.intervalMs : undefined,
      runAt: input.type === 'ONE_TIME' ? input.runAt : undefined,
      timezone
    });

    const schedule = await this.prisma.schedule.create({
      data: {
        userId,
        title: input.title,
        taskPrompt: input.taskPrompt,
        type: input.type,
        cronExpr: input.type === 'CRON' ? input.cronExpr : null,
        intervalMs: input.type === 'INTERVAL' ? input.intervalMs : null,
        runAt: input.type === 'ONE_TIME' ? new Date(input.runAt) : null,
        timezone,
        enabled: true,
        nextRunAt
      }
    });

    return toScheduleSummary(this.toScheduleSummaryLike(this.withLatestRunSummary(schedule)));
  }

  async listSchedules(userId: string, filters: ScheduleFilters = {}): Promise<ListSchedulesResponse> {
    const schedules = await this.prisma.schedule.findMany({
      where: {
        userId,
        ...(filters.enabled === undefined ? {} : { enabled: filters.enabled }),
        ...(filters.type ? { type: filters.type } : {})
      },
      orderBy: { createdAt: 'desc' }
    });

    return {
      schedules: schedules.map((schedule) =>
        toScheduleSummary(this.toScheduleSummaryLike(this.withLatestRunSummary(schedule)))
      )
    };
  }

  async getScheduleOrThrow(userId: string, scheduleId: string) {
    const schedule = await this.prisma.schedule.findFirst({
      where: { id: scheduleId, userId }
    });

    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    return schedule;
  }

  async updateSchedule(userId: string, scheduleId: string, input: UpdateScheduleRequest) {
    const existing = await this.getScheduleOrThrow(userId, scheduleId);
    const nextType = input.type ?? existing.type;

    if (!input.type) {
      if (input.cronExpr && input.runAt) {
        throw new BadRequestException('cronExpr and runAt cannot be updated together without type');
      }
      if (input.cronExpr && input.intervalMs) {
        throw new BadRequestException('cronExpr and intervalMs cannot be updated together without type');
      }
      if (input.runAt && input.intervalMs) {
        throw new BadRequestException('runAt and intervalMs cannot be updated together without type');
      }

      if (existing.type === 'CRON' && input.runAt) {
        throw new BadRequestException('runAt is not allowed for CRON schedules');
      }
      if (existing.type === 'CRON' && input.intervalMs) {
        throw new BadRequestException('intervalMs is not allowed for CRON schedules');
      }

      if (existing.type === 'ONE_TIME' && input.cronExpr) {
        throw new BadRequestException('cronExpr is not allowed for ONE_TIME schedules');
      }
      if (existing.type === 'ONE_TIME' && input.intervalMs) {
        throw new BadRequestException('intervalMs is not allowed for ONE_TIME schedules');
      }

      if (existing.type === 'INTERVAL' && input.cronExpr) {
        throw new BadRequestException('cronExpr is not allowed for INTERVAL schedules');
      }
      if (existing.type === 'INTERVAL' && input.runAt) {
        throw new BadRequestException('runAt is not allowed for INTERVAL schedules');
      }
    }

    const merged = {
      title: input.title ?? existing.title,
      taskPrompt: input.taskPrompt ?? existing.taskPrompt,
      type: nextType,
      cronExpr:
        nextType === 'CRON'
          ? input.cronExpr ?? existing.cronExpr ?? undefined
          : undefined,
      intervalMs:
        nextType === 'INTERVAL'
          ? input.intervalMs ?? existing.intervalMs ?? undefined
          : undefined,
      runAt:
        nextType === 'ONE_TIME'
          ? input.runAt ?? existing.runAt?.toISOString() ?? undefined
          : undefined,
      timezone: input.timezone ?? existing.timezone,
      enabled: input.enabled ?? existing.enabled
    } as const;

    validateScheduleInput({
      type: merged.type,
      cronExpr: merged.cronExpr,
      intervalMs: merged.intervalMs,
      runAt: merged.runAt
    });

    const nextRunAt = merged.enabled
      ? computeNextRunAt({
          type: merged.type,
          cronExpr: merged.cronExpr,
          intervalMs: merged.intervalMs,
          runAt: merged.runAt,
          timezone: merged.timezone
        })
      : null;

    const schedule = await this.prisma.schedule.update({
      where: { id: existing.id },
      data: {
        title: merged.title,
        taskPrompt: merged.taskPrompt,
        type: merged.type,
        cronExpr: merged.type === 'CRON' ? merged.cronExpr ?? null : null,
        intervalMs: merged.type === 'INTERVAL' ? merged.intervalMs ?? null : null,
        runAt: merged.type === 'ONE_TIME' && merged.runAt ? new Date(merged.runAt) : null,
        timezone: merged.timezone,
        enabled: merged.enabled,
        nextRunAt
      }
    });

    return toScheduleSummary(this.toScheduleSummaryLike(this.withLatestRunSummary(schedule)));
  }

  async enableSchedule(userId: string, scheduleId: string) {
    const schedule = await this.getScheduleOrThrow(userId, scheduleId);
    const nextRunAt = computeNextRunAt({
      type: schedule.type,
      cronExpr: schedule.cronExpr,
      intervalMs: schedule.intervalMs,
      runAt: schedule.runAt?.toISOString(),
      timezone: schedule.timezone
    });

    const updated = await this.prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        enabled: true,
        nextRunAt
      }
    });

    return toScheduleSummary(this.toScheduleSummaryLike(this.withLatestRunSummary(updated)));
  }

  async disableSchedule(userId: string, scheduleId: string) {
    const schedule = await this.getScheduleOrThrow(userId, scheduleId);
    const updated = await this.prisma.schedule.update({
      where: { id: schedule.id },
      data: {
        enabled: false,
        nextRunAt: null
      }
    });

    return toScheduleSummary(this.toScheduleSummaryLike(this.withLatestRunSummary(updated)));
  }

  async deleteSchedule(userId: string, scheduleId: string) {
    const schedule = await this.getScheduleOrThrow(userId, scheduleId);
    await this.prisma.schedule.delete({
      where: { id: schedule.id }
    });
  }

  async listRuns(userId: string, filters: ScheduleRunFilters = {}): Promise<ListScheduleRunsResponse> {
    const runs = await this.prisma.scheduleRun.findMany({
      where: {
        userId,
        ...(filters.scheduleId ? { scheduleId: filters.scheduleId } : {}),
        ...(filters.status ? { status: filters.status } : {})
      },
      include: {
        schedule: true,
        chatSession: {
          include: {
            toolExecutions: {
              select: {
                id: true
              }
            },
            messages: {
              where: {
                runId: { not: null }
              },
              select: {
                id: true,
                runId: true,
                createdAt: true
              },
              orderBy: {
                createdAt: 'asc'
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    return {
      runs: runs.map((run) => this.toRunSummary(run))
    };
  }

  async getRunOrThrow(userId: string, runId: string) {
    const run = await this.prisma.scheduleRun.findFirst({
      where: { id: runId, userId },
      include: {
        schedule: true,
        chatSession: {
          include: {
            toolExecutions: {
              select: {
                id: true
              }
            },
            messages: {
              where: {
                runId: { not: null }
              },
              select: {
                id: true,
                runId: true,
                createdAt: true
              },
              orderBy: {
                createdAt: 'asc'
              }
            }
          }
        }
      }
    });

    if (!run) {
      throw new NotFoundException('Schedule run not found');
    }

    return this.toRunSummary(run);
  }

  async retryRun(runId: string, userId: string): Promise<RetryScheduleRunResponse> {
    const run = await this.prisma.scheduleRun.findFirst({
      where: { id: runId, userId },
      include: {
        schedule: true,
        chatSession: {
          include: {
            toolExecutions: {
              select: {
                id: true
              }
            },
            messages: {
              where: {
                runId: { not: null }
              },
              select: {
                id: true,
                runId: true,
                createdAt: true
              },
              orderBy: {
                createdAt: 'asc'
              }
            }
          }
        }
      }
    });

    if (!run) {
      throw new NotFoundException('Schedule run not found');
    }

    const schedule = await this.getScheduleOrThrow(userId, run.scheduleId);
    const rerunRequestId = `${run.requestId ?? run.id}-retry-${Date.now()}`;
    const rerun = await this.prisma.scheduleRun.create({
      data: {
        scheduleId: run.scheduleId,
        userId,
        requestId: rerunRequestId,
        status: 'PENDING',
        stage: 'PREPARING',
        triggerSource: 'MANUAL_RETRY',
        taskPromptSnapshot: run.taskPromptSnapshot
      },
      include: {
        schedule: true,
        chatSession: {
          include: {
            toolExecutions: {
              select: {
                id: true
              }
            },
            messages: {
              where: {
                runId: { not: null }
              },
              select: {
                id: true,
                runId: true,
                createdAt: true
              },
              orderBy: {
                createdAt: 'asc'
              }
            }
          }
        }
      }
    });

    void this.scheduleRunnerService.triggerRun({
      schedule: {
        id: schedule.id,
        userId: schedule.userId,
        title: schedule.title,
        taskPrompt: rerun.taskPromptSnapshot,
        type: schedule.type,
        cronExpr: schedule.cronExpr,
        intervalMs: schedule.intervalMs,
        runAt: schedule.runAt,
        timezone: schedule.timezone,
        enabled: schedule.enabled,
        lastRunAt: schedule.lastRunAt,
        nextRunAt: schedule.nextRunAt
      },
      run: {
        id: rerun.id,
        requestId: rerun.requestId
      },
      triggerSource: 'MANUAL_RETRY'
    });

    return {
      run: this.toRunSummary(rerun)
    };
  }

  private toRunSummary(run: {
    id: string;
    scheduleId: string;
    userId: string;
    requestId: string | null;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    stage:
      | 'PREPARING'
      | 'ROUTING'
      | 'MODEL_CALLING'
      | 'TOOL_RUNNING'
      | 'REPAIRING'
      | 'PERSISTING'
      | 'FINALIZING';
    errorCategory:
      | 'INPUT_ERROR'
      | 'TOOL_ERROR'
      | 'MODEL_ERROR'
      | 'DEPENDENCY_ERROR'
      | 'TIMEOUT_ERROR'
      | 'SYSTEM_ERROR'
      | 'CANCELLED'
      | null;
    triggerSource: 'USER' | 'SCHEDULE' | 'MANUAL_RETRY' | 'DIAGNOSTICS_REPLAY';
    taskPromptSnapshot: string;
    resultSummary: string | null;
    errorMessage: string | null;
    chatSessionId: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    createdAt: Date;
    chatSession?: {
      toolExecutions: Array<{
        id: string;
      }>;
      messages: Array<{
        id: string;
        runId: string | null;
        createdAt: Date;
      }>;
    } | null;
    schedule: {
      id: string;
      title: string;
      type: 'CRON' | 'ONE_TIME' | 'INTERVAL';
    };
  }): ScheduleRunSummary {
    const toolExecutionCount = run.chatSession?.toolExecutions.length ?? 0;
    const durationMs = run.startedAt && run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null;
    const messageId = run.chatSession?.messages.find((message) => message.runId === run.id)?.id ?? null;

    return {
      id: run.id,
      sessionId: run.chatSessionId,
      messageId,
      scheduleId: run.scheduleId,
      userId: run.userId,
      status: run.status,
      stage: run.stage,
      triggerSource: run.triggerSource,
      failureCategory: run.errorCategory,
      failureCode: null,
      failureMessage: run.errorMessage,
      requestId: run.requestId,
      durationMs,
      toolExecutionCount,
      retryCount: 0,
      lastRepairAction: null,
      taskPromptSnapshot: run.taskPromptSnapshot,
      chatSessionId: run.chatSessionId,
      scheduleTitle: run.schedule.title,
      resultSummary: run.resultSummary,
      createdAt: run.createdAt.toISOString(),
      startedAt: run.startedAt?.toISOString() ?? null,
      finishedAt: run.finishedAt?.toISOString() ?? null,
      schedule: {
        id: run.schedule.id,
        title: run.schedule.title,
        type: run.schedule.type
      }
    };
  }

  private withLatestRunSummary(schedule: {
    id: string;
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
    createdAt: Date;
    updatedAt: Date;
    latestRunId?: string | null;
    latestRunStatus?: ScheduleRunStatus | null;
    latestRunStage?:
      | 'PREPARING'
      | 'ROUTING'
      | 'MODEL_CALLING'
      | 'TOOL_RUNNING'
      | 'REPAIRING'
      | 'PERSISTING'
      | 'FINALIZING'
      | null;
    latestRunStartedAt?: Date | null;
    latestRunFinishedAt?: Date | null;
    latestRequestId?: string | null;
    latestSessionId?: string | null;
    latestMessageId?: string | null;
    latestToolExecutionCount?: number | null;
    latestFailureMessage?: string | null;
    latestResultSummary?: string | null;
  }) {
    return {
      ...schedule,
      latestRunId: schedule.latestRunId ?? null,
      latestRunStatus: schedule.latestRunStatus ?? null,
      latestRunStage: schedule.latestRunStage ?? null,
      latestRunStartedAt: schedule.latestRunStartedAt ?? null,
      latestRunFinishedAt: schedule.latestRunFinishedAt ?? null,
      latestRequestId: schedule.latestRequestId ?? null,
      latestSessionId: schedule.latestSessionId ?? null,
      latestMessageId: schedule.latestMessageId ?? null,
      latestToolExecutionCount: schedule.latestToolExecutionCount ?? 0,
      latestFailureMessage: schedule.latestFailureMessage ?? null,
      latestResultSummary: schedule.latestResultSummary ?? null
    };
  }

  private toScheduleSummaryLike(schedule: {
    id: string;
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
    latestRunId: string | null;
    latestRunStatus: ScheduleRunStatus | null;
    latestRunStage:
      | 'PREPARING'
      | 'ROUTING'
      | 'MODEL_CALLING'
      | 'TOOL_RUNNING'
      | 'REPAIRING'
      | 'PERSISTING'
      | 'FINALIZING'
      | null;
    latestRunStartedAt: Date | null;
    latestRunFinishedAt: Date | null;
    latestRequestId: string | null;
    latestSessionId: string | null;
    latestMessageId: string | null;
    latestToolExecutionCount: number;
    latestFailureMessage: string | null;
    latestResultSummary: string | null;
    createdAt: Date;
    updatedAt: Date;
  }): ScheduleSummaryLike {
    if (schedule.type === 'CRON') {
      if (!schedule.cronExpr) {
        throw new Error('CRON schedule is missing cronExpr');
      }

      return {
        id: schedule.id,
        title: schedule.title,
        taskPrompt: schedule.taskPrompt,
        type: 'CRON',
        cronExpr: schedule.cronExpr,
        intervalMs: null,
        runAt: null,
        timezone: schedule.timezone,
        enabled: schedule.enabled,
        lastRunAt: schedule.lastRunAt,
        nextRunAt: schedule.nextRunAt,
        latestRunId: schedule.latestRunId,
        latestRunStatus: schedule.latestRunStatus,
        latestRunStage: schedule.latestRunStage,
        latestRunStartedAt: schedule.latestRunStartedAt,
        latestRunFinishedAt: schedule.latestRunFinishedAt,
        latestRequestId: schedule.latestRequestId,
        latestSessionId: schedule.latestSessionId,
        latestMessageId: schedule.latestMessageId,
        latestToolExecutionCount: schedule.latestToolExecutionCount,
        latestFailureMessage: schedule.latestFailureMessage,
        latestResultSummary: schedule.latestResultSummary,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt
      };
    }

    if (schedule.type === 'INTERVAL') {
      if (!schedule.intervalMs) {
        throw new Error('INTERVAL schedule is missing intervalMs');
      }

      return {
        id: schedule.id,
        title: schedule.title,
        taskPrompt: schedule.taskPrompt,
        type: 'INTERVAL',
        cronExpr: null,
        intervalMs: schedule.intervalMs,
        runAt: null,
        timezone: schedule.timezone,
        enabled: schedule.enabled,
        lastRunAt: schedule.lastRunAt,
        nextRunAt: schedule.nextRunAt,
        latestRunId: schedule.latestRunId,
        latestRunStatus: schedule.latestRunStatus,
        latestRunStage: schedule.latestRunStage,
        latestRunStartedAt: schedule.latestRunStartedAt,
        latestRunFinishedAt: schedule.latestRunFinishedAt,
        latestRequestId: schedule.latestRequestId,
        latestSessionId: schedule.latestSessionId,
        latestMessageId: schedule.latestMessageId,
        latestToolExecutionCount: schedule.latestToolExecutionCount,
        latestFailureMessage: schedule.latestFailureMessage,
        latestResultSummary: schedule.latestResultSummary,
        createdAt: schedule.createdAt,
        updatedAt: schedule.updatedAt
      };
    }

    if (!schedule.runAt) {
      throw new Error('ONE_TIME schedule is missing runAt');
    }

    return {
      id: schedule.id,
      title: schedule.title,
      taskPrompt: schedule.taskPrompt,
      type: 'ONE_TIME',
      cronExpr: null,
      intervalMs: null,
      runAt: schedule.runAt,
      timezone: schedule.timezone,
      enabled: schedule.enabled,
      lastRunAt: schedule.lastRunAt,
      nextRunAt: schedule.nextRunAt,
      latestRunId: schedule.latestRunId,
      latestRunStatus: schedule.latestRunStatus,
      latestRunStage: schedule.latestRunStage,
      latestRunStartedAt: schedule.latestRunStartedAt,
      latestRunFinishedAt: schedule.latestRunFinishedAt,
      latestRequestId: schedule.latestRequestId,
      latestSessionId: schedule.latestSessionId,
      latestMessageId: schedule.latestMessageId,
      latestToolExecutionCount: schedule.latestToolExecutionCount,
      latestFailureMessage: schedule.latestFailureMessage,
      latestResultSummary: schedule.latestResultSummary,
      createdAt: schedule.createdAt,
      updatedAt: schedule.updatedAt
    };
  }
}
