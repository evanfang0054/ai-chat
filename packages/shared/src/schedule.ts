export type ScheduleType = 'CRON' | 'ONE_TIME' | 'INTERVAL';

export type ErrorCategory = 'USER_ERROR' | 'EXTERNAL_ERROR' | 'INTERNAL_ERROR';

export type RunStage = 'QUEUED' | 'AGENT' | 'LLM' | 'TOOL' | 'PERSISTENCE' | 'COMPLETED';

export type ScheduleRunStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

interface ScheduleSummaryBase {
  id: string;
  title: string;
  taskPrompt: string;
  timezone: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  latestRunStatus: ScheduleRunStatus | null;
  latestFailureMessage: string | null;
  latestResultSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

export type CronScheduleSummary = ScheduleSummaryBase & {
  type: 'CRON';
  cronExpr: string;
  intervalMs: null;
  runAt: null;
};

export type OneTimeScheduleSummary = ScheduleSummaryBase & {
  type: 'ONE_TIME';
  cronExpr: null;
  intervalMs: null;
  runAt: string;
};

export type IntervalScheduleSummary = ScheduleSummaryBase & {
  type: 'INTERVAL';
  cronExpr: null;
  intervalMs: number;
  runAt: null;
};

export type ScheduleSummary = CronScheduleSummary | OneTimeScheduleSummary | IntervalScheduleSummary;

export interface ScheduleReference {
  id: string;
  title: string;
  type: ScheduleType;
}

export interface RunDiagnosticsSummary {
  stage: RunStage;
  errorCategory: ErrorCategory | null;
  triggerSource: 'SCHEDULE' | 'MANUAL_RETRY';
  durationMs: number | null;
  toolExecutionCount: number;
}

export interface RunToolExecutionSummary {
  id: string;
  toolName: string;
  status: 'SUCCEEDED' | 'FAILED';
  errorCategory: ErrorCategory | null;
}

interface ScheduleRunSummaryBase extends RunDiagnosticsSummary {
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
  stage: 'QUEUED';
  errorCategory: null;
  triggerSource: 'SCHEDULE' | 'MANUAL_RETRY';
  durationMs: null;
  toolExecutionCount: number;
  resultSummary: null;
  errorMessage: null;
  startedAt: null;
  finishedAt: null;
};

export type RunningScheduleRunSummary = ScheduleRunSummaryBase & {
  status: 'RUNNING';
  stage: Exclude<RunStage, 'QUEUED' | 'COMPLETED'>;
  errorCategory: null;
  triggerSource: 'SCHEDULE' | 'MANUAL_RETRY';
  durationMs: null;
  toolExecutionCount: number;
  resultSummary: null;
  errorMessage: null;
  startedAt: string;
  finishedAt: null;
};

export type SucceededScheduleRunSummary = ScheduleRunSummaryBase & {
  status: 'SUCCEEDED';
  stage: 'COMPLETED';
  errorCategory: null;
  triggerSource: 'SCHEDULE' | 'MANUAL_RETRY';
  durationMs: number;
  toolExecutionCount: number;
  resultSummary: string;
  errorMessage: null;
  startedAt: string;
  finishedAt: string;
};

export type FailedScheduleRunSummary = ScheduleRunSummaryBase & {
  status: 'FAILED';
  stage: Exclude<RunStage, 'QUEUED' | 'COMPLETED'>;
  errorCategory: ErrorCategory;
  triggerSource: 'SCHEDULE' | 'MANUAL_RETRY';
  durationMs: number;
  toolExecutionCount: number;
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
      intervalMs?: never;
      runAt?: never;
      timezone?: string;
    }
  | {
      title: string;
      taskPrompt: string;
      type: 'ONE_TIME';
      cronExpr?: never;
      intervalMs?: never;
      runAt: string;
      timezone?: string;
    }
  | {
      title: string;
      taskPrompt: string;
      type: 'INTERVAL';
      cronExpr?: never;
      intervalMs: number;
      runAt?: never;
      timezone?: string;
    };

interface UpdateScheduleRequestBase {
  title?: string;
  taskPrompt?: string;
  timezone?: string;
  enabled?: boolean;
}

export type UpdateScheduleRequest = UpdateScheduleRequestBase & {
  type?: ScheduleType;
  cronExpr?: string;
  intervalMs?: number;
  runAt?: string;
};

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
  run: ScheduleRunSummary & {
    toolExecutions?: RunToolExecutionSummary[];
  };
}

export interface RetryScheduleRunResponse {
  run: ScheduleRunSummary;
}
