import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { EmptyChatState } from '../../components/chat/EmptyChatState';
import { SessionSidebar } from '../../components/chat/SessionSidebar';
import { MessageList } from '../../components/chat/MessageList';
import { ChatComposer } from '../../components/chat/ChatComposer';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import { useChatStore } from '../../stores/chat-store';
import { listChatSessions, getChatMessages, streamChatMessage } from '../../services/chat';

export function ChatPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [searchParams] = useSearchParams();
  const requestedSessionId = searchParams.get('sessionId');
  const {
    sessions,
    currentSessionId,
    messages,
    toolExecutions,
    draft,
    isStreaming,
    setSessions,
    setCurrentSession,
    setMessages,
    setDraft,
    applyRunStarted,
    applyToolStarted,
    applyToolCompleted,
    applyToolFailed,
    applyTextDelta,
    applyRunCompleted,
    applyRunFailed
  } = useChatStore();

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    listChatSessions(accessToken).then(({ sessions }) => {
      setSessions(sessions);
      const requestedSession = requestedSessionId
        ? sessions.find((session) => session.id === requestedSessionId) ?? null
        : null;
      const nextSession = requestedSession ?? sessions[0] ?? null;
      setCurrentSession(nextSession?.id ?? null);
    });
  }, [accessToken, requestedSessionId, setCurrentSession, setSessions]);

  useEffect(() => {
    if (!accessToken || !currentSessionId || messages.length > 0) {
      return;
    }

    getChatMessages(accessToken, currentSessionId).then(({ messages }) => {
      setMessages(messages);
    });
  }, [accessToken, currentSessionId, messages.length, setMessages]);

  async function handleSubmit() {
    if (!accessToken || !draft.trim() || isStreaming) {
      return;
    }

    try {
      await streamChatMessage(
        accessToken,
        {
          content: draft.trim(),
          sessionId: currentSessionId ?? undefined
        },
        (event) => {
          if (event.type === 'run_started') {
            applyRunStarted(event.session, event.userMessage);
            return;
          }

          if (event.type === 'tool_started') {
            applyToolStarted(event.toolExecution);
            return;
          }

          if (event.type === 'tool_completed') {
            applyToolCompleted(event.toolExecution);
            return;
          }

          if (event.type === 'tool_failed') {
            applyToolFailed(event.toolExecution);
            return;
          }

          if (event.type === 'text_delta') {
            applyTextDelta(event.delta);
            return;
          }

          if (event.type === 'run_completed') {
            applyRunCompleted(event.session, event.message);
            return;
          }

          if (event.type === 'run_failed') {
            applyRunFailed(event.message);
          }
        }
      );
    } catch {
      applyRunFailed('发送失败，请稍后重试。');
    }
  }

  return (
    <AppShell
      sidebar={
        <SessionSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onNewChat={() => {
            setCurrentSession(null);
            setMessages([]);
          }}
          onSelect={setCurrentSession}
        />
      }
    >
      <Card className="p-4">
        <h1 className="text-xl font-semibold">Chat</h1>
      </Card>
      {messages.length === 0 && toolExecutions.length === 0 ? (
        <EmptyChatState />
      ) : (
        <MessageList messages={messages} toolExecutions={toolExecutions} />
      )}
      <ChatComposer value={draft} disabled={isStreaming} onChange={setDraft} onSubmit={handleSubmit} />
    </AppShell>
  );
}
