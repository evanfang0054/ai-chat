import type { UIMessage } from 'ai';
import { Card } from '../ui';

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
        <div className="whitespace-pre-wrap text-sm text-[rgb(var(--foreground))]">
          {message.content}
        </div>
      </Card>
    </div>
  );
}
