import { useEffect, useMemo, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { useSearchParams } from 'react-router-dom';
import { EmptyChatState } from '../../components/chat/EmptyChatState';
import { SessionSidebar } from '../../components/chat/SessionSidebar';
import { MessageList } from '../../components/chat/MessageList';
import { ChatComposer } from '../../components/chat/ChatComposer';
import { AppShell } from '../../components/layout/AppShell';
import { Button, Card } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import { useChatStore } from '../../stores/chat-store';
import { getChatStreamUrl } from '../../services/chat';

export function ChatPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [searchParams] = useSearchParams();
  const requestedSessionId = searchParams.get('sessionId');
  const sessions = useChatStore((state) => state.sessions);
  const currentSessionId = useChatStore((state) => state.currentSessionId);
  const messages = useChatStore((state) => state.messages);
  const draftInput = useChatStore((state) => state.draftInput);
  const lastSubmittedMessage = useChatStore((state) => state.lastSubmittedMessage);
  const streamUiState = useChatStore((state) => state.streamUiState);
  const streamErrorMessage = useChatStore((state) => state.streamErrorMessage);
  const bindRuntime = useChatStore((state) => state.bindRuntime);
  const clearRuntime = useChatStore((state) => state.clearRuntime);
  const syncRuntime = useChatStore((state) => state.syncRuntime);
  const setDraftInput = useChatStore((state) => state.setDraftInput);
  const initializeChatPage = useChatStore((state) => state.initializeChatPage);
  const syncCurrentSessionMessages = useChatStore((state) => state.syncCurrentSessionMessages);
  const submitMessage = useChatStore((state) => state.submitMessage);
  const retryLastMessage = useChatStore((state) => state.retryLastMessage);
  const handleStreamFinish = useChatStore((state) => state.handleStreamFinish);
  const handleStreamError = useChatStore((state) => state.handleStreamError);
  const startNewChatWithReset = useChatStore((state) => state.startNewChatWithReset);
  const setCurrentSession = useChatStore((state) => state.setCurrentSession);

  const headers = useMemo(
    () => (accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined),
    [accessToken]
  );

  const { append, messages: liveMessages, setMessages: replaceMessages, status } = useChat({
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
      await handleStreamFinish(accessToken);
    },
    onError: (error) => {
      handleStreamError(error);
    }
  });

  const runtimeRef = useRef({ append, replaceMessages });

  useEffect(() => {
    runtimeRef.current = { append, replaceMessages };
    bindRuntime(runtimeRef.current);
  }, [append, bindRuntime, replaceMessages]);

  useEffect(() => {
    return () => {
      clearRuntime();
    };
  }, [clearRuntime]);

  useEffect(() => {
    syncRuntime({ status, messages: liveMessages });
  }, [liveMessages, status, syncRuntime]);

  useEffect(() => {
    void initializeChatPage(accessToken, requestedSessionId);
  }, [accessToken, initializeChatPage, requestedSessionId]);

  useEffect(() => {
    void syncCurrentSessionMessages(accessToken);
  }, [accessToken, currentSessionId, syncCurrentSessionMessages]);

  async function handleSubmit() {
    const content = draftInput.trim();
    if (!content) {
      return;
    }

    await submitMessage(content, accessToken);
  }

  async function handleRetryLastMessage() {
    if (!lastSubmittedMessage) {
      return;
    }

    await retryLastMessage(accessToken);
  }

  const isStreaming = status === 'submitted' || status === 'streaming';
  const hasMessages = messages.length > 0;

  return (
    <AppShell
      sidebar={
        <SessionSidebar
          sessions={sessions}
          currentSessionId={currentSessionId}
          onNewChat={startNewChatWithReset}
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
      <ChatComposer value={draftInput} disabled={isStreaming || !accessToken} onChange={setDraftInput} onSubmit={handleSubmit} />
    </AppShell>
  );
}
