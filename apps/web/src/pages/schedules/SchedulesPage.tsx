import { useEffect, useState } from 'react';
import type { CreateScheduleRequest, ScheduleSummary, UpdateScheduleRequest } from '@ai-chat/shared';

import { ScheduleForm, ScheduleList } from '../../components/schedules/ScheduleForm';
import { AppShell } from '../../components/layout/AppShell';
import { useAuthStore } from '../../stores/auth-store';
import {
  createSchedule,
  disableSchedule,
  enableSchedule,
  listSchedules,
  updateSchedule
} from '../../services/schedule';

export function SchedulesPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);
  const [editingSchedule, setEditingSchedule] = useState<ScheduleSummary | null>(null);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    listSchedules(accessToken).then(({ schedules }) => {
      setSchedules(schedules);
    });
  }, [accessToken]);

  async function handleCreate(payload: CreateScheduleRequest | UpdateScheduleRequest) {
    if (!accessToken || editingSchedule) {
      return;
    }

    const created = await createSchedule(accessToken, payload as CreateScheduleRequest);
    setSchedules((current) => [created, ...current]);
  }

  async function handleUpdate(payload: CreateScheduleRequest | UpdateScheduleRequest) {
    if (!accessToken || !editingSchedule) {
      return;
    }

    const updated = await updateSchedule(accessToken, editingSchedule.id, payload as UpdateScheduleRequest);
    setSchedules((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setEditingSchedule(updated);
  }

  async function handleToggle(schedule: ScheduleSummary) {
    if (!accessToken) {
      return;
    }

    const updated = schedule.enabled
      ? await disableSchedule(accessToken, schedule.id)
      : await enableSchedule(accessToken, schedule.id);

    setSchedules((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    if (editingSchedule?.id === updated.id) {
      setEditingSchedule(updated);
    }
  }

  return (
    <AppShell>
      <h1>Schedules</h1>
      <ScheduleForm onSubmit={handleCreate} />
      {editingSchedule && (
        <ScheduleForm
          initial={editingSchedule}
          onSubmit={handleUpdate}
          onCancel={() => setEditingSchedule(null)}
        />
      )}
      <ScheduleList schedules={schedules} onToggle={handleToggle} onEdit={setEditingSchedule} />
    </AppShell>
  );
}
