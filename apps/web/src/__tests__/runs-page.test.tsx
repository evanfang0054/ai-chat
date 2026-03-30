import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from 'react-router-dom';

import * as scheduleService from '../services/schedule';
import { router } from '../router';
import { useAuthStore } from '../stores/auth-store';
import { ThemeProvider } from '../contexts/theme-context';

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  useAuthStore.getState().clearAuth();
  await router.navigate('/');
});

describe('RunsPage', () => {
  it('redirects /runs to /login when unauthenticated', async () => {
    await router.navigate('/runs');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    expect(await screen.findByText(/Welcome to AI Chat/i)).toBeInTheDocument();
  });

  it('loads runs on /runs, supports filters, and fetches selected run details', async () => {
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

    const listRuns = vi.spyOn(scheduleService, 'listRuns').mockResolvedValue({
      runs: [
        {
          id: 'run-1',
          scheduleId: 'schedule-1',
          userId: 'user-1',
          taskPromptSnapshot: 'Summarize unread issues',
          chatSessionId: null,
          createdAt: new Date().toISOString(),
          schedule: {
            id: 'schedule-1',
            title: 'Morning brief',
            type: 'ONE_TIME'
          },
          status: 'SUCCEEDED',
          resultSummary: 'All caught up',
          errorMessage: null,
          startedAt: '2026-03-29T09:00:00.000Z',
          finishedAt: '2026-03-29T09:00:03.000Z'
        },
        {
          id: 'run-2',
          scheduleId: 'schedule-2',
          userId: 'user-1',
          taskPromptSnapshot: 'Check failures',
          chatSessionId: 'session-2',
          createdAt: new Date().toISOString(),
          schedule: {
            id: 'schedule-2',
            title: 'Incident follow-up',
            type: 'CRON'
          },
          status: 'FAILED',
          resultSummary: null,
          errorMessage: 'Agent failed',
          startedAt: '2026-03-29T10:00:00.000Z',
          finishedAt: '2026-03-29T10:00:05.000Z'
        }
      ]
    });

    const getRun = vi.spyOn(scheduleService, 'getRun').mockImplementation(async (_token, id) => ({
      run:
        id === 'run-1'
          ? {
              id: 'run-1',
              scheduleId: 'schedule-1',
              userId: 'user-1',
              taskPromptSnapshot: 'Summarize unread issues',
              chatSessionId: null,
              createdAt: new Date().toISOString(),
              schedule: {
                id: 'schedule-1',
                title: 'Morning brief',
                type: 'ONE_TIME'
              },
              status: 'SUCCEEDED',
              resultSummary: 'All caught up',
              errorMessage: null,
              startedAt: '2026-03-29T09:00:00.000Z',
              finishedAt: '2026-03-29T09:00:03.000Z'
            }
          : {
              id: 'run-2',
              scheduleId: 'schedule-2',
              userId: 'user-1',
              taskPromptSnapshot: 'Check failures',
              chatSessionId: 'session-2',
              createdAt: new Date().toISOString(),
              schedule: {
                id: 'schedule-2',
                title: 'Incident follow-up',
                type: 'CRON'
              },
              status: 'FAILED',
              resultSummary: null,
              errorMessage: 'Agent failed',
              startedAt: '2026-03-29T10:00:00.000Z',
              finishedAt: '2026-03-29T10:00:05.000Z'
            }
    }));

    await router.navigate('/runs');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    expect(await screen.findByText('Morning brief')).toBeInTheDocument();
    expect(await screen.findByText('Run Details')).toBeInTheDocument();
    expect(await screen.findByText('Run ID: run-1')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chat' })).toHaveAttribute('href', '/chat');
    expect(screen.getByRole('link', { name: 'Schedules' })).toHaveAttribute('href', '/schedules');
    expect(screen.getByRole('link', { name: 'Runs' })).toHaveAttribute('href', '/runs');
    expect(screen.getByRole('link', { name: 'Open Chat' })).toHaveAttribute('href', '/chat?sessionId=session-2');

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'FAILED');
    expect(listRuns).toHaveBeenLastCalledWith('token-123', { scheduleId: undefined, status: 'FAILED' });

    await userEvent.type(screen.getByLabelText('Schedule ID'), 'schedule-2');
    expect(listRuns).toHaveBeenLastCalledWith('token-123', { scheduleId: 'schedule-2', status: 'FAILED' });

    await userEvent.click(screen.getAllByRole('button', { name: 'View Details' })[1]);

    expect(getRun).toHaveBeenCalledWith('token-123', 'run-1');
    expect(getRun).toHaveBeenCalledWith('token-123', 'run-2');
    expect(await screen.findByText('Run ID: run-2')).toBeInTheDocument();
    expect(await screen.findByText('Chat Session ID: session-2')).toBeInTheDocument();
    expect((await screen.findAllByText('Error: Agent failed')).length).toBeGreaterThan(0);
  });
});
