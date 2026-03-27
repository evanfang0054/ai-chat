export type ScheduleType = 'CRON' | 'ONE_TIME';

export type ScheduleRunStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

interface ScheduleSummaryBase {
  id: string;
  title: string;
  taskPrompt: string;
  timezone: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CronScheduleSummary = ScheduleSummaryBase & {
  type: 'CRON';
  cronExpr: string;
  runAt: null;
};

export type OneTimeScheduleSummary = ScheduleSummaryBase & {
  type: 'ONE_TIME';
  cronExpr: null;
  runAt: string;
};

export type ScheduleSummary = CronScheduleSummary | OneTimeScheduleSummary;

export interface ScheduleReference {
  id: string;
  title: string;
  type: ScheduleType;
}

interface ScheduleRunSummaryBase {
  id: string;
  scheduleId: string;
  userId: string;
  taskPromptSnapshot: string;
  chatSessionId: string | null;
  createdAt: string;
  schedule: ScheduleReference;
}

export type PendingScheduleRunSummary = ScheduleRunSummaryBase & {
  status: 'PENDING';
  resultSummary: null;
  errorMessage: null;
  startedAt: null;
  finishedAt: null;
};

export type RunningScheduleRunSummary = ScheduleRunSummaryBase & {
  status: 'RUNNING';
  resultSummary: null;
  errorMessage: null;
  startedAt: string;
  finishedAt: null;
};

export type SucceededScheduleRunSummary = ScheduleRunSummaryBase & {
  status: 'SUCCEEDED';
  resultSummary: string;
  errorMessage: null;
  startedAt: string;
  finishedAt: string;
};

export type FailedScheduleRunSummary = ScheduleRunSummaryBase & {
  status: 'FAILED';
  resultSummary: null;
  errorMessage: string;
  startedAt: string;
  finishedAt: string;
};

export type ScheduleRunSummary =
  | PendingScheduleRunSummary
  | RunningScheduleRunSummary
  | SucceededScheduleRunSummary
  | FailedScheduleRunSummary;

export type CreateScheduleRequest =
  | {
      title: string;
      taskPrompt: string;
      type: 'CRON';
      cronExpr: string;
      runAt?: never;
      timezone?: string;
    }
  | {
      title: string;
      taskPrompt: string;
      type: 'ONE_TIME';
      cronExpr?: never;
      runAt: string;
      timezone?: string;
    };

interface UpdateScheduleRequestBase {
  title?: string;
  taskPrompt?: string;
  timezone?: string;
  enabled?: boolean;
}

export type UpdateScheduleRequest = UpdateScheduleRequestBase &
  (
    | {
        type?: undefined;
        cronExpr?: string;
        runAt?: string;
      }
    | {
        type: 'CRON';
        cronExpr: string;
        runAt?: never;
      }
    | {
        type: 'ONE_TIME';
        cronExpr?: never;
        runAt: string;
      }
  );

export interface ListSchedulesResponse {
  schedules: ScheduleSummary[];
}

export interface DeleteScheduleResponse {
  deletedScheduleId: string;
}

export interface ListScheduleRunsResponse {
  runs: ScheduleRunSummary[];
}

export interface GetScheduleRunResponse {
  run: ScheduleRunSummary;
}
