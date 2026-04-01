process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_chat';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'change-me';
process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-key';
process.env.DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
process.env.DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

import { NotFoundException } from '@nestjs/common';
import { validate } from 'class-validator';

import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleService } from './schedule.service';
import { computeNextRunAt, toScheduleSummary, validateScheduleInput } from './schedule.utils';

describe('schedule utils', () => {
  it('accepts one-time with runAt only', () => {
    expect(() =>
      validateScheduleInput({
        type: 'ONE_TIME',
        runAt: new Date('2026-03-28T09:00:00.000Z').toISOString()
      })
    ).not.toThrow();
  });

  it('rejects cron without cronExpr', () => {
    expect(() => validateScheduleInput({ type: 'CRON' })).toThrow(
      'cronExpr is required for CRON schedules'
    );
  });

  it('rejects one-time with cronExpr', () => {
    expect(() =>
      validateScheduleInput({
        type: 'ONE_TIME',
        runAt: '2026-03-28T09:00:00.000Z',
        cronExpr: '0 9 * * *'
      })
    ).toThrow('cronExpr is not allowed for ONE_TIME schedules');
  });

  it('rejects cron with runAt', () => {
    expect(() =>
      validateScheduleInput({
        type: 'CRON',
        cronExpr: '0 9 * * *',
        runAt: '2026-03-28T09:00:00.000Z'
      })
    ).toThrow('runAt is not allowed for CRON schedules');
  });

  it('returns runAt for one-time nextRunAt', () => {
    const runAt = '2026-03-28T09:00:00.000Z';

    expect(
      computeNextRunAt({
        type: 'ONE_TIME',
        runAt,
        timezone: 'UTC'
      })?.toISOString()
    ).toBe(runAt);
  });

  it('computes next runAt for valid cron expression', () => {
    expect(
      computeNextRunAt({
        type: 'CRON',
        cronExpr: '0 9 * * *',
        timezone: 'UTC',
        now: new Date('2026-03-27T08:30:00.000Z')
      })?.toISOString()
    ).toBe('2026-03-27T09:00:00.000Z');
  });

  it('rejects cron without cronExpr in nextRunAt computation', () => {
    expect(() =>
      computeNextRunAt({
        type: 'CRON',
        timezone: 'UTC'
      })
    ).toThrow('cronExpr is required for CRON schedules');
  });

  it('rejects invalid cron expression', () => {
    expect(() =>
      computeNextRunAt({
        type: 'CRON',
        cronExpr: 'not-a-cron',
        timezone: 'UTC'
      })
    ).toThrow('Invalid cron expression');
  });

  it('rejects invalid timezone', () => {
    expect(() =>
      computeNextRunAt({
        type: 'CRON',
        cronExpr: '0 9 * * *',
        timezone: 'Mars/Base'
      })
    ).toThrow('Invalid timezone');
  });

  it('maps cron schedule to summary', () => {
    expect(
      toScheduleSummary({
        id: 'schedule-1',
        title: 'Daily digest',
        taskPrompt: 'Summarize updates',
        type: 'CRON',
        cronExpr: '0 9 * * *',
        intervalMs: null,
        runAt: null,
        timezone: 'UTC',
        enabled: true,
        lastRunAt: new Date('2026-03-27T08:00:00.000Z'),
        nextRunAt: new Date('2026-03-28T09:00:00.000Z'),
        latestRunId: 'run-1',
        latestRunStatus: 'FAILED',
        latestRunStage: 'FINALIZING',
        latestRunStartedAt: new Date('2026-03-27T08:00:00.000Z'),
        latestRunFinishedAt: new Date('2026-03-27T08:02:00.000Z'),
        latestRequestId: 'request-1',
        latestSessionId: 'session-1',
        latestMessageId: 'message-1',
        latestToolExecutionCount: 2,
        latestFailureMessage: 'Agent failed',
        latestResultSummary: null,
        createdAt: new Date('2026-03-26T08:00:00.000Z'),
        updatedAt: new Date('2026-03-27T08:30:00.000Z')
      })
    ).toEqual({
      id: 'schedule-1',
      title: 'Daily digest',
      taskPrompt: 'Summarize updates',
      type: 'CRON',
      cronExpr: '0 9 * * *',
      intervalMs: null,
      runAt: null,
      timezone: 'UTC',
      enabled: true,
      lastRunAt: '2026-03-27T08:00:00.000Z',
      nextRunAt: '2026-03-28T09:00:00.000Z',
      latestRunId: 'run-1',
      latestRunStatus: 'FAILED',
      latestRunStage: 'FINALIZING',
      latestRunStartedAt: '2026-03-27T08:00:00.000Z',
      latestRunFinishedAt: '2026-03-27T08:02:00.000Z',
      latestRequestId: 'request-1',
      latestSessionId: 'session-1',
      latestMessageId: 'message-1',
      latestToolExecutionCount: 2,
      latestFailureMessage: 'Agent failed',
      latestResultSummary: null,
      createdAt: '2026-03-26T08:00:00.000Z',
      updatedAt: '2026-03-27T08:30:00.000Z'
    });
  });

  it('maps one-time schedule to summary', () => {
    expect(
      toScheduleSummary({
        id: 'schedule-2',
        title: 'One-off reminder',
        taskPrompt: 'Notify me once',
        type: 'ONE_TIME',
        cronExpr: null,
        intervalMs: null,
        runAt: new Date('2026-03-28T09:00:00.000Z'),
        timezone: 'UTC',
        enabled: false,
        lastRunAt: null,
        nextRunAt: null,
        latestRunId: null,
        latestRunStatus: null,
        latestRunStage: null,
        latestRunStartedAt: null,
        latestRunFinishedAt: null,
        latestRequestId: null,
        latestSessionId: null,
        latestMessageId: null,
        latestToolExecutionCount: 0,
        latestFailureMessage: null,
        latestResultSummary: null,
        createdAt: new Date('2026-03-26T08:00:00.000Z'),
        updatedAt: new Date('2026-03-27T08:30:00.000Z')
      })
    ).toEqual({
      id: 'schedule-2',
      title: 'One-off reminder',
      taskPrompt: 'Notify me once',
      type: 'ONE_TIME',
      cronExpr: null,
      intervalMs: null,
      runAt: '2026-03-28T09:00:00.000Z',
      timezone: 'UTC',
      enabled: false,
      lastRunAt: null,
      nextRunAt: null,
      latestRunId: null,
      latestRunStatus: null,
      latestRunStage: null,
      latestRunStartedAt: null,
      latestRunFinishedAt: null,
      latestRequestId: null,
      latestSessionId: null,
      latestMessageId: null,
      latestToolExecutionCount: 0,
      latestFailureMessage: null,
      latestResultSummary: null,
      createdAt: '2026-03-26T08:00:00.000Z',
      updatedAt: '2026-03-27T08:30:00.000Z'
    });
  });
});

