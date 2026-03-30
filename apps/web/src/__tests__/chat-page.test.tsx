import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from 'react-router-dom';
import type { UIMessage } from 'ai';
import * as chatService from '../services/chat';
import { router } from '../router';
import { useAuthStore } from '../stores/auth-store';
import { useChatStore } from '../stores/chat-store';
import { ThemeProvider } from '../contexts/theme-context';

const useChatMock = vi.hoisted(() => {
  return {
    appendCalls: [] as Array<{ message: UIMessage; options?: { body?: object } }>,
    appendError: null as Error | null,
    nextMessages: [] as UIMessage[]
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

      return {
        messages,
        setMessages,
        status,
        append: async (message: UIMessage, requestOptions?: { body?: object }) => {
          const preparedBody = options.experimental_prepareRequestBody?.({
            messages: [...messages, message],
            requestBody: requestOptions?.body
          });

          useChatMock.appendCalls.push({
            message,
            options: preparedBody ? { ...requestOptions, body: preparedBody } : requestOptions
          });
          setStatus('submitted');

          if (useChatMock.appendError) {
            setStatus('error');
            options.onError?.(useChatMock.appendError);
            return;
          }

          setMessages(useChatMock.nextMessages);
          setStatus('ready');
          await options.onFinish?.();
        }
      };
    }
  };
});


function signIn() {
  useAuthStore.getState().setAuth({
    accessToken: 'token-123',
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

function createTimeline(sessionId: string, content: string, assistantContent?: string) {
  const now = new Date().toISOString();

  return {
    session: createSession(sessionId, sessionId === 'session-2' ? 'Session Two' : 'Session One'),
    messages: [
      {
        id: `msg-${sessionId}`,
        sessionId,
        role: 'USER' as const,
        content,
        createdAt: now
      },
      ...(assistantContent
        ? [
            {
              id: `msg-${sessionId}-assistant`,
              sessionId,
              role: 'ASSISTANT' as const,
              content: assistantContent,
              createdAt: now
            }
          ]
        : [])
    ],
    toolExecutions: []
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

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  useAuthStore.getState().clearAuth();
  useChatStore.getState().reset();
  useChatMock.appendCalls = [];
  useChatMock.appendError = null;
  useChatMock.nextMessages = [];
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

  it('submits with useChat and refreshes sessions after finish', async () => {
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

  it('loads messages for requested session from query string', async () => {
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

  it('shows stream error when append fails', async () => {
    signIn();
    useChatMock.appendError = new Error('发送失败');

    vi.spyOn(chatService, 'listChatSessions').mockResolvedValue({ sessions: [] });

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
  });
});
