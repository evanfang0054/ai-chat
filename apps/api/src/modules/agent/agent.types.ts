import type {
  ErrorCategory,
  ToolExecutionFailedSummary,
  ToolExecutionRunningSummary,
  ToolExecutionSucceededSummary,
  ToolName
} from '@ai-chat/shared';

export interface AgentHistoryMessage {
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
}

export interface ForcedToolCall {
  name: ToolName;
  input: Record<string, unknown>;
}

export interface StreamChatReplyInput {
  userId: string;
  sessionId: string;
  history: AgentHistoryMessage[];
  prompt: string;
  forcedToolCall?: ForcedToolCall;
  scheduleId?: string;
  runId?: string;
}

export interface AgentExecutionContext {
  userId: string;
  sessionId: string;
  scheduleId: string | null;
  runId: string | null;
}

export interface AgentFailureDetails {
  stage: 'LLM' | 'TOOL';
  errorCategory: ErrorCategory;
  errorMessage: string;
}

export type AgentStreamEvent =
  | { type: 'text-delta'; textDelta: string }
  | { type: 'tool-input-start'; toolExecution: ToolExecutionRunningSummary }
  | { type: 'tool-input-available'; toolExecution: ToolExecutionRunningSummary }
  | { type: 'tool-output-available'; toolExecution: ToolExecutionSucceededSummary }
  | { type: 'tool-output-error'; toolExecution: ToolExecutionFailedSummary }
  | { type: 'agent-error'; error: AgentFailureDetails }
  | { type: 'finish' };
