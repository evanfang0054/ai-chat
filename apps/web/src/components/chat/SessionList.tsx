import type { ChatSessionSummary } from '@ai-chat/shared';

export function SessionList(props: {
  sessions: ChatSessionSummary[];
  currentSessionId: string | null;
  onSelect: (sessionId: string) => void;
}) {
  return (
    <div className="space-y-2">
      {props.sessions.map((session) => {
        const isActive = session.id === props.currentSessionId;
        return (
          <button
            key={session.id}
            className={[
              'w-full rounded-md border px-3 py-2 text-left text-sm transition-colors',
              isActive
                ? 'border-cyan-400/60 bg-cyan-500/10 text-slate-100'
                : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700 hover:text-slate-100'
            ].join(' ')}
            onClick={() => props.onSelect(session.id)}
            type="button"
          >
            {session.title}
          </button>
        );
      })}
    </div>
  );
}
