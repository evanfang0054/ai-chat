import type { FailureCategory } from './schedule';

export type ToolName = 'get_current_time' | 'manage_schedule';

export type ToolExecutionStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED';

export interface ToolExecutionSummary {
  id: string;
  sessionId: string;
  runId: string | null;
  messageId: string | null;
  toolName: ToolName;
  status: ToolExecutionStatus;
  progressMessage: string | null;
  input: string | null;
  output: string | null;
  partialOutput: string | null;
  errorCategory: FailureCategory | null;
  errorMessage: string | null;
  canRetry: boolean;
  canCancel: boolean;
  startedAt: string | null;
  finishedAt: string | null;
}

export type ToolExecutionRunningSummary = Omit<
  ToolExecutionSummary,
  'status' | 'output' | 'errorCategory' | 'errorMessage' | 'startedAt' | 'finishedAt'
> & {
  status: 'RUNNING';
  output: null;
  errorCategory: null;
  errorMessage: null;
  startedAt: string;
  finishedAt: null;
};

export type ToolExecutionSucceededSummary = Omit<
  ToolExecutionSummary,
  'status' | 'errorCategory' | 'errorMessage' | 'startedAt' | 'finishedAt'
> & {
  status: 'SUCCEEDED';
  errorCategory: null;
  errorMessage: null;
  startedAt: string;
  finishedAt: string;
};

export type ToolExecutionFailedSummary = Omit<
  ToolExecutionSummary,
  'status' | 'errorCategory' | 'errorMessage' | 'startedAt' | 'finishedAt'
> & {
  status: 'FAILED';
  errorCategory: FailureCategory;
  errorMessage: string;
  startedAt: string;
  finishedAt: string;
};
