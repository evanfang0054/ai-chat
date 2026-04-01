import { afterEach, describe, expect, it, vi } from 'vitest';
import type { UIMessage } from 'ai';
import type { ChatRunEvent, GetChatTimelineResponse, RunSummary, ToolExecutionSummary } from '@ai-chat/shared';
import * as chatService from '../services/chat';
import { useChatStore } from '../stores/chat-store';

function createTimelinePayload(sessionId: string, content: string, assistantContent?: string): GetChatTimelineResponse {
  const now = new Date().toISOString();
  const session = {
    id: sessionId,
    title: sessionId === 'session-2' ? 'Second' : 'First',
    model: 'deepseek-chat',
    createdAt: now,
    updatedAt: now
  };
  const userMessage = {
    id: `msg-${sessionId}`,
    sessionId,
    runId: null,
    role: 'USER' as const,
    content,
    createdAt: now
  };
  const assistantMessage = assistantContent
    ? {
        id: `msg-${sessionId}-assistant`,
        sessionId,
        runId: `run-${sessionId}`,
        role: 'ASSISTANT' as const,
        content: assistantContent,
        createdAt: now
      }
    : null;

  return {
    session,
    run: assistantMessage
      ? {
          id: `run-${sessionId}`,
          sessionId,
          messageId: assistantMessage.id,
          scheduleId: null,
          status: 'COMPLETED',
          stage: 'FINALIZING',
          triggerSource: 'USER',
          failureCategory: null,
          failureCode: null,
          failureMessage: null,
          startedAt: now,
          finishedAt: now
        }
      : null,
    messages: [userMessage, ...(assistantMessage ? [assistantMessage] : [])],
    toolExecutions: assistantMessage
      ? [
          {
            id: `tool-${sessionId}`,
            sessionId,
            runId: `run-${sessionId}`,
            messageId: assistantMessage.id,
            toolName: 'manage_schedule',
            status: 'SUCCEEDED',
            progressMessage: null,
            input: JSON.stringify({ query: content }),
            output: JSON.stringify({ result: assistantContent ?? '' }),
            partialOutput: null,
            errorCategory: null,
            errorMessage: null,
            canRetry: false,
            canCancel: false,
            startedAt: now,
            finishedAt: now
          }
        ]
      : [],
    timeline: []
  };
}

afterEach(() => {
  useChatStore.getState().reset();
  vi.restoreAllMocks();
});

