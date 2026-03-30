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
      <Card className="space-y-4 p-4">
        <Button className="w-full" onClick={props.onNewChat}>
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
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
