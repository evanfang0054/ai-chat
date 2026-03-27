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
        runAt: null,
        timezone: 'UTC',
        enabled: true,
        lastRunAt: new Date('2026-03-27T08:00:00.000Z'),
        nextRunAt: new Date('2026-03-28T09:00:00.000Z'),
        createdAt: new Date('2026-03-26T08:00:00.000Z'),
        updatedAt: new Date('2026-03-27T08:30:00.000Z')
      })
    ).toEqual({
      id: 'schedule-1',
      title: 'Daily digest',
      taskPrompt: 'Summarize updates',
      type: 'CRON',
      cronExpr: '0 9 * * *',
      runAt: null,
      timezone: 'UTC',
      enabled: true,
      lastRunAt: '2026-03-27T08:00:00.000Z',
      nextRunAt: '2026-03-28T09:00:00.000Z',
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
        runAt: new Date('2026-03-28T09:00:00.000Z'),
        timezone: 'UTC',
        enabled: false,
        lastRunAt: null,
        nextRunAt: null,
        createdAt: new Date('2026-03-26T08:00:00.000Z'),
        updatedAt: new Date('2026-03-27T08:30:00.000Z')
      })
    ).toEqual({
      id: 'schedule-2',
      title: 'One-off reminder',
      taskPrompt: 'Notify me once',
      type: 'ONE_TIME',
      cronExpr: null,
      runAt: '2026-03-28T09:00:00.000Z',
      timezone: 'UTC',
      enabled: false,
      lastRunAt: null,
      nextRunAt: null,
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
    type: 'CRON' | 'ONE_TIME';
    cronExpr: string | null;
    runAt: Date | null;
    timezone: string;
    enabled: boolean;
    lastRunAt: Date | null;
    nextRunAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };

  type RunRecord = {
    id: string;
    scheduleId: string;
    userId: string;
    status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
    taskPromptSnapshot: string;
    resultSummary: string | null;
    errorMessage: string | null;
    chatSessionId: string | null;
    startedAt: Date | null;
    finishedAt: Date | null;
    createdAt: Date;
    schedule: {
      id: string;
      title: string;
      type: 'CRON' | 'ONE_TIME';
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
      runAt: new Date('2026-03-28T09:00:00.000Z'),
      timezone: 'UTC',
      enabled: true,
      lastRunAt: null,
      nextRunAt: new Date('2026-03-28T09:00:00.000Z'),
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
      status: 'SUCCEEDED',
      taskPromptSnapshot: 'Summarize unread issues',
      resultSummary: 'Done',
      errorMessage: null,
      chatSessionId: 'chat-session-1',
      startedAt: new Date('2026-03-28T09:00:00.000Z'),
      finishedAt: new Date('2026-03-28T09:00:10.000Z'),
      createdAt: new Date('2026-03-28T09:00:00.000Z'),
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

    const service = new ScheduleService(prisma as never);

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
        runAt: new Date('2026-03-28T09:00:00.000Z'),
        timezone: 'UTC',
        enabled: true,
        nextRunAt: new Date('2026-03-28T09:00:00.000Z')
      }
    });
    expect(result.nextRunAt).toBe('2026-03-28T09:00:00.000Z');
  });

  it('listSchedules returns summaries for the owner only', async () => {
    const ownedSchedule = createScheduleRecord();
    const findMany = jest.fn().mockResolvedValue([ownedSchedule]);
    const prisma = {
      schedule: {
        findMany
      }
    };

    const service = new ScheduleService(prisma as never);

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
          runAt: '2026-03-28T09:00:00.000Z',
          timezone: 'UTC',
          enabled: true,
          lastRunAt: null,
          nextRunAt: '2026-03-28T09:00:00.000Z',
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

    const service = new ScheduleService(prisma as never);

    await expect(service.getScheduleOrThrow(userId, 'missing-schedule')).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'missing-schedule', userId }
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

    const service = new ScheduleService(prisma as never);

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

    const service = new ScheduleService(prisma as never);

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

    const service = new ScheduleService(prisma as never);

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

    const service = new ScheduleService(prisma as never);

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

    const service = new ScheduleService(prisma as never);

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

    const service = new ScheduleService(prisma as never);

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

    const service = new ScheduleService(prisma as never);

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

    const service = new ScheduleService(prisma as never);

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

    const service = new ScheduleService(prisma as never);

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

    const service = new ScheduleService(prisma as never);

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

    const service = new ScheduleService(prisma as never);

    const result = await service.listRuns(userId, {
      scheduleId: 'schedule-1',
      status: 'SUCCEEDED'
    });

    expect(findMany).toHaveBeenCalledWith({
      where: {
        userId,
        scheduleId: 'schedule-1',
        status: 'SUCCEEDED'
      },
      include: {
        schedule: true
      },
      orderBy: { createdAt: 'desc' }
    });
    expect(result).toEqual({
      runs: [
        {
          id: 'run-1',
          scheduleId: 'schedule-1',
          userId,
          status: 'SUCCEEDED',
          taskPromptSnapshot: 'Summarize unread issues',
          resultSummary: 'Done',
          errorMessage: null,
          chatSessionId: 'chat-session-1',
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

  it('getRunOrThrow throws NotFoundException when run is missing', async () => {
    const findFirst = jest.fn().mockResolvedValue(null);
    const prisma = {
      scheduleRun: {
        findFirst
      }
    };

    const service = new ScheduleService(prisma as never);

    await expect(service.getRunOrThrow(otherUserId, 'missing-run')).rejects.toBeInstanceOf(NotFoundException);
    expect(findFirst).toHaveBeenCalledWith({
      where: { id: 'missing-run', userId: otherUserId },
      include: {
        schedule: true
      }
    });
  });
});
