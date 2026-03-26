import { afterEach, describe, expect, it } from 'vitest';
import { useChatStore } from '../stores/chat-store';

afterEach(() => {
  useChatStore.getState().reset();
});

describe('chat-store', () => {
  it('applies run events to current session', () => {
    const store = useChatStore.getState();
    const now = new Date().toISOString();
    const session = {
      id: 'session-1',
      title: 'Hello',
      model: 'deepseek-chat',
      createdAt: now,
      updatedAt: now
    };
    const userMessage = {
      id: 'msg-user',
      sessionId: 'session-1',
      role: 'USER' as const,
      content: 'Hello',
      createdAt: now
    };
    const assistantMessage = {
      id: 'msg-assistant',
      sessionId: 'session-1',
      role: 'ASSISTANT' as const,
      content: 'Hi there',
      createdAt: now
    };

    store.applyRunStarted(session, userMessage);
    expect(useChatStore.getState().isStreaming).toBe(true);

    store.applyTextDelta('Hello');
    expect(useChatStore.getState().messages.at(-1)?.content).toBe('Hello');

    store.applyTextDelta(' there');
    store.applyRunCompleted(session, assistantMessage);

    const state = useChatStore.getState();
    expect(state.currentSessionId).toBe('session-1');
    expect(state.messages).toHaveLength(2);
    expect(state.messages[1].content).toBe('Hi there');
    expect(state.isStreaming).toBe(false);

    store.applyRunStarted(session, userMessage);
    store.applyRunFailed('Chat stream failed');
    expect(useChatStore.getState().error).toBe('Chat stream failed');
  });
});
