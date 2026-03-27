import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from 'react-router-dom';

import * as scheduleService from '../services/schedule';
import { router } from '../router';
import { useAuthStore } from '../stores/auth-store';

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  useAuthStore.getState().clearAuth();
  await router.navigate('/');
});

describe('SchedulesPage', () => {
  it('redirects /schedules to /login when unauthenticated', async () => {
    await router.navigate('/schedules');
    render(<RouterProvider router={router} />);

    expect(await screen.findByText(/login/i)).toBeInTheDocument();
  });

  it('loads schedules, creates a one-time schedule, edits an existing schedule, and deletes it', async () => {
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

    vi.spyOn(scheduleService, 'listSchedules').mockResolvedValue({
      schedules: [
        {
          id: 'schedule-1',
          title: 'Existing schedule',
          taskPrompt: 'Existing prompt',
          type: 'ONE_TIME',
          cronExpr: null,
          runAt: '2026-03-28T09:00:00.000Z',
          timezone: 'UTC',
          enabled: true,
          lastRunAt: null,
          nextRunAt: '2026-03-28T09:00:00.000Z',
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
      runAt: '2026-03-29T09:00:00.000Z',
      timezone: 'UTC',
      enabled: true,
      lastRunAt: null,
      nextRunAt: '2026-03-29T09:00:00.000Z',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const updateSchedule = vi.spyOn(scheduleService, 'updateSchedule').mockResolvedValue({
      id: 'schedule-1',
      title: 'Existing schedule updated',
      taskPrompt: 'Updated prompt',
      type: 'ONE_TIME',
      cronExpr: null,
      runAt: '2026-03-30T09:30:00.000Z',
      timezone: 'UTC',
      enabled: true,
      lastRunAt: null,
      nextRunAt: '2026-03-30T09:30:00.000Z',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const deleteSchedule = vi.spyOn(scheduleService, 'deleteSchedule').mockResolvedValue({
      deletedScheduleId: 'schedule-1'
    });

    await router.navigate('/schedules');
    render(<RouterProvider router={router} />);

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
