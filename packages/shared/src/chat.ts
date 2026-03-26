export type ChatMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export interface ChatSessionSummary {
  id: string;
  title: string;
  model: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  createdAt: string;
}

export interface ListChatSessionsResponse {
  sessions: ChatSessionSummary[];
}

export interface GetChatMessagesResponse {
  session: ChatSessionSummary;
  messages: ChatMessage[];
}

export interface SendChatMessageRequest {
  sessionId?: string;
  content: string;
}

export interface ChatRunStartedEvent {
  type: 'run_started';
  session: ChatSessionSummary;
  userMessage: ChatMessage;
}

export interface ChatTextDeltaEvent {
  type: 'text_delta';
  delta: string;
}

export interface ChatRunCompletedEvent {
  type: 'run_completed';
  session: ChatSessionSummary;
  message: ChatMessage;
}

export interface ChatRunFailedEvent {
  type: 'run_failed';
  message: string;
}

export type ChatStreamEvent =
  | ChatRunStartedEvent
  | ChatTextDeltaEvent
  | ChatRunCompletedEvent
  | ChatRunFailedEvent;
