import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UserSummary } from '@ai-chat/shared';
import { refreshAuthToken } from '../services/auth';

type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserSummary | null;
  setAuth: (payload: { accessToken: string; refreshToken: string; user: UserSummary }) => void;
  refreshAuth: () => Promise<void>;
  clearAuth: () => void;
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      setAuth: ({ accessToken, refreshToken, user }) => set({ accessToken, refreshToken, user }),
      refreshAuth: async () => {
        const refreshToken = get().refreshToken;

        if (!refreshToken) {
          throw new Error('Missing refresh token');
        }

        try {
          const auth = await refreshAuthToken(refreshToken);
          set({
            accessToken: auth.accessToken,
            refreshToken: auth.refreshToken,
            user: auth.user
          });
        } catch (error) {
          set({ accessToken: null, refreshToken: null, user: null });
          throw error;
        }
      },
      clearAuth: () => set({ accessToken: null, refreshToken: null, user: null })
    }),
    {
      name: 'ai-chat-auth'
    }
  )
);
