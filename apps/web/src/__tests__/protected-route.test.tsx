import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { cleanup, render, screen } from '@testing-library/react';
import { ProtectedRoute } from '../router/ProtectedRoute';
import { useAuthStore } from '../stores/auth-store';

afterEach(() => {
  cleanup();
  useAuthStore.getState().clearAuth();
});

describe('ProtectedRoute', () => {
  it('renders protected content when authenticated', () => {
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

    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route index element={<div>Allowed</div>} />
          </Route>
          <Route path="/login" element={<div>Redirected</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Allowed')).toBeInTheDocument();
  });

  it('redirects when unauthenticated', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<ProtectedRoute />}>
            <Route index element={<div>Allowed</div>} />
          </Route>
          <Route path="/login" element={<div>Redirected</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText('Redirected')).toBeInTheDocument();
  });
});
