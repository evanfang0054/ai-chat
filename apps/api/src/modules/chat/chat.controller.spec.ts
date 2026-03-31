process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_chat';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'change-me';
process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-key';
process.env.DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
process.env.DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

import type { Response } from 'express';
import { ChatController } from './chat.controller';

describe('ChatController', () => {
  const session = {
    id: 'session-1',
    userId: 'user-1',
    title: 'Ping',
    model: 'deepseek-chat',
    createdAt: '2026-03-26T12:00:00.000Z',
    updatedAt: '2026-03-26T12:00:00.000Z'
  };

  const userMessage = {
    id: 'message-1',
    sessionId: 'session-1',
    role: 'USER' as const,
    content: 'Ping',
    createdAt: '2026-03-26T12:00:00.000Z'
  };

  const finalizedMessage = {
    id: 'message-2',
    sessionId: 'session-1',
    role: 'ASSISTANT' as const,
    content: '',
    createdAt: '2026-03-26T12:00:01.000Z'
  };

  function createResponseRecorder() {
    const writes: string[] = [];
    let ended = false;
    let resolveEnded: (() => void) | null = null;
    const endPromise = new Promise<void>((resolve) => {
      resolveEnded = resolve;
    });
    const res = {
      setHeader: jest.fn(),
      writeHead: jest.fn(),
      write: jest.fn((chunk: string | Uint8Array) => {
        writes.push(typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf8'));
        return true;
      }),
      end: jest.fn(() => {
        ended = true;
        resolveEnded?.();
      }),
      statusCode: 200
    } as unknown as Response;

    return {
      res,
      writes,
      waitForEnd: async () => {
        if (!ended) {
          await endPromise;
        }
      }
    };
  }

  function createChatService(overrides: Record<string, unknown> = {}) {
    return {
      createSessionWithFirstMessage: jest.fn().mockResolvedValue({ session, userMessage }),
      getSessionOrThrow: jest.fn().mockResolvedValue(session),
      addUserMessage: jest.fn(),
      formatSessionSummary: jest.fn().mockImplementation((value) => value),
      formatMessage: jest.fn().mockImplementation((value) => value),
      listMessages: jest.fn().mockResolvedValue({ messages: [userMessage] }),
      finalizeAssistantReply: jest.fn().mockResolvedValue({
        session,
        message: finalizedMessage
      }),
      ...overrides
    };
  }

  it('emits agent-error and still finalizes the session when the agent reports an execution error', async () => {
    const chatService = createChatService({
      finalizeAssistantReply: jest.fn().mockResolvedValue({
        session,
        message: finalizedMessage
      })
    });
    const agentService = {
      streamChatReply: jest.fn().mockImplementation(async function* () {
        yield {
          type: 'agent-error',
          error: {
            stage: 'LLM',
            errorCategory: 'INTERNAL_ERROR',
            errorMessage: 'Agent response was empty'
          }
        };
        yield { type: 'finish' };
      })
    };
    const controller = new ChatController(chatService as never, agentService as never);
    const { res, writes, waitForEnd } = createResponseRecorder();

    await controller.streamChat(
      { userId: 'user-1', email: 'user@example.com', role: 'USER' },
      { content: ' Ping ' },
      res
    );
    await waitForEnd();

    expect(agentService.streamChatReply).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'session-1',
      history: [],
      prompt: 'Ping'
    });
    expect(chatService.finalizeAssistantReply).toHaveBeenCalledWith('session-1', '');
    expect(writes.some((chunk) => chunk.includes('"type":"session-start"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"agent-error"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('Agent response was empty'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"session-finish"'))).toBe(true);
    expect(res.end).toHaveBeenCalled();
  });

  it('emits tool input and output error events and still finalizes the response', async () => {
    const chatService = createChatService({
      finalizeAssistantReply: jest.fn().mockResolvedValue({
        session,
        message: {
          ...finalizedMessage,
          content: 'Recovered after tool failure'
        }
      })
    });
    const agentService = {
      streamChatReply: jest.fn().mockImplementation(async function* () {
        yield {
          type: 'tool-input-start',
          toolExecution: {
            id: 'tool-execution-1',
            sessionId: 'other-session',
            toolName: 'get_current_time',
            status: 'RUNNING',
            input: '{"timezone":"UTC"}',
            output: null,
            errorCategory: null,
            errorMessage: null,
            startedAt: '2026-03-26T12:00:00.000Z',
            finishedAt: null
          }
        };
        yield {
          type: 'tool-input-available',
          toolExecution: {
            id: 'tool-execution-1',
            sessionId: 'other-session',
            toolName: 'get_current_time',
            status: 'RUNNING',
            input: '{"timezone":"UTC"}',
            output: null,
            errorCategory: null,
            errorMessage: null,
            startedAt: '2026-03-26T12:00:00.000Z',
            finishedAt: null
          }
        };
        yield {
          type: 'tool-output-error',
          toolExecution: {
            id: 'tool-execution-1',
            sessionId: 'other-session',
            toolName: 'get_current_time',
            status: 'FAILED',
            input: '{"timezone":"UTC"}',
            output: null,
            errorCategory: 'INTERNAL_ERROR',
            errorMessage: 'Tool execution failed',
            startedAt: '2026-03-26T12:00:00.000Z',
            finishedAt: '2026-03-26T12:00:01.000Z'
          }
        };
        yield { type: 'text-delta', textDelta: 'Recovered after tool failure' };
        yield { type: 'finish' };
      })
    };
    const controller = new ChatController(chatService as never, agentService as never);
    const { res, writes, waitForEnd } = createResponseRecorder();

    await controller.streamChat(
      { userId: 'user-1', email: 'user@example.com', role: 'USER' },
      { content: ' What time is it? ' },
      res
    );
    await waitForEnd();

    expect(agentService.streamChatReply).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'session-1',
      history: [],
      prompt: 'What time is it?'
    });
    expect(chatService.finalizeAssistantReply).toHaveBeenCalledWith('session-1', 'Recovered after tool failure');
    expect(writes.some((chunk) => chunk.includes('"type":"tool-input-start"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"tool-input-available"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"tool-output-error"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('Tool execution failed'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"sessionId":"session-1"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('Recovered after tool failure'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"session-finish"'))).toBe(true);
    expect(res.end).toHaveBeenCalled();
  });

  it('finalizes the assistant reply after a normal text stream', async () => {
    const chatService = createChatService({
      finalizeAssistantReply: jest.fn().mockResolvedValue({
        session,
        message: {
          ...finalizedMessage,
          content: 'Hello world'
        }
      })
    });
    const agentService = {
      streamChatReply: jest.fn().mockImplementation(async function* () {
        yield { type: 'text-delta', textDelta: 'Hello ' };
        yield { type: 'text-delta', textDelta: 'world' };
        yield { type: 'finish' };
      })
    };
    const controller = new ChatController(chatService as never, agentService as never);
    const { res, writes, waitForEnd } = createResponseRecorder();

    await controller.streamChat(
      { userId: 'user-1', email: 'user@example.com', role: 'USER' },
      { content: ' Ping ' },
      res
    );
    await waitForEnd();

    expect(chatService.finalizeAssistantReply).toHaveBeenCalledWith('session-1', 'Hello world');
    expect(writes.some((chunk) => chunk.includes('"type":"session-start"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('Hello world'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"session-finish"'))).toBe(true);
    expect(res.end).toHaveBeenCalled();
  });
});
