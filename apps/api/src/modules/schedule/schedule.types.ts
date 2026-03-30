import type { CreateScheduleRequest, ScheduleRunStatus, ScheduleType } from '@ai-chat/shared';

export type ScheduleInput = {
  type: ScheduleType;
  cronExpr?: string | null;
  intervalMs?: number | null;
  runAt?: string | null;
};

export type ScheduleComputationInput = ScheduleInput & {
  timezone: string;
  now?: Date;
};

export interface ScheduleFilters {
  enabled?: boolean;
  type?: ScheduleType;
}

export interface ScheduleRunFilters {
  scheduleId?: string;
  status?: ScheduleRunStatus;
}

interface ScheduleSummaryLikeBase {
  id: string;
  title: string;
  taskPrompt: string;
  timezone: string;
  enabled: boolean;
  lastRunAt: Date | null;
  nextRunAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type ScheduleSummaryLike =
  | (ScheduleSummaryLikeBase & {
      type: 'CRON';
      cronExpr: string;
      intervalMs: null;
      runAt: null;
    })
  | (ScheduleSummaryLikeBase & {
      type: 'ONE_TIME';
      cronExpr: null;
      intervalMs: null;
      runAt: Date;
    })
  | (ScheduleSummaryLikeBase & {
      type: 'INTERVAL';
      cronExpr: null;
      intervalMs: number;
      runAt: null;
    });
