import { useCallback, useEffect, useRef, useState } from 'react';
import type { RunToolExecutionSummary, ScheduleRunSummary } from '@ai-chat/shared';

import { AppShell } from '../../components/layout/AppShell';
import { Button, Card, Input } from '../../components/ui';
import { RunList } from '../../components/runs/RunList';
import { useAuthStore } from '../../stores/auth-store';
import { getRun, listRuns, retryRun } from '../../services/schedule';

const runStatusLabel: Record<string, string> = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed'
};

function formatRunStatus(status: string) {
  return runStatusLabel[status] ?? status;
}

function RunDiagnosticsCard(props: {
  run: ScheduleRunSummary & {
    toolExecutions?: RunToolExecutionSummary[];
  };
}) {
  const { run } = props;

  return (
    <div className="space-y-2 text-sm">
      <div>Run ID: {run.id}</div>
      <div>Schedule ID: {run.scheduleId}</div>
      <div>Chat Session ID: {run.chatSessionId ?? '—'}</div>
      <div>Status: {formatRunStatus(run.status)}</div>
      <div>Stage: {run.stage}</div>
      <div>Error Category: {run.errorCategory ?? '—'}</div>
      <div>Tool Calls: {run.toolExecutionCount}</div>
      {run.toolExecutions?.length ? (
        <div>
          <div>Tools:</div>
          <ul className="mt-1 space-y-1 text-slate-300">
            {run.toolExecutions.map((tool) => (
              <li key={tool.id}>
                {tool.toolName} · {tool.status}
                {tool.errorCategory ? ` · ${tool.errorCategory}` : ''}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <div>Prompt: {run.taskPromptSnapshot}</div>
      <div>Started: {run.startedAt ?? '—'}</div>
      <div>Finished: {run.finishedAt ?? '—'}</div>
      <div>Result: {run.resultSummary ?? '—'}</div>
      <div className={run.errorMessage ? 'text-rose-300' : 'text-slate-100'}>Error: {run.errorMessage ?? '—'}</div>
    </div>
  );
}

export function RunsPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [runs, setRuns] = useState<ScheduleRunSummary[]>([]);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<ScheduleRunSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [scheduleIdFilter, setScheduleIdFilter] = useState('');
  const [isRetrying, setIsRetrying] = useState(false);
  const latestSelectionRequestIdRef = useRef(0);
  const currentRunIdRef = useRef<string | null>(null);

  useEffect(() => {
    currentRunIdRef.current = currentRunId;
  }, [currentRunId]);

  const syncSelection = useCallback((nextRuns: ScheduleRunSummary[], preferredRunId?: string | null) => {
    const nextCurrentRunId = preferredRunId && nextRuns.some((run) => run.id === preferredRunId)
      ? preferredRunId
      : (nextRuns[0]?.id ?? null);

    currentRunIdRef.current = nextCurrentRunId;
    setCurrentRunId(nextCurrentRunId);
    setSelectedRun(nextRuns.find((run) => run.id === nextCurrentRunId) ?? null);
    return nextCurrentRunId;
  }, []);

  const loadRunDetails = useCallback(async (runId: string) => {
    if (!accessToken) {
      return;
    }

    const requestId = latestSelectionRequestIdRef.current + 1;
    latestSelectionRequestIdRef.current = requestId;
    const { run } = await getRun(accessToken, runId);
    if (latestSelectionRequestIdRef.current === requestId) {
      setSelectedRun(run);
    }
  }, [accessToken]);

  const selectRun = useCallback((runId: string) => {
    currentRunIdRef.current = runId;
    setCurrentRunId(runId);
    setSelectedRun((currentSelectedRun) => runs.find((run) => run.id === runId) ?? currentSelectedRun);
    void loadRunDetails(runId);
  }, [loadRunDetails, runs]);

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    void listRuns(accessToken, {
      status: statusFilter || undefined,
      scheduleId: scheduleIdFilter.trim() || undefined
    }).then(({ runs: nextRuns }) => {
      setRuns((currentRuns) => {
        const preservedRuns = currentRuns.filter((run) => !nextRuns.some((nextRun) => nextRun.id === run.id));
        const mergedRuns = [...preservedRuns, ...nextRuns];
        const nextCurrentRunId = syncSelection(mergedRuns, currentRunIdRef.current);
        if (nextCurrentRunId) {
          void loadRunDetails(nextCurrentRunId);
        }
        return mergedRuns;
      });
    });
  }, [accessToken, loadRunDetails, scheduleIdFilter, statusFilter, syncSelection]);

  const handleRetry = async () => {
    if (!accessToken || !selectedRun || isRetrying) {
      return;
    }

    setIsRetrying(true);
    try {
      const { run } = await retryRun(accessToken, selectedRun.id);
      latestSelectionRequestIdRef.current += 1;
      setRuns((currentRuns) => {
        const nextRuns = [run, ...currentRuns.filter((currentRun) => currentRun.id !== run.id)];
        syncSelection(nextRuns, run.id);
        return nextRuns;
      });
      setSelectedRun(run);
    } finally {
      setIsRetrying(false);
    }
  };

  return (
    <AppShell>
      <Card className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--foreground))]">Runs</h1>
        <p className="mt-1 text-sm text-[rgb(var(--foreground-secondary))]">查看任务执行记录</p>
      </Card>

      <Card className="mb-4 space-y-3 p-4">
        <h2 className="text-base font-semibold">Filters</h2>
        <div className="flex flex-wrap gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-200">
              Status
              <select
                className="mt-1 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">All</option>
                <option value="PENDING">Pending</option>
                <option value="RUNNING">Running</option>
                <option value="SUCCEEDED">Succeeded</option>
                <option value="FAILED">Failed</option>
              </select>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-200">
              Schedule ID
              <Input
                className="mt-1"
                value={scheduleIdFilter}
                onChange={(event) => setScheduleIdFilter(event.target.value)}
              />
            </label>
          </div>
        </div>
      </Card>

      <RunList runs={runs} currentRunId={currentRunId} onSelect={selectRun} />

      <Card className="p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold">Run Details</h2>
          <Button
            type="button"
            variant="secondary"
            disabled={!selectedRun || selectedRun.status === 'RUNNING' || isRetrying}
            onClick={handleRetry}
          >
            Retry Run
          </Button>
        </div>
        <p className="mb-3 text-xs text-[rgb(var(--foreground-secondary))]">
          Tick may be consumed by another API instance if Redis is shared.
        </p>
        {!selectedRun ? (
          <p className="text-sm text-slate-300">Select a run to inspect.</p>
        ) : (
          <RunDiagnosticsCard run={selectedRun} />
        )}
      </Card>
    </AppShell>
  );
}
