import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from 'react-router-dom';
import type { UIMessage } from 'ai';
import type { GetChatTimelineResponse, ToolExecutionSummary } from '@ai-chat/shared';
import * as chatService from '../services/chat';
import { router } from '../router';
import { useAuthStore } from '../stores/auth-store';
import { useChatStore } from '../stores/chat-store';
import { ThemeProvider } from '../contexts/theme-context';

const useChatMock = vi.hoisted(() => {
  return {
    appendCalls: [] as Array<{ message: UIMessage; options?: { body?: object } }>,
    appendError: null as Error | null,
    nextMessages: [] as UIMessage[],
    unstableRuntimeHelpers: false
  };
});

vi.mock('@ai-sdk/react', async () => {
  const React = await import('react');

  return {
    useChat: (options: {
      experimental_prepareRequestBody?: (payload: { messages: UIMessage[]; requestBody?: object }) => object;
      onFinish?: () => Promise<void> | void;
      onError?: (error: Error) => void;
    }) => {
      const [messages, setMessages] = React.useState<UIMessage[]>([]);
      const [status, setStatus] = React.useState<'ready' | 'submitted' | 'streaming' | 'error'>('ready');
      const optionsRef = React.useRef(options);
      const messagesRef = React.useRef(messages);

      React.useEffect(() => {
        optionsRef.current = options;
      }, [options]);

      React.useEffect(() => {
        messagesRef.current = messages;
      }, [messages]);

      const appendImpl = async (message: UIMessage, requestOptions?: { body?: object }) => {
        const preparedBody = optionsRef.current.experimental_prepareRequestBody?.({
          messages: [...messagesRef.current, message],
          requestBody: requestOptions?.body
        });

        useChatMock.appendCalls.push({
          message,
          options: preparedBody ? { ...requestOptions, body: preparedBody } : requestOptions
        });
        setStatus('submitted');

        if (useChatMock.appendError) {
          setStatus('error');
          optionsRef.current.onError?.(useChatMock.appendError);
          return;
        }

        setMessages(useChatMock.nextMessages);
        setStatus('ready');
        await optionsRef.current.onFinish?.();
      };

      const append = useChatMock.unstableRuntimeHelpers
        ? appendImpl
        : React.useCallback(async (message: UIMessage, requestOptions?: { body?: object }) => {
            await appendImpl(message, requestOptions);
          }, []);

      const replaceMessagesImpl = (nextMessages: UIMessage[]) => {
        setMessages(nextMessages);
      };

      const replaceMessages = useChatMock.unstableRuntimeHelpers
        ? replaceMessagesImpl
        : React.useCallback((nextMessages: UIMessage[]) => {
            replaceMessagesImpl(nextMessages);
          }, []);

      return {
        messages,
        setMessages: replaceMessages,
        status,
        append
      };
    }
  };
});


