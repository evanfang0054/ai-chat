import { useEffect, useState } from 'react';
import type { ScheduleRunSummary } from '@ai-chat/shared';

import { AppShell } from '../../components/layout/AppShell';
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
      <h1>Runs</h1>
      <section>
        <h2>Filters</h2>
        <div>
          <label>
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All</option>
              <option value="PENDING">PENDING</option>
              <option value="RUNNING">RUNNING</option>
              <option value="SUCCEEDED">SUCCEEDED</option>
              <option value="FAILED">FAILED</option>
            </select>
          </label>
        </div>
        <div>
          <label>
            Schedule ID
            <input
              type="text"
              value={scheduleIdFilter}
              onChange={(event) => setScheduleIdFilter(event.target.value)}
            />
          </label>
        </div>
      </section>
      <RunList runs={runs} currentRunId={currentRunId} onSelect={setCurrentRunId} />
      <section>
        <h2>Run Details</h2>
        {!selectedRun ? (
          <p>Select a run to inspect.</p>
        ) : (
          <div>
            <div>Run ID: {selectedRun.id}</div>
            <div>Schedule ID: {selectedRun.scheduleId}</div>
            <div>Chat Session ID: {selectedRun.chatSessionId ?? '—'}</div>
            <div>Status: {selectedRun.status}</div>
            <div>Prompt: {selectedRun.taskPromptSnapshot}</div>
            <div>Started: {selectedRun.startedAt ?? '—'}</div>
            <div>Finished: {selectedRun.finishedAt ?? '—'}</div>
            <div>Result: {selectedRun.resultSummary ?? '—'}</div>
            <div>Error: {selectedRun.errorMessage ?? '—'}</div>
          </div>
        )}
      </section>
    </AppShell>
  );
}
