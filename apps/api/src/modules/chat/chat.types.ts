import type { ChatMessage, ChatSessionSummary } from '@ai-chat/shared';

export interface CurrentUser {
  userId: string;
  email: string;
  role: 'ADMIN' | 'USER';
}

export interface ChatSessionWithMessages {
  session: ChatSessionSummary;
  messages: ChatMessage[];
}
