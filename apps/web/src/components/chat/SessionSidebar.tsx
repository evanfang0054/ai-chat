import type { ChatSessionSummary } from '@ai-chat/shared';
import { SessionList } from './SessionList';

export function SessionSidebar(props: {
  sessions: ChatSessionSummary[];
  currentSessionId: string | null;
  onNewChat: () => void;
  onSelect: (sessionId: string) => void;
}) {
  return (
    <aside>
      <button onClick={props.onNewChat}>New Chat</button>
      <SessionList
        sessions={props.sessions}
        currentSessionId={props.currentSessionId}
        onSelect={props.onSelect}
      />
    </aside>
  );
}
