import { create } from 'zustand';
import type { ChatSessionSummary } from '@ai-chat/shared';

export type StreamUiState = 'IDLE' | 'STREAMING' | 'FAILED';

type ChatState = {
  sessions: ChatSessionSummary[];
  currentSessionId: string | null;
  streamUiState: StreamUiState;
  streamErrorMessage: string | null;
  reset: () => void;
  setSessions: (sessions: ChatSessionSummary[]) => void;
  upsertSession: (session: ChatSessionSummary) => void;
  setCurrentSession: (sessionId: string | null) => void;
  setStreamIdle: () => void;
  setStreamStreaming: () => void;
  setStreamFailed: (errorMessage: string) => void;
};

const initialState = {
  sessions: [],
  currentSessionId: null,
  streamUiState: 'IDLE',
  streamErrorMessage: null
} satisfies Pick<ChatState, 'sessions' | 'currentSessionId' | 'streamUiState' | 'streamErrorMessage'>;

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,
  reset: () => set(initialState),
  setSessions: (sessions) => set({ sessions }),
  upsertSession: (session) =>
    set((state) => ({
      sessions: [session, ...state.sessions.filter((item) => item.id !== session.id)]
    })),
  setCurrentSession: (currentSessionId) => set({ currentSessionId }),
  setStreamIdle: () => set({ streamUiState: 'IDLE', streamErrorMessage: null }),
  setStreamStreaming: () => set({ streamUiState: 'STREAMING', streamErrorMessage: null }),
  setStreamFailed: (streamErrorMessage) => set({ streamUiState: 'FAILED', streamErrorMessage })
}));
