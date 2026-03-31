import type { AuthResponse, LoginRequest, RefreshTokenRequest } from '@ai-chat/shared';
import { apiFetch } from '../lib/api';

export function login(data: LoginRequest) {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function refreshAuthToken(refreshToken: string) {
  const body: RefreshTokenRequest = { refreshToken };

  return apiFetch<AuthResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify(body)
  });
}
