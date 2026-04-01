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

const { apiFetch } = vi.hoisted(() => ({
  apiFetch: vi.fn<(path: string, init?: unknown) => Promise<unknown>>()
}));

vi.mock('../lib/api', () => ({
  apiFetch
}));

describe('schedule service', () => {
  it('builds schedule and run endpoints', async () => {
    apiFetch.mockReset();
    apiFetch
      .mockResolvedValueOnce({ schedules: [] })
      .mockResolvedValueOnce({ runs: [] })
      .mockResolvedValueOnce({ id: 'schedule-1' })
      .mockResolvedValueOnce({ id: 'schedule-1' })
      .mockResolvedValueOnce({ deletedScheduleId: 'schedule-1' })
      .mockResolvedValueOnce({ run: { toolExecutions: [] } })
      .mockResolvedValueOnce({ id: 'schedule-2' });

    await listSchedules('token');
    await listRuns('token', { status: 'SUCCEEDED' });
    await enableSchedule('token', 'schedule-1');
    await disableSchedule('token', 'schedule-1');
    await deleteSchedule('token', 'schedule-1');
    await getRun('token', 'run-1');
    await createSchedule('token', {
      title: 'Morning brief',
      taskPrompt: 'Summarize unread issues',
      type: 'ONE_TIME',
      runAt: '2026-03-29T09:00:00.000Z'
    });

    expect(apiFetch).toHaveBeenNthCalledWith(1, '/schedules', { accessToken: 'token' });
    expect(apiFetch).toHaveBeenNthCalledWith(2, '/runs?status=SUCCEEDED', { accessToken: 'token' });
    expect(apiFetch).toHaveBeenNthCalledWith(3, '/schedules/schedule-1/enable', {
      method: 'POST',
      accessToken: 'token'
    });
    expect(apiFetch).toHaveBeenNthCalledWith(4, '/schedules/schedule-1/disable', {
      method: 'POST',
      accessToken: 'token'
    });
    expect(apiFetch).toHaveBeenNthCalledWith(5, '/schedules/schedule-1', {
      method: 'DELETE',
      accessToken: 'token'
    });
    expect(apiFetch).toHaveBeenNthCalledWith(6, '/runs/run-1', { accessToken: 'token' });
    expect(apiFetch).toHaveBeenNthCalledWith(7, '/schedules', {
      method: 'POST',
      accessToken: 'token',
      body: JSON.stringify({
        title: 'Morning brief',
        taskPrompt: 'Summarize unread issues',
        type: 'ONE_TIME',
        runAt: '2026-03-29T09:00:00.000Z'
      })
    });
  });

  it('normalizes legacy succeeded diagnostics to completed', async () => {
    apiFetch.mockReset();
    apiFetch
      .mockResolvedValueOnce({
        schedules: [
          {
            id: 'schedule-1',
            title: 'Morning brief',
            taskPrompt: 'Summarize unread issues',
            type: 'ONE_TIME',
            cronExpr: null,
            intervalMs: null,
            runAt: '2026-03-29T09:00:00.000Z',
            timezone: 'UTC',
            enabled: true,
            lastRunAt: '2026-03-29T09:00:00.000Z',
            nextRunAt: null,
            latestRunId: 'run-1',
            latestRunStatus: 'SUCCEEDED',
            latestRunStage: 'FINALIZING',
            latestRunStartedAt: '2026-03-29T09:00:00.000Z',
            latestRunFinishedAt: '2026-03-29T09:00:03.000Z',
            latestRequestId: 'request-1',
            latestSessionId: 'session-1',
            latestMessageId: 'message-1',
            latestToolExecutionCount: 1,
            latestFailureMessage: null,
            latestResultSummary: 'All caught up',
            createdAt: '2026-03-29T08:00:00.000Z',
            updatedAt: '2026-03-29T09:00:00.000Z'
          }
        ]
      })
      .mockResolvedValueOnce({
        runs: [
          {
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
            status: 'SUCCEEDED',
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
          }
        ]
      })
      .mockResolvedValueOnce({
        run: {
          id: 'run-1',
          sessionId: 'session-1',
          messageId: 'message-1',
          requestId: 'request-1',
          scheduleId: 'schedule-1',
          userId: 'user-1',
          taskPromptSnapshot: 'Summarize unread issues',
          chatSessionId: 'chat-session-1',
          scheduleTitle: 'Morning brief',
          createdAt: '2026-03-29T09:00:00.000Z',
          schedule: {
            id: 'schedule-1',
            title: 'Morning brief',
            type: 'ONE_TIME'
          },
          status: 'SUCCEEDED',
          stage: 'FINALIZING',
          triggerSource: 'SCHEDULE',
          failureCategory: null,
          failureCode: null,
          failureMessage: null,
          durationMs: 3000,
          toolExecutionCount: 1,
          retryCount: 0,
          lastRepairAction: null,
          resultSummary: 'All caught up',
          startedAt: '2026-03-29T09:00:00.000Z',
          finishedAt: '2026-03-29T09:00:03.000Z',
          toolExecutions: []
        }
      });

    await expect(listSchedules('token')).resolves.toMatchObject({
      schedules: [
        expect.objectContaining({
          latestRunId: 'run-1',
          latestRunStatus: 'COMPLETED',
          latestRunStage: 'FINALIZING',
          latestRequestId: 'request-1',
          latestSessionId: 'session-1',
          latestMessageId: 'message-1',
          latestToolExecutionCount: 1
        })
      ]
    });
    await expect(listRuns('token')).resolves.toMatchObject({
      runs: [expect.objectContaining({ status: 'COMPLETED' })]
    });
    await expect(getRun('token', 'run-1')).resolves.toMatchObject({
      run: expect.objectContaining({
        status: 'COMPLETED',
        requestId: 'request-1',
        messageId: 'message-1'
      })
    });
  });
});
