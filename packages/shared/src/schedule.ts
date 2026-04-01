export type ScheduleType = 'CRON' | 'ONE_TIME' | 'INTERVAL';

export type RunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export type RunStage =
  | 'PREPARING'
  | 'ROUTING'
  | 'MODEL_CALLING'
  | 'TOOL_RUNNING'
  | 'REPAIRING'
  | 'PERSISTING'
  | 'FINALIZING';

export type RunTriggerSource = 'USER' | 'SCHEDULE' | 'MANUAL_RETRY' | 'DIAGNOSTICS_REPLAY';

export type FailureCategory =
  | 'INPUT_ERROR'
  | 'TOOL_ERROR'
  | 'MODEL_ERROR'
  | 'DEPENDENCY_ERROR'
  | 'TIMEOUT_ERROR'
  | 'SYSTEM_ERROR'
  | 'CANCELLED';

export type ErrorCategory = FailureCategory;
export type ScheduleRunStatus = RunStatus;

export interface RunSummary {
  id: string;
  sessionId: string | null;
  messageId: string | null;
  scheduleId: string | null;
  status: RunStatus;
  stage: RunStage;
  triggerSource: RunTriggerSource;
  failureCategory: FailureCategory | null;
  failureCode: string | null;
  failureMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface RunDiagnosticsSummary extends RunSummary {
  requestId: string | null;
  durationMs: number | null;
  toolExecutionCount: number;
  retryCount: number;
  lastRepairAction: string | null;
}

interface ScheduleSummaryBase {
  id: string;
  title: string;
  taskPrompt: string;
  timezone: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  latestRunId: string | null;
  latestRunStatus: RunStatus | null;
  latestRunStage: RunStage | null;
  latestRunStartedAt: string | null;
  latestRunFinishedAt: string | null;
  latestRequestId: string | null;
  latestSessionId: string | null;
  latestMessageId: string | null;
  latestToolExecutionCount: number;
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

export interface RunToolExecutionSummary {
  id: string;
  runId: string | null;
  messageId: string | null;
  toolName: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';
  errorCategory: FailureCategory | null;
}

export interface ScheduleRunSummary extends RunDiagnosticsSummary {
  scheduleId: string;
  userId: string;
  taskPromptSnapshot: string;
  chatSessionId: string | null;
  scheduleTitle: string;
  resultSummary: string | null;
  createdAt: string;
  schedule: ScheduleReference;
}

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
