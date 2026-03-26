export interface AgentHistoryMessage {
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
}

export interface StreamChatReplyInput {
  history: AgentHistoryMessage[];
  prompt: string;
}

export type AgentStreamEvent =
  | { type: 'text_delta'; delta: string }
  | { type: 'run_completed' };
