import type { CreateScheduleRequest, ScheduleSummary, UpdateScheduleRequest } from '@ai-chat/shared';

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

    if (props.initial) {
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
      if (!runAtLocal) {
        return;
      }

      await props.onSubmit({
        title,
        taskPrompt,
        type,
        runAt: new Date(runAtLocal).toISOString(),
        timezone
      });
      form.reset();
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
    if (!runAtLocal) {
      return;
    }

    await props.onSubmit({
      title,
      taskPrompt,
      type,
      runAt: new Date(runAtLocal).toISOString(),
      timezone
    });
    form.reset();
  }

  return (
    <form onSubmit={handleSubmit}>
      <h2>{props.initial ? 'Edit Schedule' : 'Create Schedule'}</h2>
      <div>
        <label>
          Title
          <input name="title" type="text" required defaultValue={props.initial?.title ?? ''} />
        </label>
      </div>
      <div>
        <label>
          Task Prompt
          <textarea name="taskPrompt" required rows={4} defaultValue={props.initial?.taskPrompt ?? ''} />
        </label>
      </div>
      <div>
        <label>
          Type
          <select name="type" defaultValue={props.initial?.type ?? 'ONE_TIME'}>
            <option value="ONE_TIME">ONE_TIME</option>
            <option value="CRON">CRON</option>
          </select>
        </label>
      </div>
      <div>
        <label>
          Run At
          <input
            name="runAt"
            type="datetime-local"
            defaultValue={
              props.initial && props.initial.type === 'ONE_TIME'
                ? props.initial.runAt.slice(0, 16)
                : undefined
            }
          />
        </label>
      </div>
      <div>
        <label>
          Cron Expression
          <input
            name="cronExpr"
            type="text"
            placeholder="0 9 * * *"
            defaultValue={props.initial && props.initial.type === 'CRON' ? props.initial.cronExpr : ''}
          />
        </label>
      </div>
      <div>
        <label>
          Timezone
          <input name="timezone" type="text" defaultValue={props.initial?.timezone ?? 'UTC'} />
        </label>
      </div>
      <button type="submit">{props.initial ? 'Save' : 'Create Schedule'}</button>
      {props.onCancel && (
        <button type="button" onClick={props.onCancel}>
          Cancel
        </button>
      )}
    </form>
  );
}

function scheduleTime(schedule: ScheduleSummary) {
  return schedule.type === 'CRON' ? schedule.cronExpr : schedule.runAt;
}

export function ScheduleList(props: {
  schedules: ScheduleSummary[];
  onToggle: (schedule: ScheduleSummary) => Promise<void>;
  onEdit: (schedule: ScheduleSummary) => void;
}) {
  return (
    <section>
      <h2>Schedules</h2>
      {props.schedules.length === 0 ? (
        <p>No schedules yet.</p>
      ) : (
        <ul>
          {props.schedules.map((schedule) => (
            <li key={schedule.id}>
              <strong>{schedule.title}</strong>
              <div>{schedule.type}</div>
              <div>{schedule.taskPrompt}</div>
              <div>{scheduleTime(schedule)}</div>
              <div>{schedule.enabled ? 'Enabled' : 'Disabled'}</div>
              <div>Next run: {schedule.nextRunAt ?? '—'}</div>
              <button onClick={() => props.onEdit(schedule)}>Edit</button>
              <button onClick={() => props.onToggle(schedule)}>
                {schedule.enabled ? 'Disable' : 'Enable'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
