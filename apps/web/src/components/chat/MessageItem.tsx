import Markdown from 'react-markdown';
import type { ToolInvocation, UIMessage } from 'ai';

import { Badge, Card } from '../ui';

const statusLabel = {
  'partial-call': '运行中',
  call: '运行中',
  result: '已完成'
} satisfies Record<ToolInvocation['state'], string>;

function stringifyValue(value: unknown) {
  if (typeof value === 'string') {
    return value;
  }

  return JSON.stringify(value, null, 2);
}

function ToolInvocationCard({ toolInvocation }: { toolInvocation: ToolInvocation }) {
  const isError = toolInvocation.state === 'result' && typeof toolInvocation.result === 'object' && toolInvocation.result !== null && 'error' in toolInvocation.result;

  return (
    <Card className="mt-3 space-y-2 border-slate-700 bg-slate-950/80 p-3">
      <div className="flex items-center justify-between gap-3">
        <strong className="text-sm text-slate-100">工具 {toolInvocation.toolName}</strong>
        <Badge variant={toolInvocation.state === 'result' && !isError ? 'success' : 'warning'}>
          {toolInvocation.state === 'result' && isError ? '失败' : statusLabel[toolInvocation.state]}
        </Badge>
      </div>
      <div className="space-y-2 text-sm text-slate-300">
        <div>
          <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">输入</div>
          <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-2 text-xs">
            {stringifyValue(toolInvocation.args)}
          </pre>
        </div>
        {toolInvocation.state === 'result' ? (
          <div>
            <div className="mb-1 text-xs uppercase tracking-wide text-slate-400">输出</div>
            <pre className="overflow-x-auto whitespace-pre-wrap break-all rounded-md bg-slate-900 p-2 text-xs">
              {stringifyValue(toolInvocation.result)}
            </pre>
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export function MessageItem({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user';
  const textParts = message.parts.filter((part) => part.type === 'text');
  const toolParts = message.parts.filter((part) => part.type === 'tool-invocation');

  return (
    <Card className={[
      'p-4',
      isUser ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-slate-800 bg-slate-900/60'
    ].join(' ')}>
      <strong className="text-sm text-slate-200">{isUser ? 'You' : 'Assistant'}</strong>
      {textParts.map((part, index) => (
        <div key={`${message.id}-text-${index}`} className="prose prose-invert mt-2 max-w-none prose-p:my-2">
          <Markdown>{part.text}</Markdown>
        </div>
      ))}
      {toolParts.map((part, index) => (
        <ToolInvocationCard key={`${message.id}-tool-${index}`} toolInvocation={part.toolInvocation} />
      ))}
    </Card>
  );
}
