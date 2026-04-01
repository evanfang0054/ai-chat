import { create } from 'zustand';
import type { UIMessage } from 'ai';
import type {
  ChatMessage,
  ChatRunEvent,
  ChatSessionSummary,
  GetChatTimelineResponse,
  RunSummary,
  ToolExecutionSummary
} from '@ai-chat/shared';
import { createChatRequestBody, createUiMessagesFromTimeline, getChatMessages, listChatSessions } from '../services/chat';

export type StreamUiState = 'IDLE' | 'STREAMING' | 'FAILED';
export type ChatStreamStatus = 'ready' | 'submitted' | 'streaming' | 'error';

type AppendInputMessage = Pick<UIMessage, 'role' | 'content' | 'parts'>;
type AppendMessage = (
  message: AppendInputMessage,
  options?: {
    body?: object;
  }
) => Promise<unknown>;

type ChatRuntime = {
  append: AppendMessage | null;
  replaceMessages: ((messages: UIMessage[]) => void) | null;
  status: ChatStreamStatus;
};

type SyncRuntimeInput = {
  status?: ChatStreamStatus;
  messages?: UIMessage[];
};

type ChatState = {
  sessions: ChatSessionSummary[];
  currentSessionId: string | null;
  messages: UIMessage[];
  currentRun: RunSummary | null;
  toolExecutions: ToolExecutionSummary[];
  draftInput: string;
  lastSubmittedMessage: string | null;
  streamUiState: StreamUiState;
  streamErrorMessage: string | null;
  runtime: ChatRuntime;
  reset: () => void;
  bindRuntime: (runtime: Partial<ChatRuntime>) => void;
  clearRuntime: () => void;
  replaceRuntimeMessages: (messages: UIMessage[]) => void;
  setSessions: (sessions: ChatSessionSummary[]) => void;
  upsertSession: (session: ChatSessionSummary) => void;
  setCurrentSession: (sessionId: string | null) => void;
  setMessages: (messages: UIMessage[]) => void;
  clearMessages: () => void;
  syncLiveMessages: (messages: UIMessage[]) => void;
  syncStreamStatus: (status: ChatStreamStatus) => void;
  syncRuntime: (input: SyncRuntimeInput) => void;
  hydrateTimeline: (timeline: GetChatTimelineResponse) => UIMessage[];
  applyStreamEvent: (event: ChatRunEvent) => void;
  setDraftInput: (value: string) => void;
  setLastSubmittedMessage: (value: string | null) => void;
  setStreamIdle: () => void;
  setStreamStreaming: () => void;
  setStreamFailed: (errorMessage: string) => void;
  initializeSessions: (accessToken: string, requestedSessionId: string | null) => Promise<string | null>;
  loadSessionMessages: (accessToken: string, sessionId: string | null) => Promise<UIMessage[]>;
  refreshSessionsAfterStream: (accessToken: string) => Promise<void>;
  initializeChatPage: (accessToken: string | null, requestedSessionId: string | null) => Promise<void>;
  syncCurrentSessionMessages: (accessToken: string | null) => Promise<void>;
  submitMessage: (content: string, accessToken: string | null) => Promise<void>;
  retryLastMessage: (accessToken: string | null) => Promise<void>;
  handleStreamFinish: (accessToken: string | null) => Promise<void>;
  handleStreamError: (error: Error) => void;
  startNewChat: () => void;
  startNewChatWithReset: () => void;
};

const initialRuntime: ChatRuntime = {
  append: null,
  replaceMessages: null,
  status: 'ready'
};

const initialState = {
  sessions: [],
  currentSessionId: null,
  messages: [],
  currentRun: null,
  toolExecutions: [],
  draftInput: '',
  lastSubmittedMessage: null,
  streamUiState: 'IDLE',
  streamErrorMessage: null,
  runtime: initialRuntime
} satisfies Pick<
  ChatState,
  | 'sessions'
  | 'currentSessionId'
  | 'messages'
  | 'currentRun'
  | 'toolExecutions'
  | 'draftInput'
  | 'lastSubmittedMessage'
  | 'streamUiState'
  | 'streamErrorMessage'
  | 'runtime'
>;

function resolveCurrentSessionId(
  sessions: ChatSessionSummary[],
  preferredSessionId: string | null,
  fallbackSessionId?: string | null
) {
  if (preferredSessionId && sessions.some((session) => session.id === preferredSessionId)) {
    return preferredSessionId;
  }

  if (fallbackSessionId && sessions.some((session) => session.id === fallbackSessionId)) {
    return fallbackSessionId;
  }

  return sessions[0]?.id ?? null;
}

