import type { AuthResponse, LoginRequest } from '@ai-chat/shared';
import { apiFetch } from '../lib/api';

export function login(data: LoginRequest) {
  return apiFetch<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}
