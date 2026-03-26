import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserSummary } from '@ai-chat/shared';

type AuthState = {
  accessToken: string | null;
  user: UserSummary | null;
  setAuth: (payload: { accessToken: string; user: UserSummary }) => void;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      user: null,
      setAuth: ({ accessToken, user }) => set({ accessToken, user }),
      clearAuth: () => set({ accessToken: null, user: null })
    }),
    {
      name: 'ai-chat-auth'
    }
  )
);
