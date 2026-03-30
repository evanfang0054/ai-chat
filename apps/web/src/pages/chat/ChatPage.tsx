import { useEffect, useMemo, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { useSearchParams } from 'react-router-dom';
import { EmptyChatState } from '../../components/chat/EmptyChatState';
import { SessionSidebar } from '../../components/chat/SessionSidebar';
import { MessageList } from '../../components/chat/MessageList';
import { ChatComposer } from '../../components/chat/ChatComposer';
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import { useChatStore } from '../../stores/chat-store';
import {
  createChatRequestBody,
  createUiMessagesFromTimeline,
  getChatMessages,
  getChatStreamUrl,
  listChatSessions
} from '../../services/chat';

export function ChatPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [searchParams] = useSearchParams();
  const requestedSessionId = searchParams.get('sessionId');
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { sessions, currentSessionId, setSessions, setCurrentSession, upsertSession } = useChatStore();

  const headers = useMemo(
    () => (accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined),
    [accessToken]
  );

  const { append, messages: liveMessages, setMessages: setLiveMessages, status } = useChat({
    api: getChatStreamUrl(),
    headers,
    streamProtocol: 'data',
    experimental_prepareRequestBody({ messages, requestBody }) {
      return requestBody ?? {};
    },
    onResponse: async (response) => {
      if (!response.ok) {
        throw new Error('发送失败，请稍后重试。');
      }
    },
    onFinish: async () => {
      if (!accessToken) {
        return;
      }

      const { sessions: nextSessions } = await listChatSessions(accessToken);
      setSessions(nextSessions);
      const nextCurrentSession = nextSessions.find((session) => session.id === currentSessionId) ?? nextSessions[0] ?? null;
      if (nextCurrentSession) {
        setCurrentSession(nextCurrentSession.id);
        upsertSession(nextCurrentSession);
      }
    },
    onError: (error) => {
      setErrorMessage(error.message || '发送失败，请稍后重试。');
    }
  });

  useEffect(() => {
    setMessages(liveMessages);
  }, [liveMessages]);

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
    if (!accessToken || !currentSessionId) {
      setMessages([]);
      setLiveMessages([]);
      return;
    }

    getChatMessages(accessToken, currentSessionId).then((timeline) => {
      const nextMessages = createUiMessagesFromTimeline(timeline);
      setMessages(nextMessages);
      setLiveMessages(nextMessages);
      upsertSession(timeline.session);
    });
  }, [accessToken, currentSessionId, setLiveMessages, upsertSession]);

  async function handleSubmit() {
    if (!accessToken || !input.trim() || status === 'submitted' || status === 'streaming') {
      return;
    }

    setErrorMessage(null);

    const content = input.trim();
    setInput('');

    await append(
      {
        role: 'user',
        content,
        parts: [{ type: 'text', text: content }]
      },
      {
        body: createChatRequestBody({
          content,
          sessionId: currentSessionId ?? undefined
        })
      }
    );
  }

  const isStreaming = status === 'submitted' || status === 'streaming';
  const hasMessages = messages.length > 0;

  return (
    <AppShell
      sidebar={
        <SessionSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onNewChat={() => {
            setCurrentSession(null);
            setMessages([]);
            setLiveMessages([]);
            setErrorMessage(null);
          }}
          onSelect={setCurrentSession}
        />
      }
    >
      <Card className="p-4">
        <h1 className="text-xl font-semibold">Chat</h1>
      </Card>
      {!hasMessages ? <EmptyChatState /> : <MessageList messages={messages} />}
      {errorMessage ? (
        <Card className="border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-200">{errorMessage}</Card>
      ) : null}
      <ChatComposer value={input} disabled={isStreaming || !accessToken} onChange={setInput} onSubmit={handleSubmit} />
    </AppShell>
  );
}
