import type {
  ChatStreamEvent,
  GetChatMessagesResponse,
  ListChatSessionsResponse,
  SendChatMessageRequest
} from '@ai-chat/shared';
import { apiFetch } from '../lib/api';

export function listChatSessions(accessToken: string) {
  return apiFetch<ListChatSessionsResponse>('/chat/sessions', { accessToken });
}

export function getChatMessages(accessToken: string, sessionId: string) {
  return apiFetch<GetChatMessagesResponse>(`/chat/sessions/${sessionId}/messages`, { accessToken });
}

export async function streamChatMessage(
  accessToken: string,
  payload: SendChatMessageRequest,
  onEvent: (event: ChatStreamEvent) => void
) {
  const text = await apiFetch<string>('/chat/stream', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(payload),
    responseType: 'text'
  });

  for (const block of text.split('\n\n')) {
    const dataLine = block.split('\n').find((line) => line.startsWith('data: '));
    if (!dataLine) {
      continue;
    }

    onEvent(JSON.parse(dataLine.slice(6)) as ChatStreamEvent);
  }
}
