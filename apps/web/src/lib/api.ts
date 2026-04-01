import { getApiBaseUrl } from './env';

type ApiFetchOptions = RequestInit & {
  accessToken?: string | null;
  responseType?: 'json' | 'text';
  retryOnAuthError?: boolean;
};

export function toUserFacingErrorMessage(category?: string | null, fallback?: string) {
  if (fallback && !fallback.startsWith('Request failed:')) {
    return fallback;
  }

  switch (category) {
    case 'INPUT_ERROR':
      return '请求参数无效，请检查输入后重试。';
    case 'TOOL_ERROR':
      return '工具执行失败，请稍后重试。';
    case 'MODEL_ERROR':
      return '模型调用失败，请稍后重试。';
    case 'DEPENDENCY_ERROR':
      return '依赖服务暂时不可用，请稍后重试。';
    case 'TIMEOUT_ERROR':
      return '请求处理超时，请稍后重试。';
    case 'SYSTEM_ERROR':
      return '系统处理失败，请稍后重试。';
    case 'CANCELLED':
      return '请求已取消。';
    default:
      return fallback ?? '请求失败，请稍后重试。';
  }
}

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
    throw new Error(toUserFacingErrorMessage(undefined, `Request failed: ${response.status}`));
  }

  if (init?.responseType === 'text') {
    return (await response.text()) as T;
  }

  return response.json() as Promise<T>;
}
