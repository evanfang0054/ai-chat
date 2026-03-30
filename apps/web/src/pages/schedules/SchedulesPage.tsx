import { useEffect, useState } from 'react';
import type { CreateScheduleRequest, ScheduleSummary, UpdateScheduleRequest } from '@ai-chat/shared';

import { ScheduleForm, ScheduleList } from '../../components/schedules/ScheduleForm';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import {
  createSchedule,
  deleteSchedule,
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

  async function handleDelete(schedule: ScheduleSummary) {
    if (!accessToken) {
      return;
    }

    await deleteSchedule(accessToken, schedule.id);
    setSchedules((current) => current.filter((item) => item.id !== schedule.id));
    if (editingSchedule?.id === schedule.id) {
      setEditingSchedule(null);
    }
  }

  return (
    <AppShell>
      <Card className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--foreground))]">Schedules</h1>
        <p className="mt-1 text-sm text-[rgb(var(--foreground-secondary))]">管理定时任务</p>
      </Card>
      <ScheduleForm onSubmit={handleCreate} />
      {editingSchedule && (
        <ScheduleForm
          initial={editingSchedule}
          onSubmit={handleUpdate}
          onCancel={() => setEditingSchedule(null)}
        />
      )}
      <ScheduleList schedules={schedules} onToggle={handleToggle} onEdit={setEditingSchedule} onDelete={handleDelete} />
    </AppShell>
  );
}
