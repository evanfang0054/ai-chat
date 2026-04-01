import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from 'react-router-dom';

import * as scheduleService from '../services/schedule';
import { router } from '../router';
import { useAuthStore } from '../stores/auth-store';
import { ThemeProvider } from '../contexts/theme-context';
import { ScheduleForm } from '../components/schedules/ScheduleForm';

function toDatetimeLocalValue(iso: string) {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function toIsoFromDatetimeLocal(value: string) {
  const [datePart, timePart] = value.split('T');
  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);

  return new Date(year, month - 1, day, hours, minutes).toISOString();
}

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  useAuthStore.getState().clearAuth();
  await router.navigate('/');
});

describe('SchedulesPage', () => {
  it('renders one-time schedule form with local datetime and preserves the instant on submit', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const runAt = '2026-03-30T09:30:00.000Z';

    render(
      <ScheduleForm
        initial={{
          id: 'schedule-1',
          title: 'Existing schedule',
          taskPrompt: 'Updated prompt',
          type: 'ONE_TIME',
          cronExpr: null,
          intervalMs: null,
          runAt,
          timezone: 'UTC',
          enabled: true,
          lastRunAt: null,
          nextRunAt: '2026-03-30T09:30:00.000Z',
          latestRunId: null,
          latestRunStatus: null,
          latestRunStage: null,
          latestRunStartedAt: null,
          latestRunFinishedAt: null,
          latestRequestId: null,
          latestSessionId: null,
          latestMessageId: null,
          latestToolExecutionCount: 0,
          latestFailureMessage: null,
          latestResultSummary: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }}
        onSubmit={onSubmit}
      />
    );

    const runAtInput = screen.getByLabelText('Run At') as HTMLInputElement;
    expect(runAtInput.value).toBe(toDatetimeLocalValue(runAt));

    await userEvent.clear(runAtInput);
    await userEvent.type(runAtInput, '2026-03-31T10:45');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
      type: 'ONE_TIME',
      runAt: toIsoFromDatetimeLocal('2026-03-31T10:45')
    }));
  });

  it('redirects /schedules to /login when unauthenticated', async () => {
    await router.navigate('/schedules');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    expect(await screen.findByText(/Welcome to AI Chat/i)).toBeInTheDocument();
  });

  it('renders schedule page shell heading', async () => {
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
    vi.spyOn(scheduleService, 'listSchedules').mockResolvedValue({ schedules: [] });

    await router.navigate('/schedules');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    expect(await screen.findByRole('heading', { level: 1, name: /schedules/i })).toBeInTheDocument();
  });

  it('keeps form controls accessible by label', async () => {
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
    vi.spyOn(scheduleService, 'listSchedules').mockResolvedValue({ schedules: [] });

    await router.navigate('/schedules');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    expect(await screen.findByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/task prompt/i)).toBeInTheDocument();
  });

  it('shows schedule health summary with next run and latest failure', async () => {
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

    vi.spyOn(scheduleService, 'listSchedules').mockResolvedValue({
      schedules: [
        {
          id: 'schedule-1',
          title: 'Existing schedule',
          taskPrompt: 'Existing prompt',
          type: 'ONE_TIME',
          cronExpr: null,
          intervalMs: null,
          runAt: '2026-03-28T09:00:00.000Z',
          timezone: 'UTC',
          enabled: true,
          lastRunAt: '2026-03-28T09:00:05.000Z',
          nextRunAt: '2026-03-29T09:00:00.000Z',
          latestRunId: 'run-1',
          latestRunStatus: 'COMPLETED',
          latestRunStage: 'FINALIZING',
          latestRunStartedAt: '2026-03-28T09:00:00.000Z',
          latestRunFinishedAt: '2026-03-28T09:00:05.000Z',
          latestRequestId: 'request-1',
          latestSessionId: 'session-1',
          latestMessageId: 'message-1',
          latestToolExecutionCount: 2,
          latestFailureMessage: 'Agent failed',
          latestResultSummary: 'Partial summary',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    });

    await router.navigate('/schedules');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    expect(await screen.findByText(/Next Run:/i)).toBeInTheDocument();
    expect(await screen.findByText(/Latest Run: run-1/i)).toBeInTheDocument();
    expect(await screen.findByText(/Latest Status: Completed/i)).toBeInTheDocument();
    expect(await screen.findByText(/Latest Stage: Finalizing/i)).toBeInTheDocument();
    expect(await screen.findByText(/Latest Request: request-1/i)).toBeInTheDocument();
    expect(await screen.findByText(/Latest Session: session-1/i)).toBeInTheDocument();
    expect(await screen.findByText(/Latest Message: message-1/i)).toBeInTheDocument();
    expect(await screen.findByText(/Latest Tools: 2/i)).toBeInTheDocument();
    expect(await screen.findByText(/Latest Started: 2026-03-28T09:00:00.000Z/i)).toBeInTheDocument();
    expect(await screen.findByText(/Latest Finished: 2026-03-28T09:00:05.000Z/i)).toBeInTheDocument();
    expect(await screen.findByText(/Latest Failure:/i)).toBeInTheDocument();
    expect(await screen.findByText(/Latest Result:/i)).toBeInTheDocument();
    expect(await screen.findByText(/Agent failed/i)).toBeInTheDocument();
  });

  it('loads schedules, creates a one-time schedule, edits an existing schedule, and deletes it', async () => {
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

    vi.spyOn(scheduleService, 'listSchedules').mockResolvedValue({
      schedules: [
        {
          id: 'schedule-1',
          title: 'Existing schedule',
          taskPrompt: 'Existing prompt',
          type: 'ONE_TIME',
          cronExpr: null,
          intervalMs: null,
          runAt: '2026-03-28T09:00:00.000Z',
          timezone: 'UTC',
          enabled: true,
          lastRunAt: null,
          nextRunAt: '2026-03-28T09:00:00.000Z',
          latestRunId: null,
          latestRunStatus: null,
          latestRunStage: null,
          latestRunStartedAt: null,
          latestRunFinishedAt: null,
          latestRequestId: null,
          latestSessionId: null,
          latestMessageId: null,
          latestToolExecutionCount: 0,
          latestFailureMessage: null,
          latestResultSummary: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    });

    const createSchedule = vi.spyOn(scheduleService, 'createSchedule').mockResolvedValue({
      id: 'schedule-2',
      title: 'Morning brief',
      taskPrompt: 'Summarize unread issues',
      type: 'ONE_TIME',
      cronExpr: null,
      intervalMs: null,
      runAt: '2026-03-29T09:00:00.000Z',
      timezone: 'UTC',
      enabled: true,
      lastRunAt: null,
      nextRunAt: '2026-03-29T09:00:00.000Z',
      latestRunId: null,
      latestRunStatus: null,
      latestRunStage: null,
      latestRunStartedAt: null,
      latestRunFinishedAt: null,
      latestRequestId: null,
      latestSessionId: null,
      latestMessageId: null,
      latestToolExecutionCount: 0,
      latestFailureMessage: null,
      latestResultSummary: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const updateSchedule = vi.spyOn(scheduleService, 'updateSchedule').mockResolvedValue({
      id: 'schedule-1',
      title: 'Existing schedule updated',
      taskPrompt: 'Updated prompt',
      type: 'ONE_TIME',
      cronExpr: null,
      intervalMs: null,
      runAt: '2026-03-30T09:30:00.000Z',
      timezone: 'UTC',
      enabled: true,
      lastRunAt: null,
      nextRunAt: '2026-03-30T09:30:00.000Z',
      latestRunId: null,
      latestRunStatus: null,
      latestRunStage: null,
      latestRunStartedAt: null,
      latestRunFinishedAt: null,
      latestRequestId: null,
      latestSessionId: null,
      latestMessageId: null,
      latestToolExecutionCount: 0,
      latestFailureMessage: null,
      latestResultSummary: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const deleteSchedule = vi.spyOn(scheduleService, 'deleteSchedule').mockResolvedValue({
      deletedScheduleId: 'schedule-1'
    });

    await router.navigate('/schedules');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    expect(await screen.findByText('Existing schedule')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chat' })).toHaveAttribute('href', '/chat');
    expect(screen.getByRole('link', { name: 'Schedules' })).toHaveAttribute('href', '/schedules');
    expect(screen.getByRole('link', { name: 'Runs' })).toHaveAttribute('href', '/runs');

    await userEvent.type(screen.getByLabelText('Title'), 'Morning brief');
    await userEvent.type(screen.getByLabelText('Task Prompt'), 'Summarize unread issues');
    await userEvent.type(screen.getByLabelText('Run At'), '2026-03-29T09:00');
    await userEvent.click(screen.getByRole('button', { name: 'Create Schedule' }));

    expect(createSchedule).toHaveBeenCalledWith(
      'token-123',
      expect.objectContaining({
        title: 'Morning brief',
        taskPrompt: 'Summarize unread issues',
        type: 'ONE_TIME'
      })
    );
    expect(await screen.findByText('Morning brief')).toBeInTheDocument();

    const editButtons = screen.getAllByRole('button', { name: 'Edit' });
    await userEvent.click(editButtons[1]);
    expect(await screen.findByText('Edit Schedule')).toBeInTheDocument();

    const titleInputs = screen.getAllByLabelText('Title');
    const promptInputs = screen.getAllByLabelText('Task Prompt');
    const runAtInputs = screen.getAllByLabelText('Run At');

    await userEvent.clear(titleInputs[1]);
    await userEvent.type(titleInputs[1], 'Existing schedule updated');
    await userEvent.clear(promptInputs[1]);
    await userEvent.type(promptInputs[1], 'Updated prompt');
    await userEvent.clear(runAtInputs[1]);
    await userEvent.type(runAtInputs[1], '2026-03-30T09:30');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(updateSchedule).toHaveBeenCalledWith(
      'token-123',
      'schedule-1',
      expect.objectContaining({
        title: 'Existing schedule updated',
        taskPrompt: 'Updated prompt',
        type: 'ONE_TIME'
      })
    );
    expect(await screen.findByText('Existing schedule updated')).toBeInTheDocument();

    const deleteButtons = screen.getAllByRole('button', { name: 'Delete' });
    await userEvent.click(deleteButtons[1]);

    expect(deleteSchedule).toHaveBeenCalledWith('token-123', 'schedule-1');
    expect(screen.queryByText('Existing schedule updated')).not.toBeInTheDocument();
  });
});
