import type { ToolExecutionSummary } from '@ai-chat/shared';
import { ToolExecutionItem } from './ToolExecutionItem';

export function ToolExecutionList({ toolExecutions }: { toolExecutions: ToolExecutionSummary[] }) {
  if (toolExecutions.length === 0) {
    return null;
  }

  return (
    <div>
      {toolExecutions.map((toolExecution) => (
        <ToolExecutionItem key={toolExecution.id} toolExecution={toolExecution} />
      ))}
    </div>
  );
}