function upsertSession(sessions: ChatSessionSummary[], session: ChatSessionSummary) {
  return [session, ...sessions.filter((item) => item.id !== session.id)];
}

function upsertToolExecution(toolExecutions: ToolExecutionSummary[], toolExecution: ToolExecutionSummary) {
  return [...toolExecutions.filter((item) => item.id !== toolExecution.id), toolExecution].sort((left, right) =>
    left.id.localeCompare(right.id)
  );
}

function toUiRole(role: ChatMessage['role']): UIMessage['role'] {
  return role === 'ASSISTANT' ? 'assistant' : 'user';
}

function toUiMessage(message: ChatMessage): UIMessage {
  return {
    id: message.id,
    role: toUiRole(message.role),
    content: message.content,
    createdAt: new Date(message.createdAt),
    parts: message.content ? [{ type: 'text', text: message.content }] : []
  } satisfies UIMessage;
}

function upsertMessage(messages: UIMessage[], nextMessage: UIMessage) {
  const existingIndex = messages.findIndex((message) => message.id === nextMessage.id);
  if (existingIndex === -1) {
    return [...messages, nextMessage];
  }

  return messages.map((message, index) => (index === existingIndex ? nextMessage : message));
}

function appendTextDelta(messages: UIMessage[], messageId: string, textDelta: string): UIMessage[] {
  const existingMessage = messages.find((message) => message.id === messageId);

  if (!existingMessage) {
    return [
      ...messages,
      {
        id: messageId,
        role: 'assistant',
        content: textDelta,
        parts: [{ type: 'text', text: textDelta }]
      } satisfies UIMessage
    ];
  }

  const content = `${existingMessage.content ?? ''}${textDelta}`;
  return messages.map((message) =>
    message.id === messageId
      ? ({
          ...message,
          content,
          parts: [{ type: 'text', text: content }]
        } satisfies UIMessage)
      : message
  );
}

