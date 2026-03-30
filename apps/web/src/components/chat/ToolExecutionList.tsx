import type { ToolExecutionSummary } from '@ai-chat/shared';
import { ToolExecutionItem } from './ToolExecutionItem';

export function ToolExecutionList({ toolExecutions }: { toolExecutions: ToolExecutionSummary[] }) {
  if (toolExecutions.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {toolExecutions.map((toolExecution) => (
        <ToolExecutionItem key={toolExecution.id} execution={toolExecution} />
      ))}
    </div>
  );
}
