export type ToolName = 'get_current_time';

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
