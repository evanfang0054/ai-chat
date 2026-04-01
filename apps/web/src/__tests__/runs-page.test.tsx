import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from 'react-router-dom';
import type { RunToolExecutionSummary, ScheduleRunSummary } from '@ai-chat/shared';

import * as scheduleService from '../services/schedule';
import { getApiBaseUrl } from '../lib/env';
import { router } from '../router';
import { useAuthStore } from '../stores/auth-store';
import { ThemeProvider } from '../contexts/theme-context';

function signIn() {
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
}

function createRun(overrides: Partial<ScheduleRunSummary> = {}): ScheduleRunSummary {
  const base: ScheduleRunSummary = {
    id: 'run-1',
    sessionId: null,
    messageId: null,
    requestId: null,
    scheduleId: 'schedule-1',
    userId: 'user-1',
    taskPromptSnapshot: 'Summarize unread issues',
    chatSessionId: null,
    scheduleTitle: 'Morning brief',
    createdAt: '2026-03-29T09:00:00.000Z',
    schedule: {
      id: 'schedule-1',
      title: 'Morning brief',
      type: 'ONE_TIME'
    },
    status: 'COMPLETED',
    stage: 'FINALIZING',
    triggerSource: 'SCHEDULE',
    failureCategory: null,
    failureCode: null,
    failureMessage: null,
    durationMs: 3000,
    toolExecutionCount: 0,
    retryCount: 0,
    lastRepairAction: null,
    resultSummary: 'All caught up',
    startedAt: '2026-03-29T09:00:00.000Z',
    finishedAt: '2026-03-29T09:00:03.000Z'
  };

  return {
    ...base,
    ...overrides,
    schedule: {
      ...base.schedule,
      ...overrides.schedule
    }
  };
}

function createToolExecution(overrides: Partial<RunToolExecutionSummary> = {}): RunToolExecutionSummary {
  return {
    id: 'tool-1',
    runId: 'run-tool',
    messageId: null,
    toolName: 'get_current_time',
    status: 'SUCCEEDED',
    errorCategory: null,
    ...overrides
  };
}

function createRunDetail(overrides: Partial<ScheduleRunSummary & { toolExecutions?: RunToolExecutionSummary[] }> = {}) {
  return {
    ...createRun(overrides),
    toolExecutions: overrides.toolExecutions
  };
}

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  delete (window as typeof window & { __AI_CHAT_RUNTIME_CONFIG__?: { apiBaseUrl?: string } }).__AI_CHAT_RUNTIME_CONFIG__;
  useAuthStore.getState().clearAuth();
  await router.navigate('/');
});

