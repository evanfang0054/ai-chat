import { create } from 'zustand';
import type { ChatSessionSummary } from '@ai-chat/shared';

type ChatState = {
  sessions: ChatSessionSummary[];
  currentSessionId: string | null;
  reset: () => void;
  setSessions: (sessions: ChatSessionSummary[]) => void;
  upsertSession: (session: ChatSessionSummary) => void;
  setCurrentSession: (sessionId: string | null) => void;
};

const initialState = {
  sessions: [],
  currentSessionId: null
} satisfies Pick<ChatState, 'sessions' | 'currentSessionId'>;

export const useChatStore = create<ChatState>((set) => ({
  ...initialState,
  reset: () => set(initialState),
  setSessions: (sessions) => set({ sessions }),
  upsertSession: (session) =>
    set((state) => ({
      sessions: [session, ...state.sessions.filter((item) => item.id !== session.id)]
    })),
  setCurrentSession: (currentSessionId) => set({ currentSessionId })
}));
