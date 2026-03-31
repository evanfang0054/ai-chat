import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '../stores/auth-store';

const { refreshAuthTokenMock } = vi.hoisted(() => ({
  refreshAuthTokenMock: vi.fn()
}));

vi.mock('../services/auth', () => ({
  refreshAuthToken: refreshAuthTokenMock
}));

afterEach(() => {
  localStorage.clear();
  useAuthStore.getState().clearAuth();
  refreshAuthTokenMock.mockReset();
});

describe('auth store', () => {
  it('stores access token and refresh token', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'token-123',
      refreshToken: 'refresh-123',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'USER',
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      }
    });

    expect(useAuthStore.getState().accessToken).toBe('token-123');
    expect(useAuthStore.getState().refreshToken).toBe('refresh-123');
  });

  it('persists auth state with refresh token', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'token-123',
      refreshToken: 'refresh-123',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'USER',
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      }
    });

    expect(localStorage.getItem('ai-chat-auth')).toContain('token-123');
    expect(localStorage.getItem('ai-chat-auth')).toContain('refresh-123');
  });

  it('stores refresh token and replaces access token after refresh', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'USER' as const,
      status: 'ACTIVE' as const,
      createdAt: new Date().toISOString()
    };

    refreshAuthTokenMock.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'refresh-2',
      user
    });

    useAuthStore.getState().setAuth({
      accessToken: 'old-access',
      refreshToken: 'refresh-1',
      user
    });

    await useAuthStore.getState().refreshAuth();

    expect(refreshAuthTokenMock).toHaveBeenCalledWith('refresh-1');
    expect(useAuthStore.getState().accessToken).toBe('new-access');
    expect(useAuthStore.getState().refreshToken).toBe('refresh-2');
  });

  it('clears auth state when refresh fails', async () => {
    const user = {
      id: 'user-1',
      email: 'user@example.com',
      role: 'USER' as const,
      status: 'ACTIVE' as const,
      createdAt: new Date().toISOString()
    };

    refreshAuthTokenMock.mockRejectedValue(new Error('refresh failed'));

    useAuthStore.getState().setAuth({
      accessToken: 'old-access',
      refreshToken: 'refresh-1',
      user
    });

    await expect(useAuthStore.getState().refreshAuth()).rejects.toThrow('refresh failed');
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('clears auth state', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'token-123',
      refreshToken: 'refresh-123',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'USER',
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      }
    });

    useAuthStore.getState().clearAuth();

    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(useAuthStore.getState().user).toBeNull();
  });
});
