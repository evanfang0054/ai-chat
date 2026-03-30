import type {
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
}

export type AgentStreamEvent =
  | { type: 'tool_started'; toolExecution: ToolExecutionRunningSummary }
  | { type: 'tool_completed'; toolExecution: ToolExecutionSucceededSummary }
  | { type: 'tool_failed'; toolExecution: ToolExecutionFailedSummary }
  | { type: 'text_delta'; delta: string }
  | { type: 'run_completed' };
