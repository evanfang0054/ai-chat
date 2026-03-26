import type { ChatMessage } from '@ai-chat/shared';
import { MessageItem } from './MessageItem';

export function MessageList({ messages }: { messages: ChatMessage[] }) {
  return (
    <div>
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
}
