import type {
  ToolExecutionFailedSummary,
  ToolExecutionRunningSummary,
  ToolExecutionSucceededSummary
} from '@ai-chat/shared';

export interface AgentHistoryMessage {
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
}

export interface StreamChatReplyInput {
  userId: string;
  sessionId: string;
  history: AgentHistoryMessage[];
  prompt: string;
}

export type AgentStreamEvent =
  | { type: 'tool_started'; execution: ToolExecutionRunningSummary }
  | { type: 'tool_completed'; execution: ToolExecutionSucceededSummary }
  | { type: 'tool_failed'; execution: ToolExecutionFailedSummary }
  | { type: 'text_delta'; delta: string }
  | { type: 'run_completed' };
