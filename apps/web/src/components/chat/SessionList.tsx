import type { ChatSessionSummary } from '@ai-chat/shared';

export function SessionList(props: {
  sessions: ChatSessionSummary[];
  currentSessionId: string | null;
  onSelect: (sessionId: string) => void;
}) {
  return (
    <div>
      {props.sessions.map((session) => (
        <button key={session.id} onClick={() => props.onSelect(session.id)}>
          {session.title}
        </button>
      ))}
    </div>
  );
}
