import { BadRequestException } from '@nestjs/common';
import type { ScheduleSummary } from '@ai-chat/shared';
import { CronExpressionParser } from 'cron-parser';

import type { ScheduleComputationInput, ScheduleInput, ScheduleSummaryLike } from './schedule.types';

export function validateScheduleInput(input: ScheduleInput) {
  if (input.type === 'ONE_TIME') {
    if (!input.runAt) {
      throw new BadRequestException('runAt is required for ONE_TIME schedules');
    }

    if (input.cronExpr) {
      throw new BadRequestException('cronExpr is not allowed for ONE_TIME schedules');
    }

    if (input.intervalMs) {
      throw new BadRequestException('intervalMs is not allowed for ONE_TIME schedules');
    }
  }

  if (input.type === 'CRON') {
    if (!input.cronExpr) {
      throw new BadRequestException('cronExpr is required for CRON schedules');
    }

    if (input.runAt) {
      throw new BadRequestException('runAt is not allowed for CRON schedules');
    }

    if (input.intervalMs) {
      throw new BadRequestException('intervalMs is not allowed for CRON schedules');
    }
  }

  if (input.type === 'INTERVAL') {
    if (!input.intervalMs || input.intervalMs < 1000) {
      throw new BadRequestException('intervalMs must be at least 1000ms for INTERVAL schedules');
    }

    if (input.cronExpr) {
      throw new BadRequestException('cronExpr is not allowed for INTERVAL schedules');
    }

    if (input.runAt) {
      throw new BadRequestException('runAt is not allowed for INTERVAL schedules');
    }
  }
}

export function computeNextRunAt(input: ScheduleComputationInput) {
  assertValidTimezone(input.timezone);

  if (input.type === 'ONE_TIME') {
    return input.runAt ? new Date(input.runAt) : null;
  }

  if (input.type === 'INTERVAL') {
    const intervalMs = input.intervalMs;
    if (!intervalMs || intervalMs < 1000) {
      throw new BadRequestException('intervalMs must be at least 1000ms for INTERVAL schedules');
    }

    return new Date((input.now ?? new Date()).getTime() + intervalMs);
  }

  if (!input.cronExpr) {
    throw new BadRequestException('cronExpr is required for CRON schedules');
  }

  try {
    const interval = CronExpressionParser.parse(input.cronExpr, {
      currentDate: input.now ?? new Date(),
      tz: input.timezone
    });

    return interval.next().toDate();
  } catch {
    throw new BadRequestException('Invalid cron expression');
  }
}

export function toScheduleSummary(schedule: ScheduleSummaryLike): ScheduleSummary {
  const summary = {
    id: schedule.id,
    title: schedule.title,
    taskPrompt: schedule.taskPrompt,
    timezone: schedule.timezone,
    enabled: schedule.enabled,
    lastRunAt: schedule.lastRunAt?.toISOString() ?? null,
    nextRunAt: schedule.nextRunAt?.toISOString() ?? null,
    createdAt: schedule.createdAt.toISOString(),
    updatedAt: schedule.updatedAt.toISOString()
  };

  if (schedule.type === 'CRON') {
    return {
      ...summary,
      type: 'CRON',
      cronExpr: schedule.cronExpr,
      intervalMs: null,
      runAt: null
    };
  }

  if (schedule.type === 'INTERVAL') {
    return {
      ...summary,
      type: 'INTERVAL',
      cronExpr: null,
      intervalMs: schedule.intervalMs,
      runAt: null
    };
  }

  return {
    ...summary,
    type: 'ONE_TIME',
    cronExpr: null,
    intervalMs: null,
    runAt: schedule.runAt.toISOString()
  };
}

function assertValidTimezone(timezone: string) {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    throw new BadRequestException('Invalid timezone');
  }
}
