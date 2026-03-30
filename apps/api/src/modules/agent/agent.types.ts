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
  | { type: 'text-delta'; textDelta: string }
  | { type: 'tool-input-start'; toolExecution: ToolExecutionRunningSummary }
  | { type: 'tool-input-available'; toolExecution: ToolExecutionRunningSummary }
  | { type: 'tool-output-available'; toolExecution: ToolExecutionSucceededSummary }
  | { type: 'tool-output-error'; toolExecution: ToolExecutionFailedSummary }
  | { type: 'finish' };
