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

export interface ChatStreamStartedEvent {
  type: 'started';
  session: ChatSessionSummary;
  userMessage: ChatMessage;
}

export interface ChatStreamDeltaEvent {
  type: 'delta';
  delta: string;
}

export interface ChatStreamCompletedEvent {
  type: 'completed';
  session: ChatSessionSummary;
  message: ChatMessage;
}

export interface ChatStreamErrorEvent {
  type: 'error';
  message: string;
}

export type ChatStreamEvent =
  | ChatStreamStartedEvent
  | ChatStreamDeltaEvent
  | ChatStreamCompletedEvent
  | ChatStreamErrorEvent;
