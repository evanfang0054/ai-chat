import type { ToolExecutionSummary } from '@ai-chat/shared';
import { Badge, Card } from '../ui';

const statusVariant: Record<ToolExecutionSummary['status'], 'success' | 'warning' | 'error'> = {
  PENDING: 'warning',
  RUNNING: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'error',
  CANCELLED: 'error'
};

export function ToolExecutionItem({ execution }: { execution: ToolExecutionSummary }) {
  return (
    <Card className="p-4 bg-[rgb(var(--surface-muted))]">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-[rgb(var(--accent)/0.1)] p-2 shrink-0">
          <svg className="h-4 w-4 text-[rgb(var(--accent))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-[rgb(var(--foreground))]">{execution.toolName}</span>
            <Badge variant={statusVariant[execution.status]}>{execution.status}</Badge>
          </div>
          {execution.output && (
            <pre className="mt-2 overflow-x-auto rounded-md bg-[rgb(var(--background))] p-3 text-xs text-[rgb(var(--foreground-secondary))]">
              {execution.output}
            </pre>
          )}
          {execution.errorMessage && (
            <div className="mt-2 text-sm text-[rgb(var(--error))]">{execution.errorMessage}</div>
          )}
        </div>
      </div>
    </Card>
  );
}
