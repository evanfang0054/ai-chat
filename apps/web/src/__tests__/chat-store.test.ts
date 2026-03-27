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

  it('updates tool executions as tool events arrive', () => {
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
      content: 'What time is it?',
      createdAt: now
    };

    store.applyRunStarted(session, userMessage);
    store.applyToolStarted({
      id: 'tool-1',
      sessionId: 'session-1',
      toolName: 'get_current_time',
      status: 'RUNNING',
      input: '{"timezone":"UTC"}',
      output: null,
      errorMessage: null,
      startedAt: now,
      finishedAt: null
    });

    expect(useChatStore.getState().toolExecutions).toEqual([
      expect.objectContaining({ id: 'tool-1', status: 'RUNNING' })
    ]);

    store.applyToolCompleted({
      id: 'tool-1',
      sessionId: 'session-1',
      toolName: 'get_current_time',
      status: 'SUCCEEDED',
      input: '{"timezone":"UTC"}',
      output: '{"now":"2026-03-27T00:00:00.000Z"}',
      errorMessage: null,
      startedAt: now,
      finishedAt: now
    });

    expect(useChatStore.getState().toolExecutions).toEqual([
      expect.objectContaining({ id: 'tool-1', status: 'SUCCEEDED' })
    ]);

    store.applyToolFailed({
      id: 'tool-2',
      sessionId: 'session-1',
      toolName: 'get_current_time',
      status: 'FAILED',
      input: '{"timezone":"UTC"}',
      output: null,
      errorMessage: 'boom',
      startedAt: now,
      finishedAt: now
    });

    expect(useChatStore.getState().toolExecutions).toEqual([
      expect.objectContaining({ id: 'tool-1', status: 'SUCCEEDED' }),
      expect.objectContaining({ id: 'tool-2', status: 'FAILED', errorMessage: 'boom' })
    ]);
  });
});
