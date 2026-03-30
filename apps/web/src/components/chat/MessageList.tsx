import type { ChatMessage, ToolExecutionSummary } from '@ai-chat/shared';
import { MessageItem } from './MessageItem';
import { ToolExecutionList } from './ToolExecutionList';

export function MessageList({
  messages,
  toolExecutions
}: {
  messages: ChatMessage[];
  toolExecutions: ToolExecutionSummary[];
}) {
  return (
    <div className="space-y-4">
      <ToolExecutionList toolExecutions={toolExecutions} />
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
}
