import { env } from './env';

type ApiFetchOptions = RequestInit & {
  accessToken?: string | null;
  responseType?: 'json' | 'text';
};

export async function apiFetch<T>(path: string, init?: ApiFetchOptions): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.accessToken ? { Authorization: `Bearer ${init.accessToken}` } : {}),
      ...(init?.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  if (init?.responseType === 'text') {
    return (await response.text()) as T;
  }

  return response.json() as Promise<T>;
}
