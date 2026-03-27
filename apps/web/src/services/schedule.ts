import type {
  CreateScheduleRequest,
  GetScheduleRunResponse,
  ListScheduleRunsResponse,
  ListSchedulesResponse,
  ScheduleSummary,
  UpdateScheduleRequest
} from '@ai-chat/shared';

import { apiFetch } from '../lib/api';

export function listSchedules(accessToken: string, filters?: { enabled?: boolean; type?: string }) {
  const params = new URLSearchParams();
  if (filters?.enabled !== undefined) {
    params.set('enabled', filters.enabled ? 'true' : 'false');
  }
  if (filters?.type) {
    params.set('type', filters.type);
  }
  const query = params.toString();
  return apiFetch<ListSchedulesResponse>(`/schedules${query ? `?${query}` : ''}`, { accessToken });
}

export function createSchedule(accessToken: string, payload: CreateScheduleRequest) {
  return apiFetch<ScheduleSummary>('/schedules', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(payload)
  });
}

export function updateSchedule(accessToken: string, id: string, payload: UpdateScheduleRequest) {
  return apiFetch<ScheduleSummary>(`/schedules/${id}`, {
    method: 'PATCH',
    accessToken,
    body: JSON.stringify(payload)
  });
}

export function enableSchedule(accessToken: string, id: string) {
  return apiFetch<ScheduleSummary>(`/schedules/${id}/enable`, {
    method: 'POST',
    accessToken
  });
}

export function disableSchedule(accessToken: string, id: string) {
  return apiFetch<ScheduleSummary>(`/schedules/${id}/disable`, {
    method: 'POST',
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
  return apiFetch<ListScheduleRunsResponse>(`/runs${query ? `?${query}` : ''}`, { accessToken });
}

export function getRun(accessToken: string, id: string) {
  return apiFetch<GetScheduleRunResponse>(`/runs/${id}`, { accessToken });
}
