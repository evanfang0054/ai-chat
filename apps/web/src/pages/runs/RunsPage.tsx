import { useEffect, useState } from 'react';
import type { ScheduleRunSummary } from '@ai-chat/shared';

import { AppShell } from '../../components/layout/AppShell';
import { Card, Input } from '../../components/ui';
import { RunList } from '../../components/runs/RunList';
import { useAuthStore } from '../../stores/auth-store';
import { getRun, listRuns } from '../../services/schedule';

export function RunsPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [runs, setRuns] = useState<ScheduleRunSummary[]>([]);
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [selectedRun, setSelectedRun] = useState<ScheduleRunSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [scheduleIdFilter, setScheduleIdFilter] = useState('');

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    listRuns(accessToken, {
      status: statusFilter || undefined,
      scheduleId: scheduleIdFilter.trim() || undefined
    }).then(({ runs }) => {
      setRuns(runs);
      const firstRun = runs[0] ?? null;
      setCurrentRunId(firstRun?.id ?? null);
      setSelectedRun(firstRun);
    });
  }, [accessToken, scheduleIdFilter, statusFilter]);

  useEffect(() => {
    if (!accessToken || !currentRunId) {
      return;
    }

    getRun(accessToken, currentRunId).then(({ run }) => {
      setSelectedRun(run);
    });
  }, [accessToken, currentRunId]);

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
                <option value="PENDING">PENDING</option>
                <option value="RUNNING">RUNNING</option>
                <option value="SUCCEEDED">SUCCEEDED</option>
                <option value="FAILED">FAILED</option>
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

      <RunList runs={runs} currentRunId={currentRunId} onSelect={setCurrentRunId} />

      <Card className="p-4">
        <h2 className="mb-3 text-base font-semibold">Run Details</h2>
        {!selectedRun ? (
          <p className="text-sm text-slate-300">Select a run to inspect.</p>
        ) : (
          <div className="space-y-2 text-sm">
            <div>Run ID: {selectedRun.id}</div>
            <div>Schedule ID: {selectedRun.scheduleId}</div>
            <div>Chat Session ID: {selectedRun.chatSessionId ?? '—'}</div>
            <div>Status: {selectedRun.status}</div>
            <div>Prompt: {selectedRun.taskPromptSnapshot}</div>
            <div>Started: {selectedRun.startedAt ?? '—'}</div>
            <div>Finished: {selectedRun.finishedAt ?? '—'}</div>
            <div>Result: {selectedRun.resultSummary ?? '—'}</div>
            <div className={selectedRun.errorMessage ? 'text-rose-300' : 'text-slate-100'}>
              Error: {selectedRun.errorMessage ?? '—'}
            </div>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