describe('chat store', () => {
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
    expect(useChatStore.getState().sessions).toEqual([{ ...sessionOne, title: 'First updated' }, sessionTwo]);
  });

  it('tracks chat draft, messages, stream state, and resets state', () => {
    const store = useChatStore.getState();
    const now = new Date().toISOString();
    const messages: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello AI',
        parts: [{ type: 'text', text: 'Hello AI' }]
      }
    ];

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
    store.setMessages(messages);
    store.setDraftInput('draft');
    store.setLastSubmittedMessage('Hello AI');
    store.setStreamStreaming();

    expect(useChatStore.getState()).toMatchObject({
      currentSessionId: 'session-1',
      messages,
      draftInput: 'draft',
      lastSubmittedMessage: 'Hello AI',
      streamUiState: 'STREAMING',
      streamErrorMessage: null
    });

    store.setStreamFailed('发送失败');
    expect(useChatStore.getState()).toMatchObject({
      streamUiState: 'FAILED',
      streamErrorMessage: '发送失败'
    });

    store.clearMessages();
    store.setStreamIdle();
    expect(useChatStore.getState()).toMatchObject({
      messages: [],
      streamUiState: 'IDLE',
      streamErrorMessage: null
    });

    store.reset();

    expect(useChatStore.getState()).toMatchObject({
      sessions: [],
      currentSessionId: null,
      messages: [],
      currentRun: null,
      toolExecutions: [],
      draftInput: '',
      lastSubmittedMessage: null,
      streamUiState: 'IDLE',
      streamErrorMessage: null
    });
  });

  it('binds runtime exits and syncs runtime status', () => {
    const store = useChatStore.getState();
    const append = vi.fn();
    const replaceMessages = vi.fn();
    const messages: UIMessage[] = [
      {
        id: 'msg-1',
        role: 'assistant',
        content: 'Hi there',
        parts: [{ type: 'text', text: 'Hi there' }]
      }
    ];

    store.bindRuntime({ append, replaceMessages, status: 'ready' });
    store.replaceRuntimeMessages(messages);
    expect(replaceMessages).toHaveBeenCalledWith(messages);

    store.syncRuntime({ status: 'submitted', messages });
    expect(useChatStore.getState()).toMatchObject({
      messages,
      streamUiState: 'STREAMING',
      streamErrorMessage: null,
      runtime: {
        append,
        replaceMessages,
        status: 'submitted'
      }
    });

    store.syncRuntime({ status: 'ready' });
    expect(useChatStore.getState()).toMatchObject({
      streamUiState: 'IDLE',
      streamErrorMessage: null,
      runtime: {
        append,
        replaceMessages,
        status: 'ready'
      }
    });

    store.clearRuntime();
    expect(useChatStore.getState().runtime).toEqual({
      append: null,
      replaceMessages: null,
      status: 'ready'
    });
  });

  it('hydrates timeline into messages, current run, and tool executions', () => {
    const store = useChatStore.getState();
    const timeline = createTimelinePayload('session-2', 'Hello AI', 'Hi there');

    store.setSessions([
      {
        id: 'session-1',
        title: 'First',
        model: 'deepseek-chat',
        createdAt: timeline.session.createdAt,
        updatedAt: timeline.session.updatedAt
      }
    ]);

    const messages = store.hydrateTimeline(timeline);

    expect(messages).toMatchObject([
      { id: 'msg-session-2', role: 'user', content: 'Hello AI' },
      { id: 'msg-session-2-assistant', role: 'assistant', content: 'Hi there' }
    ]);
    expect(useChatStore.getState()).toMatchObject({
      currentSessionId: 'session-2',
      currentRun: expect.objectContaining({ id: 'run-session-2', status: 'COMPLETED' }),
      toolExecutions: [expect.objectContaining({ id: 'tool-session-2', toolName: 'manage_schedule' })],
      messages
    });
    expect(useChatStore.getState().sessions).toEqual([
      timeline.session,
      {
        id: 'session-1',
        title: 'First',
        model: 'deepseek-chat',
        createdAt: timeline.session.createdAt,
        updatedAt: timeline.session.updatedAt
      }
    ]);
  });

  it('applies stream events through a single store entrypoint', () => {
    const store = useChatStore.getState();
    const now = new Date().toISOString();
    const runStartedRun: RunSummary = {
      id: 'run-1',
      sessionId: 'session-1',
      messageId: 'msg-assistant',
      scheduleId: null,
      status: 'RUNNING',
      stage: 'ROUTING',
      triggerSource: 'USER',
      failureCategory: null,
      failureCode: null,
      failureMessage: null,
      startedAt: now,
      finishedAt: null
    };
    const runStartedEvent: ChatRunEvent = {
      type: 'run_started',
      session: {
        id: 'session-1',
        title: 'First',
        model: 'deepseek-chat',
        createdAt: now,
        updatedAt: now
      },
      run: runStartedRun,
      message: {
        id: 'msg-user',
        sessionId: 'session-1',
        runId: null,
        role: 'USER',
        content: 'Hello AI',
        createdAt: now
      }
    };
    const toolStartedExecution: ToolExecutionSummary = {
      id: 'tool-1',
      sessionId: 'session-1',
      runId: 'run-1',
      messageId: 'msg-assistant',
      toolName: 'manage_schedule',
      status: 'RUNNING',
      progressMessage: 'Searching',
      input: JSON.stringify({ query: 'Hello AI' }),
      output: null,
      partialOutput: null,
      errorCategory: null,
      errorMessage: null,
      canRetry: false,
      canCancel: true,
      startedAt: now,
      finishedAt: null
    };
    const toolStartedEvent: ChatRunEvent = {
      type: 'tool_started',
      toolExecution: toolStartedExecution
    };
    const toolCompletedEvent: ChatRunEvent = {
      type: 'tool_completed',
      toolExecution: {
        ...toolStartedExecution,
        status: 'SUCCEEDED',
        canCancel: false,
        output: JSON.stringify({ result: 'Found' }),
        finishedAt: now
      }
    };
    const runCompletedEvent: ChatRunEvent = {
      type: 'run_completed',
      run: {
        ...runStartedRun,
        status: 'COMPLETED',
        stage: 'FINALIZING',
        finishedAt: now
      },
      message: {
        id: 'msg-assistant',
        sessionId: 'session-1',
        runId: 'run-1',
        role: 'ASSISTANT',
        content: 'Hi there',
        createdAt: now
      }
    };

    store.applyStreamEvent(runStartedEvent);
    expect(useChatStore.getState()).toMatchObject({
      currentSessionId: 'session-1',
      currentRun: expect.objectContaining({ id: 'run-1', status: 'RUNNING', stage: 'ROUTING' }),
      streamUiState: 'STREAMING'
    });

    store.applyStreamEvent(toolStartedEvent);
    expect(useChatStore.getState().toolExecutions).toEqual([
      expect.objectContaining({ id: 'tool-1', status: 'RUNNING', progressMessage: 'Searching' })
    ]);

    store.applyStreamEvent({
      type: 'text_delta',
      runId: 'run-1',
      messageId: 'msg-assistant',
      textDelta: 'Hi'
    });
    store.applyStreamEvent({
      type: 'text_delta',
      runId: 'run-1',
      messageId: 'msg-assistant',
      textDelta: ' there'
    });
    expect(useChatStore.getState().messages).toMatchObject([
      { id: 'msg-user', role: 'user', content: 'Hello AI' },
      { id: 'msg-assistant', role: 'assistant', content: 'Hi there' }
    ]);

    store.applyStreamEvent(toolCompletedEvent);
    expect(useChatStore.getState().toolExecutions).toEqual([
      expect.objectContaining({ id: 'tool-1', status: 'SUCCEEDED' })
    ]);

    store.applyStreamEvent(runCompletedEvent);
    expect(useChatStore.getState()).toMatchObject({
      currentRun: expect.objectContaining({ id: 'run-1', status: 'COMPLETED', stage: 'FINALIZING' }),
      streamUiState: 'IDLE',
      streamErrorMessage: null
    });
  });

  it('applies failed run events into diagnostics state', () => {
    const store = useChatStore.getState();
    const now = new Date().toISOString();

    store.applyStreamEvent({
      type: 'run_started',
      session: {
        id: 'session-1',
        title: 'First',
        model: 'deepseek-chat',
        createdAt: now,
        updatedAt: now
      },
      run: {
        id: 'run-1',
        sessionId: 'session-1',
        messageId: 'msg-assistant',
        scheduleId: null,
        status: 'RUNNING',
        stage: 'TOOL_RUNNING',
        triggerSource: 'USER',
        failureCategory: null,
        failureCode: null,
        failureMessage: null,
        startedAt: now,
        finishedAt: null
      },
      message: {
        id: 'msg-user',
        sessionId: 'session-1',
        runId: null,
        role: 'USER',
        content: 'Hello AI',
        createdAt: now
      }
    });

    store.applyStreamEvent({
      type: 'run_failed',
      run: {
        id: 'run-1',
        sessionId: 'session-1',
        messageId: 'msg-assistant',
        scheduleId: null,
        status: 'FAILED',
        stage: 'TOOL_RUNNING',
        triggerSource: 'USER',
        failureCategory: 'TOOL_ERROR',
        failureCode: 'tool_failed',
        failureMessage: '发送失败',
        startedAt: now,
        finishedAt: now
      }
    });

    expect(useChatStore.getState()).toMatchObject({
      currentRun: expect.objectContaining({ id: 'run-1', status: 'FAILED', failureMessage: '发送失败' }),
      streamUiState: 'FAILED',
      streamErrorMessage: '发送失败'
    });
  });

  it('initializes sessions and prefers requested session id', async () => {
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

    vi.spyOn(chatService, 'listChatSessions').mockResolvedValue({ sessions: [sessionOne, sessionTwo] });

    await expect(useChatStore.getState().initializeSessions('token-123', 'session-2')).resolves.toBe('session-2');
    expect(useChatStore.getState()).toMatchObject({
      sessions: [sessionOne, sessionTwo],
      currentSessionId: 'session-2'
    });
  });

  it('loads timeline messages into store and promotes timeline session', async () => {
    const timeline = createTimelinePayload('session-2', 'Hello AI', 'Hi there');

    useChatStore.getState().setSessions([
      {
        id: 'session-1',
        title: 'First',
        model: 'deepseek-chat',
        createdAt: timeline.session.createdAt,
        updatedAt: timeline.session.updatedAt
      }
    ]);

    vi.spyOn(chatService, 'getChatMessages').mockResolvedValue(timeline);

    const messages = await useChatStore.getState().loadSessionMessages('token-123', 'session-2');

    expect(messages).toMatchObject([
      { id: 'msg-session-2', role: 'user', content: 'Hello AI' },
      { id: 'msg-session-2-assistant', role: 'assistant', content: 'Hi there' }
    ]);
    expect(useChatStore.getState()).toMatchObject({
      currentSessionId: 'session-2',
      currentRun: expect.objectContaining({ id: 'run-session-2' }),
      toolExecutions: [expect.objectContaining({ id: 'tool-session-2' })],
      messages
    });
  });

  it('initializes chat page and clears runtime messages when no session exists', async () => {
    const replaceMessages = vi.fn();
    useChatStore.getState().bindRuntime({ replaceMessages });
    vi.spyOn(chatService, 'listChatSessions').mockResolvedValue({ sessions: [] });

    await useChatStore.getState().initializeChatPage('token-123', null);

    expect(replaceMessages).toHaveBeenCalledWith([]);
  });

  it('syncs current session messages through the runtime exit', async () => {
    const timeline = createTimelinePayload('session-2', 'Hello AI', 'Hi there');
    const replaceMessages = vi.fn();

    useChatStore.getState().bindRuntime({ replaceMessages });
    useChatStore.getState().setCurrentSession('session-2');
    vi.spyOn(chatService, 'getChatMessages').mockResolvedValue(timeline);

    await useChatStore.getState().syncCurrentSessionMessages('token-123');

    expect(replaceMessages).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'msg-session-2-assistant', role: 'assistant', content: 'Hi there' })
      ])
    );
  });

  it('submits and retries messages through bound runtime append', async () => {
    const append = vi.fn().mockResolvedValue(undefined);
    useChatStore.getState().bindRuntime({ append, status: 'ready' });
    useChatStore.getState().setCurrentSession('session-1');
    useChatStore.getState().setDraftInput('Hello AI');

    await useChatStore.getState().submitMessage('Hello AI', 'token-123');

    expect(append).toHaveBeenCalledWith(
      {
        role: 'user',
        content: 'Hello AI',
        parts: [{ type: 'text', text: 'Hello AI' }]
      },
      {
        body: {
          content: 'Hello AI',
          sessionId: 'session-1'
        }
      }
    );
    expect(useChatStore.getState()).toMatchObject({
      draftInput: '',
      lastSubmittedMessage: 'Hello AI',
      streamUiState: 'IDLE',
      streamErrorMessage: null
    });

    await useChatStore.getState().retryLastMessage('token-123');

    expect(append).toHaveBeenCalledTimes(2);
  });

  it('handles stream finish and stream error through store exits', async () => {
    vi.spyOn(chatService, 'listChatSessions').mockResolvedValue({ sessions: [] });
    useChatStore.getState().setStreamStreaming();

    await useChatStore.getState().handleStreamFinish('token-123');
    expect(useChatStore.getState()).toMatchObject({
      streamUiState: 'IDLE',
      streamErrorMessage: null
    });

    useChatStore.getState().handleStreamError(new Error('发送失败'));
    expect(useChatStore.getState()).toMatchObject({
      streamUiState: 'FAILED',
      streamErrorMessage: '发送失败'
    });
  });

  it('starts a new chat by clearing active chat state and runtime messages', () => {
    const store = useChatStore.getState();
    const replaceMessages = vi.fn();
    const timeline = createTimelinePayload('session-1', 'Hello AI', 'Hi there');

    store.bindRuntime({ replaceMessages });
    store.hydrateTimeline(timeline);
    store.setDraftInput('draft');
    store.setLastSubmittedMessage('Hello AI');
    store.setStreamFailed('发送失败');

    store.startNewChatWithReset();

    expect(replaceMessages).toHaveBeenCalledWith([]);
    expect(useChatStore.getState()).toMatchObject({
      sessions: [
        {
          id: 'session-1',
          title: 'First'
        }
      ],
      currentSessionId: null,
      messages: [],
      currentRun: null,
      toolExecutions: [],
      draftInput: '',
      lastSubmittedMessage: null,
      streamUiState: 'IDLE',
      streamErrorMessage: null
    });
  });
});
