import { Link } from 'react-router-dom';
import type { ScheduleRunSummary } from '@ai-chat/shared';

import { Badge, Button, Card } from '../ui';

const fieldHintClassName = 'text-sm text-[rgb(var(--foreground-secondary))]';
const chatLinkClassName =
  'inline-flex items-center justify-center rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm font-medium text-[rgb(var(--foreground))] transition-colors hover:bg-[rgb(var(--surface-muted))]';

const runStatusLabel: Record<string, string> = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed'
};

function formatRunStatus(status: string) {
  return runStatusLabel[status] ?? status;
}

export function RunList(props: {
  runs: ScheduleRunSummary[];
  currentRunId: string | null;
  onSelect: (runId: string) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-[rgb(var(--foreground))]">Runs</h2>
      {props.runs.length === 0 ? (
        <Card className="p-4 text-sm text-[rgb(var(--foreground-secondary))]">No runs yet.</Card>
      ) : (
        <ul className="space-y-3">
          {props.runs.map((run) => (
            <li key={run.id}>
              <Card className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-base text-[rgb(var(--foreground))]">{run.schedule.title}</strong>
                  <Badge variant={run.status === 'SUCCEEDED' ? 'success' : run.status === 'FAILED' ? 'error' : 'warning'}>
                    {formatRunStatus(run.status)}
                  </Badge>
                </div>
                <div className="text-sm text-[rgb(var(--foreground))]">{run.taskPromptSnapshot}</div>
                <div className={fieldHintClassName}>
                  Started: {run.startedAt ?? '—'} · Finished: {run.finishedAt ?? '—'}
                </div>
                {run.resultSummary && <div className="text-sm text-[rgb(var(--foreground))]">Result: {run.resultSummary}</div>}
                {run.errorMessage && <div className="text-sm text-[rgb(var(--error))]">Error: {run.errorMessage}</div>}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={props.currentRunId === run.id}
                    onClick={() => props.onSelect(run.id)}
                  >
                    View Details
                  </Button>
                  {run.chatSessionId && (
                    <Link className={chatLinkClassName} to={`/chat?sessionId=${run.chatSessionId}`}>
                      Open Chat
                    </Link>
                  )}
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
