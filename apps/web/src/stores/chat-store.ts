import { create } from 'zustand';
import type { ChatMessage, ChatSessionSummary, ToolExecutionSummary } from '@ai-chat/shared';

type ChatState = {
  sessions: ChatSessionSummary[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  toolExecutions: ToolExecutionSummary[];
  draft: string;
  isStreaming: boolean;
  error: string | null;
  reset: () => void;
  setSessions: (sessions: ChatSessionSummary[]) => void;
  setCurrentSession: (sessionId: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setDraft: (draft: string) => void;
  applyRunStarted: (session: ChatSessionSummary, userMessage: ChatMessage) => void;
  applyToolStarted: (toolExecution: ToolExecutionSummary) => void;
  applyToolCompleted: (toolExecution: ToolExecutionSummary) => void;
  applyToolFailed: (toolExecution: ToolExecutionSummary) => void;
  applyTextDelta: (delta: string) => void;
  applyRunCompleted: (session: ChatSessionSummary, message: ChatMessage) => void;
  applyRunFailed: (message: string) => void;
};

const STREAMING_MESSAGE_ID = '__streaming__';

const emptyAssistantMessage = (sessionId: string): ChatMessage => ({
  id: STREAMING_MESSAGE_ID,
  sessionId,
  role: 'ASSISTANT',
  content: '',
  createdAt: new Date().toISOString()
});

const upsertToolExecution = (
  toolExecutions: ToolExecutionSummary[],
  toolExecution: ToolExecutionSummary
): ToolExecutionSummary[] => {
  const next = toolExecutions.filter((item) => item.id !== toolExecution.id);
  return [...next, toolExecution];
};

const initialState = {
  sessions: [],
  currentSessionId: null,
  messages: [],
  toolExecutions: [],
  draft: '',
  isStreaming: false,
  error: null
} satisfies Pick<
  ChatState,
  'sessions' | 'currentSessionId' | 'messages' | 'toolExecutions' | 'draft' | 'isStreaming' | 'error'
>;

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,
  reset: () => set(initialState),
  setSessions: (sessions) => set({ sessions }),
  setCurrentSession: (currentSessionId) => set({ currentSessionId, messages: [], toolExecutions: [], error: null }),
  setMessages: (messages) => set({ messages, toolExecutions: [] }),
  setDraft: (draft) => set({ draft }),
  applyRunStarted: (session, userMessage) =>
    set((state) => ({
      currentSessionId: session.id,
      sessions: [session, ...state.sessions.filter((item) => item.id !== session.id)],
      messages: [userMessage, emptyAssistantMessage(session.id)],
      toolExecutions: [],
      isStreaming: true,
      error: null,
      draft: ''
    })),
  applyToolStarted: (toolExecution) =>
    set((state) => ({
      toolExecutions: upsertToolExecution(state.toolExecutions, toolExecution)
    })),
  applyToolCompleted: (toolExecution) =>
    set((state) => ({
      toolExecutions: upsertToolExecution(state.toolExecutions, toolExecution)
    })),
  applyToolFailed: (toolExecution) =>
    set((state) => ({
      toolExecutions: upsertToolExecution(state.toolExecutions, toolExecution)
    })),
  applyTextDelta: (delta) =>
    set((state) => ({
      messages: state.messages.some((message) => message.id === STREAMING_MESSAGE_ID)
        ? state.messages.map((message) =>
            message.id === STREAMING_MESSAGE_ID ? { ...message, content: `${message.content}${delta}` } : message
          )
        : state.messages
    })),
  applyRunCompleted: (session, message) =>
    set((state) => ({
      sessions: [session, ...state.sessions.filter((item) => item.id !== session.id)],
      messages: state.messages.map((item) => (item.id === STREAMING_MESSAGE_ID ? message : item)),
      isStreaming: false
    })),
  applyRunFailed: (message) =>
    set((state) => ({
      messages: state.messages.filter((item) => item.id !== STREAMING_MESSAGE_ID),
      isStreaming: false,
      error: message
    }))
}));
