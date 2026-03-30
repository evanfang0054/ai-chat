import type { ChatSessionSummary } from '@ai-chat/shared';
import { Button, Card } from '../ui';
import { SessionList } from './SessionList';

export function SessionSidebar(props: {
  sessions: ChatSessionSummary[];
  currentSessionId: string | null;
  onNewChat: () => void;
  onSelect: (sessionId: string) => void;
}) {
  return (
    <aside className="w-full max-w-xs shrink-0">
      <Card className="space-y-3 p-3">
        <Button className="w-full" onClick={props.onNewChat}>
          New Chat
        </Button>
        <SessionList
          sessions={props.sessions}
          currentSessionId={props.currentSessionId}
          onSelect={props.onSelect}
        />
      </Card>
    </aside>
  );
}
