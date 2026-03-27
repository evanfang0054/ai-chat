import { Link } from 'react-router-dom';
import type { ScheduleRunSummary } from '@ai-chat/shared';

export function RunList(props: {
  runs: ScheduleRunSummary[];
  currentRunId: string | null;
  onSelect: (runId: string) => void;
}) {
  return (
    <section>
      <h2>Runs</h2>
      {props.runs.length === 0 ? (
        <p>No runs yet.</p>
      ) : (
        <ul>
          {props.runs.map((run) => (
            <li key={run.id}>
              <button type="button" onClick={() => props.onSelect(run.id)} disabled={props.currentRunId === run.id}>
                View Details
              </button>
              {run.chatSessionId && <Link to={`/chat?sessionId=${run.chatSessionId}`}>Open Chat</Link>}
              <strong>{run.schedule.title}</strong>
              <div>Status: {run.status}</div>
              <div>Prompt: {run.taskPromptSnapshot}</div>
              <div>Started: {run.startedAt ?? '—'}</div>
              <div>Finished: {run.finishedAt ?? '—'}</div>
              <div>Result: {run.resultSummary ?? '—'}</div>
              <div>Error: {run.errorMessage ?? '—'}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
