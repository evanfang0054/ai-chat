import { getApiBaseUrl } from './env';

type ApiFetchOptions = RequestInit & {
  accessToken?: string | null;
  responseType?: 'json' | 'text';
  retryOnAuthError?: boolean;
};

export async function apiFetch<T>(path: string, init?: ApiFetchOptions): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.accessToken ? { Authorization: `Bearer ${init.accessToken}` } : {}),
      ...(init?.headers || {})
    }
  });

  if (response.status === 401 && init?.retryOnAuthError !== false && path !== '/auth/refresh') {
    const { useAuthStore } = await import('../stores/auth-store');
    const authStore = useAuthStore.getState();

    if (authStore.refreshToken) {
      await authStore.refreshAuth();

      return apiFetch<T>(path, {
        ...init,
        accessToken: useAuthStore.getState().accessToken,
        retryOnAuthError: false
      });
    }
  }

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  if (init?.responseType === 'text') {
    return (await response.text()) as T;
  }

  return response.json() as Promise<T>;
}
