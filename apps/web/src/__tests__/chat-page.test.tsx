import '@testing-library/jest-dom/vitest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RouterProvider } from 'react-router-dom';
import * as chatService from '../services/chat';
import { router } from '../router';
import { useAuthStore } from '../stores/auth-store';
import { useChatStore } from '../stores/chat-store';

afterEach(async () => {
  cleanup();
  vi.restoreAllMocks();
  useAuthStore.getState().clearAuth();
  useChatStore.getState().reset();
  await router.navigate('/');
});

describe('ChatPage', () => {
  it('redirects /chat to /login when unauthenticated', async () => {
    await router.navigate('/chat');
    render(<RouterProvider router={router} />);

    expect(await screen.findByText(/login/i)).toBeInTheDocument();
  });

  it('renders empty state on /chat when there is no session', async () => {
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

    vi.spyOn(chatService, 'listChatSessions').mockResolvedValue({ sessions: [] });

    await router.navigate('/chat');
    render(<RouterProvider router={router} />);

    expect(await screen.findByText('开始一个新的对话')).toBeInTheDocument();
  });

  it('shows local user message immediately and streams assistant response', async () => {
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

    vi.spyOn(chatService, 'listChatSessions').mockResolvedValue({ sessions: [] });
    vi.spyOn(chatService, 'streamChatMessage').mockImplementation(async (_token, _payload, onEvent) => {
      onEvent({
        type: 'started',
        session: {
          id: 'session-1',
          title: 'Hello AI',
          model: 'deepseek-chat',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        userMessage: {
          id: 'msg-user',
          sessionId: 'session-1',
          role: 'USER',
          content: 'Hello AI',
          createdAt: new Date().toISOString()
        }
      });
      onEvent({ type: 'delta', delta: 'Hi' });
      onEvent({ type: 'delta', delta: ' there' });
      onEvent({
        type: 'completed',
        session: {
          id: 'session-1',
          title: 'Hello AI',
          model: 'deepseek-chat',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        },
        message: {
          id: 'msg-assistant',
          sessionId: 'session-1',
          role: 'ASSISTANT',
          content: 'Hi there',
          createdAt: new Date().toISOString()
        }
      });
    });

    await router.navigate('/chat');
    render(<RouterProvider router={router} />);

    await screen.findByText('开始一个新的对话');
    await userEvent.type(screen.getByRole('textbox'), 'Hello AI');
    await userEvent.click(screen.getByRole('button', { name: 'Send' }));

    expect((await screen.findAllByText('Hello AI')).length).toBeGreaterThan(0);
    expect(await screen.findByText('Hi there')).toBeInTheDocument();
  });

  it('loads messages when switching sessions', async () => {
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

    vi.spyOn(chatService, 'listChatSessions').mockResolvedValue({
      sessions: [
        {
          id: 'session-1',
          title: 'Session One',
          model: 'deepseek-chat',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ]
    });

    vi.spyOn(chatService, 'getChatMessages').mockResolvedValue({
      session: {
        id: 'session-1',
        title: 'Session One',
        model: 'deepseek-chat',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      },
      messages: [
        {
          id: 'msg-1',
          sessionId: 'session-1',
          role: 'USER',
          content: 'Loaded from API',
          createdAt: new Date().toISOString()
        }
      ]
    });

    await router.navigate('/chat');
    render(<RouterProvider router={router} />);

    expect(await screen.findByText('Loaded from API')).toBeInTheDocument();
  });
});
