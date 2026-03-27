import type { CreateScheduleRequest, ScheduleRunStatus, ScheduleType } from '@ai-chat/shared';

export type ScheduleInput = Pick<CreateScheduleRequest, 'type'> & {
  cronExpr?: string | null;
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
      runAt: null;
    })
  | (ScheduleSummaryLikeBase & {
      type: 'ONE_TIME';
      cronExpr: null;
      runAt: Date;
    });
