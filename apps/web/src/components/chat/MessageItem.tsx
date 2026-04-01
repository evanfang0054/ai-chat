import type { UIMessage } from 'ai';
import { Badge, Card } from '../ui';

function formatToolInvocationResult(result: unknown) {
  if (result == null) {
    return null;
  }

  return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
}

export function MessageItem({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <Card
        className={`max-w-[80%] p-4 ${
          isUser
            ? 'bg-[rgb(var(--accent)/0.1)] border-[rgb(var(--accent)/0.2)]'
            : 'bg-[rgb(var(--surface))]'
        }`}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-medium text-[rgb(var(--foreground-secondary))]">
            {isUser ? 'You' : 'Assistant'}
          </span>
        </div>
        <div className="space-y-3 text-sm text-[rgb(var(--foreground))]">
          {message.parts?.length
            ? message.parts.map((part, index) => {
                if (part.type === 'text') {
                  return (
                    <div key={`${message.id}-text-${index}`} className="whitespace-pre-wrap">
                      {part.text}
                    </div>
                  );
                }

                if (part.type === 'tool-invocation') {
                  const invocation = part.toolInvocation;
                  const result = invocation.state === 'result' ? formatToolInvocationResult(invocation.result) : null;

                  return (
                    <div
                      key={`${message.id}-tool-${index}`}
                      className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface-muted))] p-3"
                    >
                      <div className="mb-2 flex items-center gap-2">
                        <span className="font-medium">{invocation.toolName}</span>
                        <Badge variant={invocation.state === 'result' ? 'success' : 'warning'}>
                          {invocation.state === 'result' ? 'completed' : 'running'}
                        </Badge>
                      </div>
                      <pre className="overflow-x-auto rounded bg-[rgb(var(--background))] p-2 text-xs text-[rgb(var(--foreground-secondary))]">
                        {JSON.stringify(invocation.args, null, 2)}
                      </pre>
                      {result ? (
                        <pre className="mt-2 overflow-x-auto rounded bg-[rgb(var(--background))] p-2 text-xs text-[rgb(var(--foreground-secondary))]">
                          {result}
                        </pre>
                      ) : null}
                    </div>
                  );
                }

                return null;
              })
            : <div className="whitespace-pre-wrap">{message.content}</div>}
        </div>
      </Card>
    </div>
  );
}