describe('schedule DTOs', () => {
  it('validates a one-time create schedule payload', async () => {
    const dto = new CreateScheduleDto();
    dto.title = 'Morning summary';
    dto.taskPrompt = 'Summarize unread issues';
    dto.type = 'ONE_TIME';
    dto.runAt = '2026-03-28T09:00:00.000Z';
    dto.timezone = 'UTC';

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects invalid create schedule payload', async () => {
    const dto = new CreateScheduleDto();
    dto.title = '';
    dto.taskPrompt = '';
    dto.type = 'ONE_TIME';
    dto.runAt = 'not-a-date';

    const errors = await validate(dto);

    expect(errors).toHaveLength(3);
    expect(errors.map((error) => error.property)).toEqual(
      expect.arrayContaining(['title', 'taskPrompt', 'runAt'])
    );
  });

  it('accepts partial update schedule payload', async () => {
    const dto = new UpdateScheduleDto();
    dto.enabled = false;
    dto.timezone = 'UTC';

    await expect(validate(dto)).resolves.toHaveLength(0);
  });

  it('rejects empty cronExpr in update payload', async () => {
    const dto = new UpdateScheduleDto();
    dto.cronExpr = '';

    const errors = await validate(dto);

    expect(errors).toHaveLength(1);
    expect(errors[0]?.property).toBe('cronExpr');
  });
});

