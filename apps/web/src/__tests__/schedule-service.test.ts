import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';

import {
  createSchedule,
  deleteSchedule,
  disableSchedule,
  enableSchedule,
  getRun,
  listRuns,
  listSchedules
} from '../services/schedule';

vi.mock('../lib/api', () => ({
  apiFetch: vi.fn(async (path: string) => ({ path }))
}));

describe('schedule service', () => {
  it('builds schedule and run endpoints', async () => {
    await expect(listSchedules('token')).resolves.toEqual({ path: '/schedules' });
    await expect(listRuns('token', { status: 'SUCCEEDED' })).resolves.toEqual({ path: '/runs?status=SUCCEEDED' });
    await expect(enableSchedule('token', 'schedule-1')).resolves.toEqual({ path: '/schedules/schedule-1/enable' });
    await expect(disableSchedule('token', 'schedule-1')).resolves.toEqual({ path: '/schedules/schedule-1/disable' });
    await expect(deleteSchedule('token', 'schedule-1')).resolves.toEqual({ path: '/schedules/schedule-1' });
    await expect(getRun('token', 'run-1')).resolves.toEqual({ path: '/runs/run-1' });
    await expect(
      createSchedule('token', {
        title: 'Morning brief',
        taskPrompt: 'Summarize unread issues',
        type: 'ONE_TIME',
        runAt: '2026-03-29T09:00:00.000Z'
      })
    ).resolves.toEqual({ path: '/schedules' });
  });
});
