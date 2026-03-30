import { Link } from 'react-router-dom';
import type { ScheduleRunSummary } from '@ai-chat/shared';

import { Badge, Button, Card } from '../ui';

export function RunList(props: {
  runs: ScheduleRunSummary[];
  currentRunId: string | null;
  onSelect: (runId: string) => void;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Runs</h2>
      {props.runs.length === 0 ? (
        <Card className="p-4 text-sm text-slate-300">No runs yet.</Card>
      ) : (
        <ul className="space-y-3">
          {props.runs.map((run) => (
            <li key={run.id}>
              <Card className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-base">{run.schedule.title}</strong>
                  <Badge variant={run.status === 'SUCCEEDED' ? 'success' : 'warning'}>{run.status}</Badge>
                </div>
                <div className="text-sm text-slate-300">{run.taskPromptSnapshot}</div>
                <div className="text-sm text-slate-400">
                  Started: {run.startedAt ?? '—'} · Finished: {run.finishedAt ?? '—'}
                </div>
                {run.resultSummary && <div className="text-sm text-slate-300">Result: {run.resultSummary}</div>}
                {run.errorMessage && <div className="text-sm text-rose-300">Error: {run.errorMessage}</div>}
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    disabled={props.currentRunId === run.id}
                    onClick={() => props.onSelect(run.id)}
                  >
                    View Details
                  </Button>
                  {run.chatSessionId && (
                    <Link
                      className="inline-flex items-center justify-center rounded-md bg-slate-800 px-3 py-2 text-sm font-medium text-slate-100 transition-colors hover:bg-slate-700"
                      to={`/chat?sessionId=${run.chatSessionId}`}
                    >
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
