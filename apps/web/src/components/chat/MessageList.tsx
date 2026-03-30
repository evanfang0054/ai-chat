import type { UIMessage } from 'ai';
import { MessageItem } from './MessageItem';

export function MessageList({ messages }: { messages: UIMessage[] }) {
  return (
    <div className="space-y-6">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
}
