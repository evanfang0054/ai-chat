import { create } from 'zustand';
import type { ChatMessage, ChatSessionSummary } from '@ai-chat/shared';

type ChatState = {
  sessions: ChatSessionSummary[];
  currentSessionId: string | null;
  messages: ChatMessage[];
  draft: string;
  isStreaming: boolean;
  error: string | null;
  reset: () => void;
  setSessions: (sessions: ChatSessionSummary[]) => void;
  setCurrentSession: (sessionId: string | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  setDraft: (draft: string) => void;
  applyStreamStarted: (session: ChatSessionSummary, userMessage: ChatMessage) => void;
  applyStreamDelta: (delta: string) => void;
  applyStreamCompleted: (session: ChatSessionSummary, message: ChatMessage) => void;
  applyStreamError: (message: string) => void;
};

const STREAMING_MESSAGE_ID = '__streaming__';

const emptyAssistantMessage = (sessionId: string): ChatMessage => ({
  id: STREAMING_MESSAGE_ID,
  sessionId,
  role: 'ASSISTANT',
  content: '',
  createdAt: new Date().toISOString()
});

const initialState = {
  sessions: [],
  currentSessionId: null,
  messages: [],
  draft: '',
  isStreaming: false,
  error: null
} satisfies Pick<ChatState, 'sessions' | 'currentSessionId' | 'messages' | 'draft' | 'isStreaming' | 'error'>;

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,
  reset: () => set(initialState),
  setSessions: (sessions) => set({ sessions }),
  setCurrentSession: (currentSessionId) => set({ currentSessionId, messages: [], error: null }),
  setMessages: (messages) => set({ messages }),
  setDraft: (draft) => set({ draft }),
  applyStreamStarted: (session, userMessage) =>
    set((state) => ({
      currentSessionId: session.id,
      sessions: [session, ...state.sessions.filter((item) => item.id !== session.id)],
      messages: [userMessage, emptyAssistantMessage(session.id)],
      isStreaming: true,
      error: null,
      draft: ''
    })),
  applyStreamDelta: (delta) =>
    set((state) => ({
      messages: state.messages.some((message) => message.id === STREAMING_MESSAGE_ID)
        ? state.messages.map((message) =>
            message.id === STREAMING_MESSAGE_ID ? { ...message, content: `${message.content}${delta}` } : message
          )
        : state.messages
    })),
  applyStreamCompleted: (session, message) =>
    set((state) => ({
      sessions: [session, ...state.sessions.filter((item) => item.id !== session.id)],
      messages: state.messages.map((item) => (item.id === STREAMING_MESSAGE_ID ? message : item)),
      isStreaming: false
    })),
  applyStreamError: (message) =>
    set((state) => ({
      messages: state.messages.filter((item) => item.id !== STREAMING_MESSAGE_ID),
      isStreaming: false,
      error: message
    }))
}));