function signIn() {
  useAuthStore.getState().setAuth({
    accessToken: 'token-123',
    refreshToken: 'refresh-123',
    user: {
      id: 'user-1',
      email: 'user@example.com',
      role: 'USER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    }
  });
}

function createSession(id: string, title: string) {
  const now = new Date().toISOString();

  return {
    id,
    title,
    model: 'deepseek-chat',
    createdAt: now,
    updatedAt: now
  };
}

function createTimeline(
  sessionId: string,
  content: string,
  assistantContent?: string,
  withToolExecution = false
): GetChatTimelineResponse {
  const now = new Date().toISOString();
  const userMessage = {
    id: `msg-${sessionId}`,
    sessionId,
    runId: null,
    role: 'USER' as const,
    content,
    createdAt: now
  };
  const assistantMessage = assistantContent
    ? {
        id: `msg-${sessionId}-assistant`,
        sessionId,
        runId: `run-${sessionId}`,
        role: 'ASSISTANT' as const,
        content: assistantContent,
        createdAt: now
      }
    : null;

  const toolExecutions: ToolExecutionSummary[] =
    assistantMessage && withToolExecution
      ? [
          {
            id: `tool-${sessionId}`,
            sessionId,
            runId: `run-${sessionId}`,
            messageId: assistantMessage.id,
            toolName: 'manage_schedule',
            status: 'SUCCEEDED',
            progressMessage: null,
            input: JSON.stringify({ query: content }),
            output: JSON.stringify({ summary: 'Created schedule' }),
            partialOutput: null,
            errorCategory: null,
            errorMessage: null,
            canRetry: false,
            canCancel: false,
            startedAt: now,
            finishedAt: now
          }
        ]
      : [];

  return {
    session: createSession(sessionId, sessionId === 'session-2' ? 'Session Two' : 'Session One'),
    run: assistantMessage
      ? {
          id: `run-${sessionId}`,
          sessionId,
          messageId: assistantMessage.id,
          scheduleId: null,
          status: 'COMPLETED' as const,
          stage: 'FINALIZING' as const,
          triggerSource: 'USER' as const,
          failureCategory: null,
          failureCode: null,
          failureMessage: null,
          startedAt: now,
          finishedAt: now
        }
      : null,
    messages: [userMessage, ...(assistantMessage ? [assistantMessage] : [])],
    toolExecutions,
    timeline: [
      {
        kind: 'message' as const,
        id: `timeline-${userMessage.id}`,
        sessionId,
        runId: userMessage.runId,
        messageId: userMessage.id,
        createdAt: userMessage.createdAt,
        message: userMessage
      },
      ...(assistantMessage
        ? [
            {
              kind: 'message' as const,
              id: `timeline-${assistantMessage.id}`,
              sessionId,
              runId: assistantMessage.runId,
              messageId: assistantMessage.id,
              createdAt: assistantMessage.createdAt,
              message: assistantMessage
            }
          ]
        : [])
    ]
  };
}

function createUiMessages(userContent: string, assistantContent: string): UIMessage[] {
  return [
    {
      id: 'msg-user',
      role: 'user',
      content: userContent,
      parts: [{ type: 'text', text: userContent }]
    },
    {
      id: 'msg-assistant',
      role: 'assistant',
      content: assistantContent,
      parts: [{ type: 'text', text: assistantContent }]
    }
  ];
}

function createUiMessagesWithTool(userContent: string, assistantContent: string): UIMessage[] {
  return [
    {
      id: 'msg-user',
      role: 'user',
      content: userContent,
      parts: [{ type: 'text', text: userContent }]
    },
    {
      id: 'msg-assistant',
      role: 'assistant',
      content: assistantContent,
      parts: [
        { type: 'text', text: assistantContent },
        {
          type: 'tool-invocation',
          toolInvocation: {
            state: 'result',
            toolCallId: 'tool-1',
            toolName: 'manage_schedule',
            args: { query: userContent },
            result: { summary: 'Created schedule' }
          }
        }
      ]
    }
  ];
}

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  useAuthStore.getState().clearAuth();
  useChatStore.getState().reset();
  useChatMock.appendCalls = [];
  useChatMock.appendError = null;
  useChatMock.nextMessages = [];
  useChatMock.unstableRuntimeHelpers = false;
  await router.navigate('/');
});

