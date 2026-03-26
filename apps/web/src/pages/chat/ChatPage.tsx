import { useEffect } from 'react';
import { EmptyChatState } from '../../components/chat/EmptyChatState';
import { SessionSidebar } from '../../components/chat/SessionSidebar';
import { MessageList } from '../../components/chat/MessageList';
import { ChatComposer } from '../../components/chat/ChatComposer';
import { useAuthStore } from '../../stores/auth-store';
import { useChatStore } from '../../stores/chat-store';
import { listChatSessions, getChatMessages, streamChatMessage } from '../../services/chat';

export function ChatPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const {
    sessions,
    currentSessionId,
    messages,
    draft,
    isStreaming,
    setSessions,
    setCurrentSession,
    setMessages,
    setDraft,
    applyStreamStarted,
    applyStreamDelta,
    applyStreamCompleted,
    applyStreamError
  } = useChatStore();

  useEffect(() => {
    if (!accessToken) {
      return;
    }

    listChatSessions(accessToken).then(({ sessions }) => {
      setSessions(sessions);
      if (sessions[0]) {
        setCurrentSession(sessions[0].id);
      }
    });
  }, [accessToken, setCurrentSession, setSessions]);

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
          if (event.type === 'started') {
            applyStreamStarted(event.session, event.userMessage);
            return;
          }

          if (event.type === 'delta') {
            applyStreamDelta(event.delta);
            return;
          }

          if (event.type === 'completed') {
            applyStreamCompleted(event.session, event.message);
            return;
          }

          if (event.type === 'error') {
            applyStreamError(event.message);
          }
        }
      );
    } catch {
      applyStreamError('发送失败，请稍后重试。');
    }
  }

  return (
    <div>
      <SessionSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={() => {
          setCurrentSession(null);
          setMessages([]);
        }}
        onSelect={setCurrentSession}
      />

      <main>
        {messages.length === 0 ? <EmptyChatState /> : <MessageList messages={messages} />}
        <ChatComposer value={draft} disabled={isStreaming} onChange={setDraft} onSubmit={handleSubmit} />
      </main>
    </div>
  );
}
