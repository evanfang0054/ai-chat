import Markdown from 'react-markdown';
import type { ChatMessage } from '@ai-chat/shared';

import { Card } from '../ui';

export function MessageItem({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'USER';

  return (
    <Card className={[
      'p-4',
      isUser ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-slate-800 bg-slate-900/60'
    ].join(' ')}>
      <strong className="text-sm text-slate-200">{isUser ? 'You' : 'Assistant'}</strong>
      <div className="prose prose-invert mt-2 max-w-none prose-p:my-2">
        <Markdown>{message.content}</Markdown>
      </div>
    </Card>
  );
}
