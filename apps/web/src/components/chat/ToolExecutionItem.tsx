import type { ToolExecutionSummary } from '@ai-chat/shared';

const statusLabel: Record<ToolExecutionSummary['status'], string> = {
  RUNNING: '运行中',
  SUCCEEDED: '已完成',
  FAILED: '失败'
};

export function ToolExecutionItem({ toolExecution }: { toolExecution: ToolExecutionSummary }) {
  return (
    <div>
      <strong>
        工具 {toolExecution.toolName} · {statusLabel[toolExecution.status]}
      </strong>
      {toolExecution.input ? <div>输入：{toolExecution.input}</div> : null}
      {toolExecution.output ? <div>输出：{toolExecution.output}</div> : null}
      {toolExecution.errorMessage ? <div>错误：{toolExecution.errorMessage}</div> : null}
    </div>
  );
}
