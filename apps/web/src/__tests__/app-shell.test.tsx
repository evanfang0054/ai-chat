import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { ThemeProvider } from '../contexts/theme-context';
import { useAuthStore } from '../stores/auth-store';

afterEach(() => {
  cleanup();
  useAuthStore.getState().clearAuth();
});

describe('AppShell', () => {
  it('renders theme toggle button', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'token',
      refreshToken: 'refresh-token',
      user: { id: '1', email: 'test@example.com', role: 'USER', status: 'ACTIVE', createdAt: new Date().toISOString() }
    });

    render(
      <BrowserRouter>
        <ThemeProvider>
          <AppShell>Content</AppShell>
        </ThemeProvider>
      </BrowserRouter>
    );

    expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument();
  });
});
