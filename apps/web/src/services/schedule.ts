import type {
  CreateScheduleRequest,
  GetScheduleRunResponse,
  ListScheduleRunsResponse,
  ListSchedulesResponse,
  RetryScheduleRunResponse,
  ScheduleSummary,
  UpdateScheduleRequest
} from '@ai-chat/shared';

import { apiFetch } from '../lib/api';

type LegacyRunStatus = 'SUCCEEDED' | NonNullable<ScheduleSummary['latestRunStatus']>;

function normalizeRunStatus(status: LegacyRunStatus): NonNullable<ScheduleSummary['latestRunStatus']> {
  return status === 'SUCCEEDED' ? 'COMPLETED' : status;
}

export function normalizeRunDiagnostics(run: import('@ai-chat/shared').ScheduleRunSummary): import('@ai-chat/shared').ScheduleRunSummary {
  return {
    ...run,
    status: normalizeRunStatus(run.status as LegacyRunStatus)
  };
}

function normalizeScheduleSummary(schedule: ScheduleSummary): ScheduleSummary {
  if (!schedule.latestRunStatus) {
    return schedule;
  }

  return {
    ...schedule,
    latestRunStatus: normalizeRunStatus(schedule.latestRunStatus as LegacyRunStatus)
  };
}

export function listSchedules(accessToken: string, filters?: { enabled?: boolean; type?: string }) {
  const params = new URLSearchParams();
  if (filters?.enabled !== undefined) {
    params.set('enabled', filters.enabled ? 'true' : 'false');
  }
  if (filters?.type) {
    params.set('type', filters.type);
  }
  const query = params.toString();
  return apiFetch<ListSchedulesResponse>(`/schedules${query ? `?${query}` : ''}`, { accessToken }).then(({ schedules }) => ({
    schedules: schedules.map(normalizeScheduleSummary)
  }));
}

export function createSchedule(accessToken: string, payload: CreateScheduleRequest) {
  return apiFetch<ScheduleSummary>('/schedules', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(payload)
  }).then(normalizeScheduleSummary);
}

export function updateSchedule(accessToken: string, id: string, payload: UpdateScheduleRequest) {
  return apiFetch<ScheduleSummary>(`/schedules/${id}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(payload)
  }).then(normalizeScheduleSummary);
}

export function enableSchedule(accessToken: string, id: string) {
  return apiFetch<ScheduleSummary>(`/schedules/${id}/enable`, {
    method: 'POST',
    accessToken
  }).then(normalizeScheduleSummary);
}

export function disableSchedule(accessToken: string, id: string) {
  return apiFetch<ScheduleSummary>(`/schedules/${id}/disable`, {
    method: 'POST',
    accessToken
  }).then(normalizeScheduleSummary);
}

export function deleteSchedule(accessToken: string, id: string) {
  return apiFetch<{ deletedScheduleId: string }>(`/schedules/${id}`, {
    method: 'DELETE',
    accessToken
  });
}

export function listRuns(accessToken: string, filters?: { scheduleId?: string; status?: string }) {
  const params = new URLSearchParams();
  if (filters?.scheduleId) {
    params.set('scheduleId', filters.scheduleId);
  }
  if (filters?.status) {
    params.set('status', filters.status);
  }
  const query = params.toString();
  return apiFetch<ListScheduleRunsResponse>(`/runs${query ? `?${query}` : ''}`, { accessToken }).then(({ runs }) => ({
    runs: runs.map(normalizeRunDiagnostics)
  }));
}

export function getRun(accessToken: string, id: string) {
  return apiFetch<GetScheduleRunResponse>(`/runs/${id}`, { accessToken }).then(({ run }) => ({
    run: {
      ...normalizeRunDiagnostics(run),
      toolExecutions: run.toolExecutions
    }
  }));
}

export function retryRun(accessToken: string, id: string) {
  return apiFetch<RetryScheduleRunResponse>(`/runs/${id}/retry`, {
    method: 'POST',
    accessToken
  }).then(({ run }) => ({
    run: normalizeRunDiagnostics(run)
  }));
}