describe('ChatPage', () => {
  it('redirects /chat to /login when unauthenticated', async () => {
    await router.navigate('/chat');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    expect(await screen.findByText(/Welcome to AI Chat/i)).toBeInTheDocument();
  });

  it('renders empty state on /chat when there is no session', async () => {
    signIn();
    vi.spyOn(chatService, 'listChatSessions').mockResolvedValue({ sessions: [] });

    await router.navigate('/chat');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    expect(await screen.findByText('开始一个新的对话')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Chat' })).toHaveAttribute('href', '/chat');
    expect(screen.getByRole('link', { name: 'Schedules' })).toHaveAttribute('href', '/schedules');
    expect(screen.getByRole('link', { name: 'Runs' })).toHaveAttribute('href', '/runs');
  });

  it('binds useChat runtime into the store and refreshes sessions after finish', async () => {
    signIn();
    useChatMock.nextMessages = createUiMessages('Hello AI', 'Hi there');

    vi.spyOn(chatService, 'listChatSessions')
      .mockResolvedValueOnce({ sessions: [] })
      .mockResolvedValueOnce({ sessions: [createSession('session-1', 'Hello AI')] });
    vi.spyOn(chatService, 'getChatMessages').mockResolvedValue(createTimeline('session-1', 'Hello AI', 'Hi there'));

    await router.navigate('/chat');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    await screen.findByText('开始一个新的对话');
    await waitFor(() => {
      expect(useChatStore.getState().runtime.append).toEqual(expect.any(Function));
      expect(useChatStore.getState().runtime.replaceMessages).toEqual(expect.any(Function));
    });
    await userEvent.type(screen.getByRole('textbox'), 'Hello AI');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Hi there')).toBeInTheDocument();
    expect(useChatMock.appendCalls).toHaveLength(1);
    expect(useChatMock.appendCalls[0]).toMatchObject({
      message: {
        role: 'user',
        content: 'Hello AI'
      },
      options: {
        body: {
          content: 'Hello AI'
        }
      }
    });
    expect(await screen.findByRole('button', { name: 'Session One' })).toBeInTheDocument();
  });

  it('clears bound runtime exits when chat page unmounts', async () => {
    signIn();
    vi.spyOn(chatService, 'listChatSessions').mockResolvedValue({ sessions: [] });

    await router.navigate('/chat');
    const view = render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    await screen.findByText('开始一个新的对话');
    await waitFor(() => {
      expect(useChatStore.getState().runtime.append).toEqual(expect.any(Function));
      expect(useChatStore.getState().runtime.replaceMessages).toEqual(expect.any(Function));
    });

    view.unmount();

    expect(useChatStore.getState().runtime).toEqual({
      append: null,
      replaceMessages: null,
      status: 'ready'
    });
  });

  it('does not clear runtime when useChat helpers change identity across renders', async () => {
    signIn();
    useChatMock.unstableRuntimeHelpers = true;
    useChatMock.nextMessages = createUiMessages('Hello AI', 'Hi there');

    vi.spyOn(chatService, 'listChatSessions')
      .mockResolvedValueOnce({ sessions: [] })
      .mockResolvedValueOnce({ sessions: [createSession('session-1', 'Hello AI')] });
    vi.spyOn(chatService, 'getChatMessages').mockResolvedValue(createTimeline('session-1', 'Hello AI', 'Hi there'));

    await router.navigate('/chat');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    await screen.findByText('开始一个新的对话');
    await userEvent.type(screen.getByRole('textbox'), 'Hello AI');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('Hi there')).toBeInTheDocument();
    expect(useChatStore.getState().runtime.append).toEqual(expect.any(Function));
    expect(useChatStore.getState().runtime.replaceMessages).toEqual(expect.any(Function));
  });

  it('prepares a minimal request body for the stream endpoint', async () => {
    signIn();
    useChatMock.nextMessages = createUiMessages('Hello AI', 'Hi there');

    vi.spyOn(chatService, 'listChatSessions')
      .mockResolvedValueOnce({ sessions: [] })
      .mockResolvedValueOnce({ sessions: [createSession('session-1', 'Hello AI')] });
    vi.spyOn(chatService, 'getChatMessages').mockResolvedValue(createTimeline('session-1', 'Hello AI', 'Hi there'));

    await router.navigate('/chat');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    await screen.findByText('开始一个新的对话');
    await userEvent.type(screen.getByRole('textbox'), 'Hello AI');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(useChatMock.appendCalls[0]?.options?.body).toEqual({
      content: 'Hello AI'
    });
  });

  it('renders tool invocation parts from projected chat messages', async () => {
    signIn();
    useChatMock.nextMessages = createUiMessagesWithTool('Create a schedule', 'Done');

    vi.spyOn(chatService, 'listChatSessions')
      .mockResolvedValueOnce({ sessions: [] })
      .mockResolvedValueOnce({ sessions: [createSession('session-1', 'Create a schedule')] });
    vi.spyOn(chatService, 'getChatMessages').mockResolvedValue(createTimeline('session-1', 'Create a schedule', 'Done', true));

    await router.navigate('/chat');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    await screen.findByText('开始一个新的对话');
    await userEvent.type(screen.getByRole('textbox'), 'Create a schedule');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('manage_schedule')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText(/Created schedule/)).toBeInTheDocument();
  });

  it('loads requested session from search params', async () => {
    signIn();

    vi.spyOn(chatService, 'listChatSessions').mockResolvedValue({
      sessions: [createSession('session-1', 'Session One'), createSession('session-2', 'Session Two')]
    });

    const getChatMessages = vi
      .spyOn(chatService, 'getChatMessages')
      .mockImplementation(async (_token, sessionId) => createTimeline(sessionId, sessionId === 'session-2' ? 'Loaded requested session' : 'Loaded default session'));

    await router.navigate('/chat?sessionId=session-2');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    expect(await screen.findByText('Loaded requested session')).toBeInTheDocument();
    expect(getChatMessages).toHaveBeenCalledWith('token-123', 'session-2');
  });

  it('loads messages when switching sessions', async () => {
    signIn();

    vi.spyOn(chatService, 'listChatSessions').mockResolvedValue({
      sessions: [createSession('session-1', 'Session One'), createSession('session-2', 'Session Two')]
    });

    const getChatMessages = vi
      .spyOn(chatService, 'getChatMessages')
      .mockImplementation(async (_token, sessionId) => createTimeline(sessionId, sessionId === 'session-2' ? 'Loaded session two' : 'Loaded session one'));

    await router.navigate('/chat');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    expect(await screen.findByText('Loaded session one')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Session Two' }));

    expect(await screen.findByText('Loaded session two')).toBeInTheDocument();
    expect(getChatMessages).toHaveBeenCalledWith('token-123', 'session-2');
  });

  it('clears current messages when starting a new chat', async () => {
    signIn();

    vi.spyOn(chatService, 'listChatSessions').mockResolvedValue({
      sessions: [createSession('session-1', 'Session One')]
    });
    vi.spyOn(chatService, 'getChatMessages').mockResolvedValue(createTimeline('session-1', 'Loaded from API'));

    await router.navigate('/chat');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    expect(await screen.findByText('Loaded from API')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'New Chat' }));

    await waitFor(() => {
      expect(screen.queryByText('Loaded from API')).not.toBeInTheDocument();
    });
    expect(screen.getByText('开始一个新的对话')).toBeInTheDocument();
  });

  it('shows empty state before first message and recovery action after failed stream', async () => {
    signIn();
    useChatMock.appendError = new Error('发送失败');

    vi.spyOn(chatService, 'listChatSessions').mockResolvedValue({ sessions: [] });

    await router.navigate('/chat');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    expect(await screen.findByText('开始一个新的对话')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox'), 'Hello AI');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('发送失败')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '重试上一条消息' })).toBeInTheDocument();
  });

  it('retries the last message and recovers after a failed stream', async () => {
    signIn();
    useChatMock.appendError = new Error('发送失败');

    vi.spyOn(chatService, 'listChatSessions')
      .mockResolvedValueOnce({ sessions: [] })
      .mockResolvedValueOnce({ sessions: [createSession('session-1', 'Hello AI')] });
    vi.spyOn(chatService, 'getChatMessages').mockResolvedValue(createTimeline('session-1', 'Hello AI', 'Recovered reply'));

    await router.navigate('/chat');
    render(
      <ThemeProvider>
        <RouterProvider router={router} />
      </ThemeProvider>
    );

    await screen.findByText('开始一个新的对话');
    await userEvent.type(screen.getByRole('textbox'), 'Hello AI');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect(await screen.findByText('发送失败')).toBeInTheDocument();

    useChatMock.appendError = null;
    useChatMock.nextMessages = createUiMessages('Hello AI', 'Recovered reply');
    await userEvent.click(screen.getByRole('button', { name: '重试上一条消息' }));

    expect(await screen.findByText('Recovered reply')).toBeInTheDocument();
    expect(screen.queryByText('发送失败')).not.toBeInTheDocument();
    expect(useChatMock.appendCalls).toHaveLength(2);
    expect(useChatMock.appendCalls[1]).toMatchObject({
      message: {
        role: 'user',
        content: 'Hello AI'
      },
      options: {
        body: {
          content: 'Hello AI'
        }
      }
    });
  });

});
