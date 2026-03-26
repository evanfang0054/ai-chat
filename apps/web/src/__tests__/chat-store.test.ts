import { afterEach, describe, expect, it } from 'vitest';
import { useChatStore } from '../stores/chat-store';

afterEach(() => {
  useChatStore.getState().reset();
});

describe('chat-store', () => {
  it('applies started delta and completed events to current session', () => {
    const store = useChatStore.getState();
    const now = new Date().toISOString();

    store.applyStreamStarted(
      {
        id: 'session-1',
        title: 'Hello',
        model: 'deepseek-chat',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'msg-user',
        sessionId: 'session-1',
        role: 'USER',
        content: 'Hello',
        createdAt: now
      }
    );

    store.applyStreamDelta('Hi');
    store.applyStreamDelta(' there');

    store.applyStreamCompleted(
      {
        id: 'session-1',
        title: 'Hello',
        model: 'deepseek-chat',
        createdAt: now,
        updatedAt: now
      },
      {
        id: 'msg-assistant',
        sessionId: 'session-1',
        role: 'ASSISTANT',
        content: 'Hi there',
        createdAt: now
      }
    );

    const state = useChatStore.getState();
    expect(state.currentSessionId).toBe('session-1');
    expect(state.messages).toHaveLength(2);
    expect(state.messages[1].content).toBe('Hi there');
    expect(state.isStreaming).toBe(false);
  });
});