export const useChatStore = create<ChatState>((set, get) => ({
  ...initialState,
  reset: () => set(initialState),
  bindRuntime: (runtime) =>
    set((state) => ({
      runtime: {
        ...state.runtime,
        ...runtime
      }
    })),
  clearRuntime: () => set({ runtime: initialRuntime }),
  replaceRuntimeMessages: (messages) => {
    get().runtime.replaceMessages?.(messages);
  },
  setSessions: (sessions) => set({ sessions }),
  upsertSession: (session) =>
    set((state) => ({
      sessions: upsertSession(state.sessions, session)
    })),
  setCurrentSession: (currentSessionId) => set({ currentSessionId }),
  setMessages: (messages) => set({ messages }),
  clearMessages: () => set({ messages: [] }),
  syncLiveMessages: (messages) => {
    get().syncRuntime({ messages });
  },
  syncStreamStatus: (status) => {
    get().syncRuntime({ status });
  },
  syncRuntime: ({ status, messages }) => {
    const nextStatus = status ?? get().runtime.status;

    set((state) => ({
      messages: messages ?? state.messages,
      runtime: {
        ...state.runtime,
        ...(status ? { status } : {})
      },
      streamUiState:
        nextStatus === 'submitted' || nextStatus === 'streaming'
          ? 'STREAMING'
          : nextStatus === 'error'
            ? 'FAILED'
            : 'IDLE',
      streamErrorMessage: nextStatus === 'error' ? state.streamErrorMessage ?? '发送失败' : null
    }));
  },
  hydrateTimeline: (timeline) => {
    const messages = createUiMessagesFromTimeline(timeline);
    set((state) => ({
      currentSessionId: timeline.session.id,
      messages,
      currentRun: timeline.run,
      toolExecutions: timeline.toolExecutions,
      sessions: upsertSession(state.sessions, timeline.session)
    }));
    return messages;
  },
  applyStreamEvent: (event) => {
    switch (event.type) {
      case 'run_started': {
        set((state) => ({
          currentSessionId: event.session.id,
          currentRun: event.run,
          messages: upsertMessage(state.messages, toUiMessage(event.message)),
          sessions: upsertSession(state.sessions, event.session),
          streamUiState: 'STREAMING',
          streamErrorMessage: null
        }));
        return;
      }
      case 'run_stage_changed':
      case 'run_repaired': {
        set({ currentRun: event.run });
        return;
      }
      case 'text_delta': {
        set((state) => ({
          messages: appendTextDelta(state.messages, event.messageId, event.textDelta)
        }));
        return;
      }
      case 'tool_started':
      case 'tool_progressed':
      case 'tool_completed': {
        set((state) => ({
          toolExecutions: upsertToolExecution(state.toolExecutions, event.toolExecution)
        }));
        return;
      }
      case 'tool_failed': {
        set((state) => ({
          toolExecutions: upsertToolExecution(state.toolExecutions, event.toolExecution),
          streamUiState: 'FAILED',
          streamErrorMessage: event.toolExecution.errorMessage ?? state.streamErrorMessage
        }));
        return;
      }
      case 'run_completed': {
        set((state) => ({
          currentRun: event.run,
          messages: upsertMessage(state.messages, toUiMessage(event.message)),
          streamUiState: 'IDLE',
          streamErrorMessage: null
        }));
        return;
      }
      case 'run_failed': {
        set({
          currentRun: event.run,
          streamUiState: 'FAILED',
          streamErrorMessage: event.run.failureMessage ?? '发送失败'
        });
      }
    }
  },
  setDraftInput: (draftInput) => set({ draftInput }),
  setLastSubmittedMessage: (lastSubmittedMessage) => set({ lastSubmittedMessage }),
  setStreamIdle: () => set({ streamUiState: 'IDLE', streamErrorMessage: null }),
  setStreamStreaming: () => set({ streamUiState: 'STREAMING', streamErrorMessage: null }),
  setStreamFailed: (streamErrorMessage) => set({ streamUiState: 'FAILED', streamErrorMessage }),
  initializeSessions: async (accessToken, requestedSessionId) => {
    const { sessions } = await listChatSessions(accessToken);
    const currentSessionId = resolveCurrentSessionId(sessions, requestedSessionId, get().currentSessionId);
    set({ sessions, currentSessionId });
    return currentSessionId;
  },
  loadSessionMessages: async (accessToken, sessionId) => {
    if (!sessionId) {
      set({ currentSessionId: null, messages: [], currentRun: null, toolExecutions: [] });
      return [];
    }

    const timeline = await getChatMessages(accessToken, sessionId);
    return get().hydrateTimeline(timeline);
  },
  refreshSessionsAfterStream: async (accessToken) => {
    const { sessions } = await listChatSessions(accessToken);
    const currentSessionId = resolveCurrentSessionId(sessions, get().currentSessionId);
    set({ sessions, currentSessionId });
  },
  initializeChatPage: async (accessToken, requestedSessionId) => {
    if (!accessToken) {
      return;
    }

    const sessionId = await get().initializeSessions(accessToken, requestedSessionId);
    if (!sessionId) {
      get().replaceRuntimeMessages([]);
    }
  },
  syncCurrentSessionMessages: async (accessToken) => {
    if (!accessToken) {
      get().startNewChatWithReset();
      return;
    }

    const nextMessages = await get().loadSessionMessages(accessToken, get().currentSessionId);
    get().replaceRuntimeMessages(nextMessages);
  },
  submitMessage: async (content, accessToken) => {
    const { runtime } = get();
    if (!accessToken || !content.trim() || runtime.status === 'submitted' || runtime.status === 'streaming' || !runtime.append) {
      return;
    }

    const trimmedContent = content.trim();
    set({
      draftInput: '',
      lastSubmittedMessage: trimmedContent,
      streamUiState: 'IDLE',
      streamErrorMessage: null
    });

    await runtime.append(
      {
        role: 'user',
        content: trimmedContent,
        parts: [{ type: 'text', text: trimmedContent }]
      },
      {
        body: createChatRequestBody({
          content: trimmedContent,
          sessionId: get().currentSessionId ?? undefined
        })
      }
    );
  },
  retryLastMessage: async (accessToken) => {
    const lastSubmittedMessage = get().lastSubmittedMessage;
    if (!lastSubmittedMessage) {
      return;
    }

    await get().submitMessage(lastSubmittedMessage, accessToken);
  },
  handleStreamFinish: async (accessToken) => {
    get().setStreamIdle();

    if (!accessToken) {
      return;
    }

    await get().refreshSessionsAfterStream(accessToken);
  },
  handleStreamError: (error) => {
    get().setStreamFailed(error.message || '发送失败，请稍后重试。');
  },
  startNewChat: () =>
    set({
      currentSessionId: null,
      messages: [],
      currentRun: null,
      toolExecutions: [],
      draftInput: '',
      lastSubmittedMessage: null,
      streamUiState: 'IDLE',
      streamErrorMessage: null
    }),
  startNewChatWithReset: () => {
    get().startNewChat();
    get().replaceRuntimeMessages([]);
  }
}));