describe('ScheduleService', () => {
  const userId = 'user-1';
  const otherUserId = 'user-2';
  const now = new Date('2026-03-27T08:30:00.000Z');

  type ScheduleRecord = {
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
    latestRunId?: string | null;
    latestRunStatus?: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | null;
    latestRunStage?: 'PREPARING' | 'ROUTING' | 'MODEL_CALLING' | 'TOOL_RUNNING' | 'REPAIRING' | 'PERSISTING' | 'FINALIZING' | null;
    latestRunStartedAt?: Date | null;
    latestRunFinishedAt?: Date | null;
    latestRequestId?: string | null;
    latestSessionId?: string | null;
    latestMessageId?: string | null;
    latestToolExecutionCount?: number | null;
    latestFailureMessage?: string | null;
    latestResultSummary?: string | null;
    createdAt: Date;
    updatedAt: Date;
  };

  type RunRecord = {
    id: string;
    scheduleId: string;
    userId: string;
    requestId: string | null;
    status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
    stage: 'PREPARING' | 'ROUTING' | 'MODEL_CALLING' | 'TOOL_RUNNING' | 'REPAIRING' | 'PERSISTING' | 'FINALIZING';
    errorCategory: 'INPUT_ERROR' | 'TOOL_ERROR' | 'MODEL_ERROR' | 'DEPENDENCY_ERROR' | 'TIMEOUT_ERROR' | 'SYSTEM_ERROR' | 'CANCELLED' | null;
    triggerSource: 'SCHEDULE' | 'MANUAL_RETRY';
    taskPromptSnapshot: string;
    resultSummary: string | null;
    errorMessage: string | null;
    chatSessionId: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    createdAt: Date;
    chatSession: {
      toolExecutions: Array<{ id: string }>;
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
  };

  function createScheduleRecord(overrides: Partial<ScheduleRecord> = {}): ScheduleRecord {
    return {
      id: 'schedule-1',
      userId,
      title: 'Morning summary',
      taskPrompt: 'Summarize unread issues',
      type: 'ONE_TIME',
      cronExpr: null,
      intervalMs: null,
      runAt: new Date('2026-03-28T09:00:00.000Z'),
      timezone: 'UTC',
      enabled: true,
      lastRunAt: null,
      nextRunAt: new Date('2026-03-28T09:00:00.000Z'),
      latestRunId: null,
      latestRunStatus: null,
      latestRunStage: null,
      latestRunStartedAt: null,
      latestRunFinishedAt: null,
      latestRequestId: null,
      latestSessionId: null,
      latestMessageId: null,
      latestToolExecutionCount: 0,
      latestFailureMessage: null,
      latestResultSummary: null,
      createdAt: new Date('2026-03-27T08:00:00.000Z'),
      updatedAt: new Date('2026-03-27T08:00:00.000Z'),
      ...overrides
    };
  }

  function createRunRecord(overrides: Partial<RunRecord> = {}): RunRecord {
    return {
      id: 'run-1',
      scheduleId: 'schedule-1',
      userId,
      requestId: 'request-run-1',
      status: 'COMPLETED',
      stage: 'FINALIZING',
      errorCategory: null,
      triggerSource: 'SCHEDULE',
      taskPromptSnapshot: 'Summarize unread issues',
      resultSummary: 'Done',
      errorMessage: null,
      chatSessionId: 'chat-session-1',
      startedAt: new Date('2026-03-28T09:00:00.000Z'),
      finishedAt: new Date('2026-03-28T09:00:10.000Z'),
      createdAt: new Date('2026-03-28T09:00:00.000Z'),
      chatSession: {
        toolExecutions: [],
        messages: [
          {
            id: 'message-1',
            runId: 'run-1',
            createdAt: new Date('2026-03-28T09:00:00.000Z')
          }
        ]
      },
      schedule: {
        id: 'schedule-1',
        title: 'Morning summary',
        type: 'ONE_TIME'
      },
      ...overrides
    };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('create one-time schedule computes nextRunAt', async () => {
    const created = createScheduleRecord();
    const create = jest.fn().mockResolvedValue(created);
    const prisma = {
      schedule: {
        create
      }
    };

    const service = new ScheduleService(prisma as never, { triggerRun: jest.fn() } as never);

    const result = await service.createSchedule(userId, {
      title: 'Morning summary',
      taskPrompt: 'Summarize unread issues',
      type: 'ONE_TIME',
      runAt: '2026-03-28T09:00:00.000Z',
      timezone: 'UTC'
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        userId,
        title: 'Morning summary',
        taskPrompt: 'Summarize unread issues',
        type: 'ONE_TIME',
        cronExpr: null,
        intervalMs: null,
        runAt: new Date('2026-03-28T09:00:00.000Z'),
        timezone: 'UTC',
        enabled: true,
        nextRunAt: new Date('2026-03-28T09:00:00.000Z')
      }
    });
    expect(result.nextRunAt).toBe('2026-03-28T09:00:00.000Z');
  });

  it('listSchedules returns summaries for the owner only', async () => {
    const ownedSchedule = createScheduleRecord({
      lastRunAt: new Date('2026-03-28T09:00:10.000Z'),
      latestRunId: 'run-1',
      latestRunStatus: 'COMPLETED',
      latestRunStage: 'FINALIZING',
      latestRunStartedAt: new Date('2026-03-28T09:00:00.000Z'),
      latestRunFinishedAt: new Date('2026-03-28T09:00:10.000Z'),
      latestRequestId: 'request-run-1',
      latestSessionId: 'chat-session-1',
      latestMessageId: 'message-1',
      latestToolExecutionCount: 2,
      latestFailureMessage: null,
      latestResultSummary: 'Done'
    });
    const findMany = jest.fn().mockResolvedValue([ownedSchedule]);
    const prisma = {
      schedule: {
        findMany
      }
    };

    const service = new ScheduleService(prisma as never, { triggerRun: jest.fn() } as never);

    const result = await service.listSchedules(userId, { enabled: true });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId,
        enabled: true
      },
      orderBy: { createdAt: 'desc' }
    });
    expect(result).toEqual({
      schedules: [
        {
          id: 'schedule-1',
          title: 'Morning summary',
          taskPrompt: 'Summarize unread issues',
          type: 'ONE_TIME',
          cronExpr: null,
          intervalMs: null,
          runAt: '2026-03-28T09:00:00.000Z',
          timezone: 'UTC',
          enabled: true,
          lastRunAt: '2026-03-28T09:00:10.000Z',
          nextRunAt: '2026-03-28T09:00:00.000Z',
          latestRunId: 'run-1',
          latestRunStatus: 'COMPLETED',
          latestRunStage: 'FINALIZING',
          latestRunStartedAt: '2026-03-28T09:00:00.000Z',
          latestRunFinishedAt: '2026-03-28T09:00:10.000Z',
          latestRequestId: 'request-run-1',
          latestSessionId: 'chat-session-1',
          latestMessageId: 'message-1',
          latestToolExecutionCount: 2,
          latestFailureMessage: null,
          latestResultSummary: 'Done',
          createdAt: '2026-03-27T08:00:00.000Z',
          updatedAt: '2026-03-27T08:00:00.000Z'
        }
      ]
    });
  });

  it('getScheduleOrThrow throws NotFoundException when schedule is missing', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = {
      schedule: {
        findFirst
      }
    };

    const service = new ScheduleService(prisma as never, { triggerRun: jest.fn() } as never);

    await expect(service.getScheduleOrThrow(userId, 'missing-schedule')).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'missing-schedule', userId }
    });
  });

  it('updateSchedule preserves existing cronExpr when type stays CRON without cronExpr', async () => {
    const existing = createScheduleRecord({
      id: 'schedule-2a',
      type: 'CRON',
      cronExpr: '0 9 * * *',
      runAt: null,
      timezone: 'UTC',
      nextRunAt: new Date('2026-03-28T09:00:00.000Z')
    });
    const updated = createScheduleRecord({
      ...existing,
      title: 'Evening summary',
      nextRunAt: new Date('2026-03-27T09:00:00.000Z'),
      updatedAt: new Date('2026-03-27T08:35:00.000Z')
    });
    const findFirst = jest.fn().mockResolvedValue(existing);
    const update = jest.fn().mockResolvedValue(updated);
    const prisma = {
      schedule: {
        findFirst,
        update
      }
    };

    const service = new ScheduleService(prisma as never, { triggerRun: jest.fn() } as never);

    await service.updateSchedule(userId, existing.id, {
      title: 'Evening summary',
      type: 'CRON'
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: {
        title: 'Evening summary',
        taskPrompt: existing.taskPrompt,
        type: 'CRON',
        cronExpr: '0 9 * * *',
        intervalMs: null,
        runAt: null,
        timezone: 'UTC',
        enabled: true,
        nextRunAt: new Date('2026-03-27T09:00:00.000Z')
      }
    });
  });

  it('updateSchedule merges existing values and recomputes nextRunAt', async () => {
    const existing = createScheduleRecord({
      id: 'schedule-2',
      type: 'CRON',
      cronExpr: '0 9 * * *',
      runAt: null,
      timezone: 'UTC',
      nextRunAt: new Date('2026-03-28T09:00:00.000Z')
    });
    const updated = createScheduleRecord({
      ...existing,
      title: 'Evening summary',
      cronExpr: '0 18 * * *',
      nextRunAt: new Date('2026-03-27T18:00:00.000Z'),
      updatedAt: new Date('2026-03-27T08:35:00.000Z')
    });
    const findFirst = jest.fn().mockResolvedValue(existing);
    const update = jest.fn().mockResolvedValue(updated);
    const prisma = {
      schedule: {
        findFirst,
        update
      }
    };

    const service = new ScheduleService(prisma as never, { triggerRun: jest.fn() } as never);

    const result = await service.updateSchedule(userId, existing.id, {
      title: 'Evening summary',
      type: 'CRON',
      cronExpr: '0 18 * * *'
    });

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: existing.id, userId }
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: {
        title: 'Evening summary',
        taskPrompt: existing.taskPrompt,
        type: 'CRON',
        cronExpr: '0 18 * * *',
        intervalMs: null,
        runAt: null,
        timezone: 'UTC',
        enabled: true,
        nextRunAt: new Date('2026-03-27T18:00:00.000Z')
      }
    });
    expect(result.nextRunAt).toBe('2026-03-27T18:00:00.000Z');
  });

  it('updateSchedule updates cronExpr without requiring type for existing cron schedules', async () => {
    const existing = createScheduleRecord({
      id: 'schedule-2b',
      type: 'CRON',
      cronExpr: '0 9 * * *',
      runAt: null,
      timezone: 'UTC',
      nextRunAt: new Date('2026-03-28T09:00:00.000Z')
    });
    const updated = createScheduleRecord({
      ...existing,
      cronExpr: '0 18 * * *',
      nextRunAt: new Date('2026-03-27T18:00:00.000Z'),
      updatedAt: new Date('2026-03-27T08:35:00.000Z')
    });
    const findFirst = jest.fn().mockResolvedValue(existing);
    const update = jest.fn().mockResolvedValue(updated);
    const prisma = {
      schedule: {
        findFirst,
        update
      }
    };

    const service = new ScheduleService(prisma as never, { triggerRun: jest.fn() } as never);

    await service.updateSchedule(userId, existing.id, {
      cronExpr: '0 18 * * *'
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: {
        title: existing.title,
        taskPrompt: existing.taskPrompt,
        type: 'CRON',
        cronExpr: '0 18 * * *',
        intervalMs: null,
        runAt: null,
        timezone: 'UTC',
        enabled: true,
        nextRunAt: new Date('2026-03-27T18:00:00.000Z')
      }
    });
  });

  it('updateSchedule updates runAt without requiring type for existing one-time schedules', async () => {
    const existing = createScheduleRecord({
      id: 'schedule-2c',
      type: 'ONE_TIME',
      cronExpr: null,
      runAt: new Date('2026-03-28T09:00:00.000Z'),
      nextRunAt: new Date('2026-03-28T09:00:00.000Z')
    });
    const updated = createScheduleRecord({
      ...existing,
      runAt: new Date('2026-03-29T10:00:00.000Z'),
      nextRunAt: new Date('2026-03-29T10:00:00.000Z'),
      updatedAt: new Date('2026-03-27T08:35:00.000Z')
    });
    const findFirst = jest.fn().mockResolvedValue(existing);
    const update = jest.fn().mockResolvedValue(updated);
    const prisma = {
      schedule: {
        findFirst,
        update
      }
    };

    const service = new ScheduleService(prisma as never, { triggerRun: jest.fn() } as never);

    await service.updateSchedule(userId, existing.id, {
      runAt: '2026-03-29T10:00:00.000Z'
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: {
        title: existing.title,
        taskPrompt: existing.taskPrompt,
        type: 'ONE_TIME',
        cronExpr: null,
        intervalMs: null,
        runAt: new Date('2026-03-29T10:00:00.000Z'),
        timezone: 'UTC',
        enabled: true,
        nextRunAt: new Date('2026-03-29T10:00:00.000Z')
      }
    });
  });

  it('rejects runAt update without type for existing cron schedules', async () => {
    const existing = createScheduleRecord({
      id: 'schedule-2d',
      type: 'CRON',
      cronExpr: '0 9 * * *',
      runAt: null,
      timezone: 'UTC',
      nextRunAt: new Date('2026-03-28T09:00:00.000Z')
    });
    const findFirst = jest.fn().mockResolvedValue(existing);
    const update = jest.fn();
    const prisma = {
      schedule: {
        findFirst,
        update
      }
    };

    const service = new ScheduleService(prisma as never, { triggerRun: jest.fn() } as never);

    await expect(
      service.updateSchedule(userId, existing.id, {
        runAt: '2026-03-29T10:00:00.000Z'
      })
    ).rejects.toThrow('runAt is not allowed for CRON schedules');
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects cronExpr update without type for existing one-time schedules', async () => {
    const existing = createScheduleRecord({
      id: 'schedule-2e',
      type: 'ONE_TIME',
      cronExpr: null,
      runAt: new Date('2026-03-28T09:00:00.000Z'),
      nextRunAt: new Date('2026-03-28T09:00:00.000Z')
    });
    const findFirst = jest.fn().mockResolvedValue(existing);
    const update = jest.fn();
    const prisma = {
      schedule: {
        findFirst,
        update
      }
    };

    const service = new ScheduleService(prisma as never, { triggerRun: jest.fn() } as never);

    await expect(
      service.updateSchedule(userId, existing.id, {
        cronExpr: '0 18 * * *'
      })
    ).rejects.toThrow('cronExpr is not allowed for ONE_TIME schedules');
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects mixed schedule field updates without type', async () => {
    const existing = createScheduleRecord({
      id: 'schedule-2f',
      type: 'CRON',
      cronExpr: '0 9 * * *',
      runAt: null,
      timezone: 'UTC',
      nextRunAt: new Date('2026-03-28T09:00:00.000Z')
    });
    const findFirst = jest.fn().mockResolvedValue(existing);
    const update = jest.fn();
    const prisma = {
      schedule: {
        findFirst,
        update
      }
    };

    const service = new ScheduleService(prisma as never, { triggerRun: jest.fn() } as never);

    await expect(
      service.updateSchedule(userId, existing.id, {
        cronExpr: '0 18 * * *',
        runAt: '2026-03-29T10:00:00.000Z'
      })
    ).rejects.toThrow('cronExpr and runAt cannot be updated together without type');
    expect(update).not.toHaveBeenCalled();
  });

  it('enableSchedule recomputes nextRunAt', async () => {
    const existing = createScheduleRecord({
      id: 'schedule-3',
      type: 'CRON',
      cronExpr: '0 9 * * *',
      runAt: null,
      enabled: false,
      nextRunAt: null
    });
    const updated = createScheduleRecord({
      ...existing,
      enabled: true,
      nextRunAt: new Date('2026-03-27T09:00:00.000Z')
    });
    const findFirst = jest.fn().mockResolvedValue(existing);
    const update = jest.fn().mockResolvedValue(updated);
    const prisma = {
      schedule: {
        findFirst,
        update
      }
    };

    const service = new ScheduleService(prisma as never, { triggerRun: jest.fn() } as never);

    const result = await service.enableSchedule(userId, existing.id);

    expect(update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: {
        enabled: true,
        nextRunAt: new Date('2026-03-27T09:00:00.000Z')
      }
    });
    expect(result.nextRunAt).toBe('2026-03-27T09:00:00.000Z');
  });

  it('disableSchedule clears nextRunAt', async () => {
    const existing = createScheduleRecord({
      id: 'schedule-4',
      nextRunAt: new Date('2026-03-28T09:00:00.000Z')
    });
    const updated = createScheduleRecord({
      ...existing,
      enabled: false,
      nextRunAt: null
    });
    const findFirst = jest.fn().mockResolvedValue(existing);
    const update = jest.fn().mockResolvedValue(updated);
    const prisma = {
      schedule: {
        findFirst,
        update
      }
    };

    const service = new ScheduleService(prisma as never, { triggerRun: jest.fn() } as never);

    const result = await service.disableSchedule(userId, existing.id);

    expect(update).toHaveBeenCalledWith({
      where: { id: existing.id },
      data: {
        enabled: false,
        nextRunAt: null
      }
    });
    expect(result.enabled).toBe(false);
    expect(result.nextRunAt).toBeNull();
  });

  it('deleteSchedule removes an owned schedule', async () => {
    const existing = createScheduleRecord({
      id: 'schedule-5'
    });
    const findFirst = jest.fn().mockResolvedValue(existing);
    const deleteSchedule = jest.fn().mockResolvedValue(existing);
    const prisma = {
      schedule: {
        findFirst,
        delete: deleteSchedule
      }
    };

    const service = new ScheduleService(prisma as never, { triggerRun: jest.fn() } as never);

    await service.deleteSchedule(userId, existing.id);

    expect(findFirst).toHaveBeenCalledWith({
      where: { id: existing.id, userId }
    });
    expect(deleteSchedule).toHaveBeenCalledWith({
      where: { id: existing.id }
    });
  });

  it('deleteSchedule throws NotFoundException for missing schedule', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const deleteSchedule = jest.fn();
    const prisma = {
      schedule: {
        findFirst,
        delete: deleteSchedule
      }
    };

    const service = new ScheduleService(prisma as never, { triggerRun: jest.fn() } as never);

    await expect(service.deleteSchedule(userId, 'missing-schedule')).rejects.toBeInstanceOf(NotFoundException);
    expect(deleteSchedule).not.toHaveBeenCalled();
  });

  it('listRuns returns owner-filtered runs', async () => {
    const run = createRunRecord();
    const findMany = jest.fn().mockResolvedValue([run]);
    const prisma = {
      scheduleRun: {
        findMany
      }
    };

    const service = new ScheduleService(prisma as never, { triggerRun: jest.fn() } as never);

    const result = await service.listRuns(userId, {
      scheduleId: 'schedule-1',
      status: 'COMPLETED'
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId,
        scheduleId: 'schedule-1',
        status: 'COMPLETED'
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
    expect(result).toEqual({
      runs: [
        {
          id: 'run-1',
          sessionId: 'chat-session-1',
          messageId: 'message-1',
          scheduleId: 'schedule-1',
          userId,
          status: 'COMPLETED',
          stage: 'FINALIZING',
          triggerSource: 'SCHEDULE',
          failureCategory: null,
          failureCode: null,
          failureMessage: null,
          requestId: 'request-run-1',
          durationMs: 10000,
          toolExecutionCount: 0,
          retryCount: 0,
          lastRepairAction: null,
          taskPromptSnapshot: 'Summarize unread issues',
          chatSessionId: 'chat-session-1',
          scheduleTitle: 'Morning summary',
          resultSummary: 'Done',
          startedAt: '2026-03-28T09:00:00.000Z',
          finishedAt: '2026-03-28T09:00:10.000Z',
          createdAt: '2026-03-28T09:00:00.000Z',
          schedule: {
            id: 'schedule-1',
            title: 'Morning summary',
            type: 'ONE_TIME'
          }
        }
      ]
    });
  });

  it('getRunOrThrow returns stage failureCategory triggerSource durationMs and toolExecutionCount', async () => {
    const run = createRunRecord({
      status: 'FAILED',
      stage: 'TOOL_RUNNING',
      errorCategory: 'DEPENDENCY_ERROR',
      triggerSource: 'SCHEDULE',
      resultSummary: null,
      errorMessage: 'Tool provider timed out',
      startedAt: new Date('2026-03-28T09:00:00.000Z'),
      finishedAt: new Date('2026-03-28T09:00:05.000Z'),
      chatSession: {
        toolExecutions: [{ id: 'tool-1' }, { id: 'tool-2' }],
        messages: [
          {
            id: 'message-1',
            runId: 'run-1',
            createdAt: new Date('2026-03-28T09:00:00.000Z')
          }
        ]
      }
    });
    const findFirst = jest.fn().mockResolvedValue(run);
    const prisma = {
      scheduleRun: {
        findFirst
      }
    };

    const service = new ScheduleService(prisma as never, { triggerRun: jest.fn() } as never);

    await expect(service.getRunOrThrow(userId, 'run-1')).resolves.toMatchObject({
      id: 'run-1',
      status: 'FAILED',
      stage: 'TOOL_RUNNING',
      failureCategory: 'DEPENDENCY_ERROR',
      triggerSource: 'SCHEDULE',
      durationMs: 5000,
      toolExecutionCount: 2
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'run-1', userId },
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
  });

  it('getRunOrThrow throws NotFoundException when run is missing', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = {
      scheduleRun: {
        findFirst
      }
    };

    const service = new ScheduleService(prisma as never, { triggerRun: jest.fn() } as never);

    await expect(service.getRunOrThrow(otherUserId, 'missing-run')).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'missing-run', userId: otherUserId },
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
  });

  it('creates rerun with MANUAL_RETRY triggerSource', async () => {
    const run = createRunRecord({
      id: 'run-1',
      scheduleId: 'schedule-1',
      userId,
      schedule: {
        id: 'schedule-1',
        title: 'Morning summary',
        type: 'ONE_TIME'
      }
    });
    const schedule = createScheduleRecord({
      id: 'schedule-1',
      userId,
      title: 'Morning summary',
      taskPrompt: 'Summarize unread issues',
      type: 'ONE_TIME'
    });
    const rerun = createRunRecord({
      id: 'run-2',
      scheduleId: 'schedule-1',
      userId,
      requestId: 'request-run-1-retry-1711614600000',
      status: 'PENDING',
      stage: 'PREPARING',
      triggerSource: 'MANUAL_RETRY',
      resultSummary: null,
      errorMessage: null,
      chatSessionId: null,
      startedAt: null,
      finishedAt: null,
      createdAt: new Date('2026-03-28T10:00:00.000Z'),
      chatSession: null,
      schedule: {
        id: 'schedule-1',
        title: 'Morning summary',
        type: 'ONE_TIME'
      }
    });
    const findFirst = jest.fn().mockResolvedValue(run);
    const create = jest.fn().mockResolvedValue(rerun);
    const findSchedule = jest.fn().mockResolvedValue(schedule);
    const triggerRun = jest.fn().mockResolvedValue(undefined);
    const prisma = {
      scheduleRun: {
        findFirst,
        create
      },
      schedule: {
        findFirst: findSchedule
      }
    };

    const service = new ScheduleService(prisma as never, { triggerRun } as never);

    await expect(service.retryRun('run-1', userId)).resolves.toMatchObject({
      run: {
        id: 'run-2',
        requestId: expect.stringMatching(/^request-run-1-retry-\d+$/),
        triggerSource: 'MANUAL_RETRY',
        status: 'PENDING',
        stage: 'PREPARING'
      }
    });
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'run-1', userId },
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
    expect(findSchedule).toHaveBeenCalledWith({
      where: { id: 'schedule-1', userId }
    });
    expect(create).toHaveBeenCalledWith({
      data: {
        scheduleId: 'schedule-1',
        userId,
        requestId: expect.stringMatching(/^request-run-1-retry-\d+$/),
        status: 'PENDING',
        stage: 'PREPARING',
        triggerSource: 'MANUAL_RETRY',
        taskPromptSnapshot: 'Summarize unread issues'
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
    expect(triggerRun).toHaveBeenCalledWith({
      schedule: {
        id: 'schedule-1',
        userId,
        title: 'Morning summary',
        taskPrompt: 'Summarize unread issues',
        type: 'ONE_TIME',
        cronExpr: null,
        intervalMs: null,
        runAt: new Date('2026-03-28T09:00:00.000Z'),
        timezone: 'UTC',
        enabled: true,
        lastRunAt: null,
        nextRunAt: new Date('2026-03-28T09:00:00.000Z')
      },
      run: {
        id: 'run-2',
        requestId: expect.stringMatching(/^request-run-1-retry-\d+$/)
      },
      triggerSource: 'MANUAL_RETRY'
    });
  });
});
