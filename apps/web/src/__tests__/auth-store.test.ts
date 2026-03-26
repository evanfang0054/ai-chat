import { afterEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../stores/auth-store';

afterEach(() => {
  localStorage.clear();
  useAuthStore.getState().clearAuth();
});

describe('auth store', () => {
  it('stores access token', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'token-123',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'USER',
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      }
    });

    expect(useAuthStore.getState().accessToken).toBe('token-123');
  });

  it('persists auth state', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'token-123',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'USER',
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      }
    });

    expect(localStorage.getItem('ai-chat-auth')).toContain('token-123');
  });

  it('clears auth state', () => {
    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
