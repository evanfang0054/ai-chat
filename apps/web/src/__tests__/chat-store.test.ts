import { afterEach, describe, expect, it } from 'vitest';
import { useChatStore } from '../stores/chat-store';

afterEach(() => {
  useChatStore.getState().reset();
});

describe('chat-store', () => {
  it('sets and upserts sessions', () => {
    const store = useChatStore.getState();
    const now = new Date().toISOString();
    const sessionOne = {
      id: 'session-1',
      title: 'First',
      model: 'deepseek-chat',
      createdAt: now,
      updatedAt: now
    };
    const sessionTwo = {
      id: 'session-2',
      title: 'Second',
      model: 'deepseek-chat',
      createdAt: now,
      updatedAt: now
    };

    store.setSessions([sessionOne]);
    expect(useChatStore.getState().sessions).toEqual([sessionOne]);

    store.upsertSession(sessionTwo);
    expect(useChatStore.getState().sessions).toEqual([sessionTwo, sessionOne]);

    store.upsertSession({ ...sessionOne, title: 'First updated' });
    expect(useChatStore.getState().sessions).toEqual([
      { ...sessionOne, title: 'First updated' },
      sessionTwo
    ]);
  });

  it('tracks current session and resets state', () => {
    const store = useChatStore.getState();
    const now = new Date().toISOString();

    store.setSessions([
      {
        id: 'session-1',
        title: 'First',
        model: 'deepseek-chat',
        createdAt: now,
        updatedAt: now
      }
    ]);
    store.setCurrentSession('session-1');

    expect(useChatStore.getState().currentSessionId).toBe('session-1');

    store.reset();

    expect(useChatStore.getState()).toMatchObject({
      sessions: [],
      currentSessionId: null
    });
  });
});
