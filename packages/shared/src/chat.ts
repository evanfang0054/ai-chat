import type { ToolExecutionSummary } from './tool';

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

export interface GetChatTimelineResponse {
  session: ChatSessionSummary;
  messages: ChatMessage[];
  toolExecutions: ToolExecutionSummary[];
}

export interface SendChatMessageRequest {
  sessionId?: string;
  content: string;
}
