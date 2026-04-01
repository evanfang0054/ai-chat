import type { CreateScheduleRequest, ScheduleSummary, UpdateScheduleRequest } from '@ai-chat/shared';

import { Badge, Button, Card, Input, Textarea } from '../ui';

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
  if (!datePart || !timePart) {
    return null;
  }

  const [year, month, day] = datePart.split('-').map(Number);
  const [hours, minutes] = timePart.split(':').map(Number);
  if ([year, month, day, hours, minutes].some((part) => Number.isNaN(part))) {
    return null;
  }

  return new Date(year, month - 1, day, hours, minutes).toISOString();
}

export function ScheduleForm(props: {
  initial?: ScheduleSummary;
  onSubmit: (payload: CreateScheduleRequest | UpdateScheduleRequest) => Promise<void>;
  onCancel?: () => void;
}) {
  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const title = String(formData.get('title') || '').trim();
    const taskPrompt = String(formData.get('taskPrompt') || '').trim();
    const type = String(formData.get('type') || props.initial?.type || 'ONE_TIME') as 'CRON' | 'ONE_TIME';
    const timezone = String(formData.get('timezone') || 'UTC').trim() || 'UTC';

    if (!title || !taskPrompt) {
      return;
    }

    if (type === 'CRON') {
      const cronExpr = String(formData.get('cronExpr') || '').trim();
      if (!cronExpr) {
        return;
      }

      await props.onSubmit({
        title,
        taskPrompt,
        type,
        cronExpr,
        timezone
      });
      form.reset();
      return;
    }

    const runAtLocal = String(formData.get('runAt') || '').trim();
    const runAt = toIsoFromDatetimeLocal(runAtLocal);
    if (!runAt) {
      return;
    }

    await props.onSubmit({
      title,
      taskPrompt,
      type,
      runAt,
      timezone
    });
    form.reset();
  }

  return (
    <Card className="p-6">
      <h2 className="text-lg font-semibold text-[rgb(var(--foreground))] mb-4">
        {props.initial ? 'Edit Schedule' : 'Create Schedule'}
      </h2>
      <form className="space-y-4" onSubmit={handleSubmit}>
        <div>
          <label className="block text-sm font-medium text-slate-200">
            Title
            <Input name="title" type="text" required defaultValue={props.initial?.title ?? ''} />
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-200">
            Task Prompt
            <Textarea name="taskPrompt" required rows={4} defaultValue={props.initial?.taskPrompt ?? ''} />
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-200">
            Type
            <select
              className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              name="type"
              defaultValue={props.initial?.type ?? 'ONE_TIME'}
            >
              <option value="ONE_TIME">ONE_TIME</option>
              <option value="CRON">CRON</option>
            </select>
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-200">
            Run At
            <Input
              name="runAt"
              type="datetime-local"
              defaultValue={
                props.initial && props.initial.type === 'ONE_TIME' ? toDatetimeLocalValue(props.initial.runAt) : undefined
              }
            />
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-200">
            Cron Expression
            <Input
              name="cronExpr"
              type="text"
              placeholder="0 9 * * *"
              defaultValue={props.initial && props.initial.type === 'CRON' ? props.initial.cronExpr : ''}
            />
          </label>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-200">
            Timezone
            <Input name="timezone" type="text" defaultValue={props.initial?.timezone ?? 'UTC'} />
          </label>
        </div>
        <div className="flex gap-2">
          <Button type="submit">{props.initial ? 'Save' : 'Create Schedule'}</Button>
          {props.onCancel && (
            <Button type="button" variant="secondary" onClick={props.onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </form>
    </Card>
  );
}

function scheduleTime(schedule: ScheduleSummary) {
  return schedule.type === 'CRON' ? schedule.cronExpr : schedule.runAt;
}

const runStatusLabel: Record<string, string> = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  COMPLETED: 'Completed',
  FAILED: 'Failed',
  CANCELLED: 'Cancelled'
};

function formatRunStatus(status: string | null | undefined) {
  if (!status) {
    return '—';
  }

  return runStatusLabel[status] ?? status;
}

function formatRunStage(stage: string | null | undefined) {
  if (!stage) {
    return '—';
  }

  return stage
    .toLowerCase()
    .split('_')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
}

function ScheduleHealthSummary(props: { schedule: ScheduleSummary }) {
  const { schedule } = props;

  return (
    <div className="space-y-1 text-sm text-slate-400">
      <div>Next Run: {schedule.nextRunAt ?? '—'}</div>
      <div>Latest Run: {schedule.latestRunId ?? '—'}</div>
      <div>Latest Status: {formatRunStatus(schedule.latestRunStatus)}</div>
      <div>Latest Stage: {formatRunStage(schedule.latestRunStage)}</div>
      <div>Latest Request: {schedule.latestRequestId ?? '—'}</div>
      <div>Latest Session: {schedule.latestSessionId ?? '—'}</div>
      <div>Latest Message: {schedule.latestMessageId ?? '—'}</div>
      <div>Latest Tools: {schedule.latestToolExecutionCount}</div>
      <div>Latest Started: {schedule.latestRunStartedAt ?? '—'}</div>
      <div>Latest Finished: {schedule.latestRunFinishedAt ?? '—'}</div>
      <div>Latest Failure: {schedule.latestFailureMessage ?? '—'}</div>
      <div>Latest Result: {schedule.latestResultSummary ?? '—'}</div>
    </div>
  );
}

export function ScheduleList(props: {
  schedules: ScheduleSummary[];
  onToggle: (schedule: ScheduleSummary) => Promise<void>;
  onEdit: (schedule: ScheduleSummary) => void;
  onDelete: (schedule: ScheduleSummary) => Promise<void>;
}) {
  return (
    <section>
      <h2 className="mb-3 text-lg font-semibold">Schedules</h2>
      {props.schedules.length === 0 ? (
        <Card className="p-4 text-sm text-slate-300">No schedules yet.</Card>
      ) : (
        <ul className="space-y-3">
          {props.schedules.map((schedule) => (
            <li key={schedule.id}>
              <Card className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-base">{schedule.title}</strong>
                  <Badge variant={schedule.enabled ? 'success' : 'warning'}>
                    {schedule.enabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </div>
                <div className="text-sm text-slate-200">{schedule.type}</div>
                <div className="text-sm text-slate-300">{schedule.taskPrompt}</div>
                <div className="text-sm text-slate-400">{scheduleTime(schedule)}</div>
                <ScheduleHealthSummary schedule={schedule} />
                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" onClick={() => props.onEdit(schedule)}>
                    Edit
                  </Button>
                  <Button variant="secondary" onClick={() => props.onToggle(schedule)}>
                    {schedule.enabled ? 'Disable' : 'Enable'}
                  </Button>
                  <Button variant="danger" onClick={() => props.onDelete(schedule)}>
                    Delete
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
