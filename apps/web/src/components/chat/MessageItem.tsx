import Markdown from 'react-markdown';
import type { ChatMessage } from '@ai-chat/shared';

export function MessageItem({ message }: { message: ChatMessage }) {
  return (
    <div>
      <strong>{message.role === 'USER' ? 'You' : 'Assistant'}</strong>
      <Markdown>{message.content}</Markdown>
    </div>
  );
}
