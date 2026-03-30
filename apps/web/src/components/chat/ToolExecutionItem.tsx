import type { ToolExecutionSummary } from '@ai-chat/shared';

import { Badge, Card } from '../ui';

const statusLabel: Record<ToolExecutionSummary['status'], string> = {
  RUNNING: '运行中',
  SUCCEEDED: '已完成',
  FAILED: '失败'
};

const statusVariant: Record<ToolExecutionSummary['status'], 'warning' | 'success'> = {
  RUNNING: 'warning',
  SUCCEEDED: 'success',
  FAILED: 'warning'
};

export function ToolExecutionItem({ toolExecution }: { toolExecution: ToolExecutionSummary }) {
  return (
    <Card className="space-y-2 p-4">
      <div className="flex items-center justify-between gap-3">
        <strong className="text-sm text-slate-100">工具 {toolExecution.toolName}</strong>
        <Badge variant={statusVariant[toolExecution.status]}>{statusLabel[toolExecution.status]}</Badge>
      </div>
      {toolExecution.input ? <div className="text-sm text-slate-300">输入：{toolExecution.input}</div> : null}
      {toolExecution.output ? <div className="text-sm text-slate-300">输出：{toolExecution.output}</div> : null}
      {toolExecution.errorMessage ? <div className="text-sm text-rose-300">错误：{toolExecution.errorMessage}</div> : null}
    </Card>
  );
}
