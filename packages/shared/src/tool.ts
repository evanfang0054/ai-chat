export type ToolName = 'get_current_time' | 'manage_schedule';

export type ToolExecutionStatus = 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface ToolExecutionSummary {
  id: string;
  sessionId: string;
  toolName: ToolName;
  status: ToolExecutionStatus;
  input: string | null;
  output: string | null;
  errorMessage: string | null;
  startedAt: string | null;
  finishedAt: string | null;
}

export type ToolExecutionRunningSummary = Omit<
  ToolExecutionSummary,
  'status' | 'output' | 'errorMessage' | 'startedAt' | 'finishedAt'
> & {
  status: 'RUNNING';
  output: null;
  errorMessage: null;
  startedAt: string;
  finishedAt: null;
};

export type ToolExecutionSucceededSummary = Omit<
  ToolExecutionSummary,
  'status' | 'errorMessage' | 'startedAt' | 'finishedAt'
> & {
  status: 'SUCCEEDED';
  errorMessage: null;
  startedAt: string;
  finishedAt: string;
};

export type ToolExecutionFailedSummary = Omit<
  ToolExecutionSummary,
  'status' | 'errorMessage' | 'startedAt' | 'finishedAt'
> & {
  status: 'FAILED';
  errorMessage: string;
  startedAt: string;
  finishedAt: string;
};
