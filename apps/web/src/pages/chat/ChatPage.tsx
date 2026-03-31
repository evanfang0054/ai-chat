import { useEffect, useMemo, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { useSearchParams } from 'react-router-dom';
import { EmptyChatState } from '../../components/chat/EmptyChatState';
import { SessionSidebar } from '../../components/chat/SessionSidebar';
import { MessageList } from '../../components/chat/MessageList';
import { ChatComposer } from '../../components/chat/ChatComposer';
import { AppShell } from '../../components/layout/AppShell';
import { Button, Card } from '../../components/ui';
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
  const [lastSubmittedMessage, setLastSubmittedMessage] = useState<string | null>(null);
  const {
    sessions,
    currentSessionId,
    streamUiState,
    streamErrorMessage,
    setSessions,
    setCurrentSession,
    upsertSession,
    setStreamFailed,
    setStreamIdle,
    setStreamStreaming
  } = useChatStore();

  const headers = useMemo(
    () => (accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined),
    [accessToken]
  );

  const { append, messages: liveMessages, setMessages: setLiveMessages, status } = useChat({
    api: getChatStreamUrl(),
    headers,
    streamProtocol: 'data',
    experimental_prepareRequestBody({ messages: _messages, requestBody }) {
      return requestBody ?? {};
    },
    onResponse: async (response) => {
      if (!response.ok) {
        throw new Error('发送失败，请稍后重试。');
      }
    },
    onFinish: async () => {
      setStreamIdle();

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
      setStreamFailed(error.message || '发送失败，请稍后重试。');
    }
  });

  useEffect(() => {
    setMessages(liveMessages);
  }, [liveMessages]);

  useEffect(() => {
    if (status === 'submitted' || status === 'streaming') {
      setStreamStreaming();
      return;
    }

    if (status === 'ready' && streamUiState === 'STREAMING') {
      setStreamIdle();
    }
  }, [setStreamIdle, setStreamStreaming, status, streamUiState]);

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

  async function submitMessage(content: string) {
    if (!accessToken || !content.trim() || status === 'submitted' || status === 'streaming') {
      return;
    }

    const trimmedContent = content.trim();
    setLastSubmittedMessage(trimmedContent);
    setStreamIdle();

    await append(
      {
        role: 'user',
        content: trimmedContent,
        parts: [{ type: 'text', text: trimmedContent }]
      },
      {
        body: createChatRequestBody({
          content: trimmedContent,
          sessionId: currentSessionId ?? undefined
        })
      }
    );
  }

  async function handleSubmit() {
    const content = input.trim();
    if (!content) {
      return;
    }

    setInput('');
    await submitMessage(content);
  }

  async function handleRetryLastMessage() {
    if (!lastSubmittedMessage) {
      return;
    }

    await submitMessage(lastSubmittedMessage);
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
            setLastSubmittedMessage(null);
            setStreamIdle();
          }}
          onSelect={setCurrentSession}
        />
      }
    >
      <Card className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--foreground))]">Chat</h1>
        <p className="mt-1 text-sm text-[rgb(var(--foreground-secondary))]">与 AI 助手对话</p>
      </Card>
      {streamUiState === 'IDLE' && !hasMessages ? <EmptyChatState /> : null}
      {hasMessages ? <MessageList messages={messages} /> : null}
      {streamUiState === 'FAILED' && streamErrorMessage ? (
        <Card className="border-[rgb(var(--error)/0.3)] bg-[rgb(var(--error)/0.05)] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 shrink-0 text-[rgb(var(--error))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-[rgb(var(--error))]">{streamErrorMessage}</span>
            </div>
            <Button type="button" variant="secondary" onClick={handleRetryLastMessage}>
              重试上一条消息
            </Button>
          </div>
        </Card>
      ) : null}
      <ChatComposer value={input} disabled={isStreaming || !accessToken} onChange={setInput} onSubmit={handleSubmit} />
    </AppShell>
  );
}