describe('RunsPage', () => {
  it('prefers runtime config api base url over build-time fallback', () => {
    (window as typeof window & { __AI_CHAT_RUNTIME_CONFIG__?: { apiBaseUrl?: string } }).__AI_CHAT_RUNTIME_CONFIG__ = {
      apiBaseUrl: 'http://localhost:3100'
    };

    expect(getApiBaseUrl()).toBe('http://localhost:3100');
  });

  it('redirects /runs to /login when unauthenticated', async () => {
    await router.navigate('/runs');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    expect(await screen.findByText(/Welcome to AI Chat/i)).toBeInTheDocument();
  });

  it('shows run diagnostics card with stage failure category and tool summary', async () => {
    signIn();

    const run = createRun({
      id: 'run-tool',
      sessionId: 'session-1',
      messageId: 'message-1',
      requestId: 'request-1',
      chatSessionId: 'session-1',
      taskPromptSnapshot: 'Call tools',
      scheduleTitle: 'Ops check',
      scheduleId: 'schedule-1',
      schedule: {
        id: 'schedule-1',
        title: 'Ops check',
        type: 'CRON'
      },
      status: 'FAILED',
      stage: 'TOOL_RUNNING',
      failureCategory: 'TOOL_ERROR',
      failureCode: 'TOOL_FAILED',
      failureMessage: 'Tool failed',
      durationMs: 3200,
      toolExecutionCount: 2,
      resultSummary: null,
      startedAt: '2026-03-29T10:00:00.000Z',
      finishedAt: '2026-03-29T10:00:03.200Z'
    });

    vi.spyOn(scheduleService, 'listRuns').mockResolvedValue({ runs: [run] });
    vi.spyOn(scheduleService, 'getRun').mockResolvedValue({
      run: createRunDetail({
        ...run,
        toolExecutions: [
          createToolExecution({
            id: 'tool-1',
            runId: 'run-tool',
            toolName: 'get_current_time',
            status: 'SUCCEEDED'
          }),
          createToolExecution({
            id: 'tool-2',
            runId: 'run-tool',
            toolName: 'web_search',
            status: 'FAILED',
            errorCategory: 'TOOL_ERROR'
          })
        ]
      })
    });

    await router.navigate('/runs');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    expect(await screen.findByText((_, element) => element?.textContent === 'Request ID: request-1')).toBeInTheDocument();
    expect(await screen.findByText((_, element) => element?.textContent === 'Session ID: session-1')).toBeInTheDocument();
    expect(await screen.findByText((_, element) => element?.textContent === 'Message ID: message-1')).toBeInTheDocument();
    expect(await screen.findByText(/Stage: TOOL_RUNNING/i)).toBeInTheDocument();
    expect(await screen.findByText(/Failure Category: TOOL_ERROR/i)).toBeInTheDocument();
    expect(await screen.findByText(/Failure Code: TOOL_FAILED/i)).toBeInTheDocument();
    expect(await screen.findByText(/Tool Calls: 2/i)).toBeInTheDocument();
    expect(await screen.findByText(/web_search/i)).toBeInTheDocument();
    expect(await screen.findByText(/Status: Failed/i)).toBeInTheDocument();
  });

  it('loads runs on /runs, supports filters, and fetches selected run details', async () => {
    signIn();

    const runOne = createRun();
    const runTwo = createRun({
      id: 'run-2',
      sessionId: 'session-2',
      scheduleId: 'schedule-2',
      taskPromptSnapshot: 'Check failures',
      chatSessionId: 'session-2',
      scheduleTitle: 'Incident follow-up',
      schedule: {
        id: 'schedule-2',
        title: 'Incident follow-up',
        type: 'CRON'
      },
      status: 'FAILED',
      stage: 'REPAIRING',
      failureCategory: 'SYSTEM_ERROR',
      failureCode: 'AGENT_FAILED',
      failureMessage: 'Agent failed',
      durationMs: 5000,
      resultSummary: null,
      startedAt: '2026-03-29T10:00:00.000Z',
      finishedAt: '2026-03-29T10:00:05.000Z'
    });

    const listRuns = vi.spyOn(scheduleService, 'listRuns').mockImplementation(async (_token, filters) => {
      if (filters?.status === 'FAILED') {
        return { runs: [runTwo] };
      }

      if (filters?.scheduleId === 'schedule-2') {
        return { runs: [runTwo] };
      }

      return { runs: [runOne, runTwo] };
    });

    const getRun = vi.spyOn(scheduleService, 'getRun').mockImplementation(async (_token, id) => ({
      run: createRunDetail(id === 'run-1' ? runOne : runTwo)
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
    expect(await screen.findByText('Status: Completed')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chat' })).toHaveAttribute('href', '/chat');
    expect(screen.getByRole('link', { name: 'Schedules' })).toHaveAttribute('href', '/schedules');
    expect(screen.getByRole('link', { name: 'Runs' })).toHaveAttribute('href', '/runs');
    expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
    expect(screen.getByRole('link', { name: 'Open Chat' })).toHaveAttribute('href', '/chat?sessionId=session-2');

    await userEvent.selectOptions(screen.getByLabelText('Status'), 'FAILED');
    expect(listRuns).toHaveBeenLastCalledWith('token-123', { scheduleId: undefined, status: 'FAILED' });
    expect(await screen.findByText('Incident follow-up')).toBeInTheDocument();
    expect(screen.queryByText('Morning brief')).not.toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Schedule ID'), 'schedule-2');
    expect(listRuns).toHaveBeenLastCalledWith('token-123', { scheduleId: 'schedule-2', status: 'FAILED' });

    await userEvent.click(screen.getByRole('button', { name: 'View Details' }));

    expect(getRun).toHaveBeenCalledWith('token-123', 'run-1');
    expect(getRun).toHaveBeenCalledWith('token-123', 'run-2');
    expect(await screen.findByText('Run ID: run-2')).toBeInTheDocument();
    expect(await screen.findByText('Chat Session ID: session-2')).toBeInTheDocument();
    expect((await screen.findAllByText('Error: Agent failed')).length).toBeGreaterThan(0);
  });

  it('retries selected run and refreshes pending retry to completed details', async () => {
    signIn();

    const failedRun = createRun({
      id: 'run-1',
      status: 'FAILED',
      stage: 'REPAIRING',
      failureCategory: 'SYSTEM_ERROR',
      failureCode: 'AGENT_FAILED',
      failureMessage: 'Agent failed',
      resultSummary: null,
      startedAt: '2026-03-29T10:00:00.000Z',
      finishedAt: '2026-03-29T10:00:05.000Z'
    });
    const pendingRetryRun = createRun({
      id: 'run-2',
      status: 'PENDING',
      stage: 'PREPARING',
      triggerSource: 'MANUAL_RETRY',
      failureCategory: null,
      failureCode: null,
      failureMessage: null,
      durationMs: null,
      toolExecutionCount: 0,
      resultSummary: null,
      startedAt: null,
      finishedAt: null
    });
    const completedRetryRun = createRun({
      ...pendingRetryRun,
      status: 'COMPLETED',
      stage: 'FINALIZING',
      resultSummary: 'Retry completed',
      startedAt: '2026-03-29T10:01:00.000Z',
      finishedAt: '2026-03-29T10:01:03.000Z'
    });

    const listRuns = vi
      .spyOn(scheduleService, 'listRuns')
      .mockResolvedValueOnce({ runs: [failedRun] })
      .mockResolvedValueOnce({ runs: [pendingRetryRun, failedRun] })
      .mockResolvedValue({ runs: [completedRetryRun, failedRun] });
    const getRun = vi
      .spyOn(scheduleService, 'getRun')
      .mockResolvedValueOnce({ run: createRunDetail(failedRun) })
      .mockResolvedValueOnce({ run: createRunDetail(completedRetryRun) });
    const retryRun = vi.spyOn(scheduleService, 'retryRun').mockResolvedValue({ run: pendingRetryRun });

    await router.navigate('/runs');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    expect(await screen.findByText(/Tick may be consumed by another API instance if Redis is shared./i)).toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: 'Retry Run' }));

    expect(retryRun).toHaveBeenCalledWith('token-123', 'run-1');
    expect(await screen.findByText('Run ID: run-2')).toBeInTheDocument();
    expect(await screen.findByText('Status: Pending')).toBeInTheDocument();

    await waitFor(() => {
      expect(listRuns).toHaveBeenCalledTimes(2);
      expect(getRun).toHaveBeenCalledWith('token-123', 'run-2');
      expect(screen.getByText('Status: Completed')).toBeInTheDocument();
      expect(screen.getByText('Result: Retry completed')).toBeInTheDocument();
    }, { timeout: 4000 });
  }, 10000);
});
