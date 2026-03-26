process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_chat';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'change-me';
process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-key';
process.env.DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
process.env.DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

import type { Response } from 'express';
import { ChatController } from './chat.controller';

describe('ChatController', () => {
  it('emits run_failed and does not save an assistant message when agent output is empty', async () => {
    const session = {
      id: 'session-1',
      userId: 'user-1',
      title: 'Ping',
      createdAt: '2026-03-26T12:00:00.000Z',
      updatedAt: '2026-03-26T12:00:00.000Z'
    };
    const userMessage = {
      id: 'message-1',
      sessionId: 'session-1',
      role: 'USER',
      content: 'Ping',
      createdAt: '2026-03-26T12:00:00.000Z'
    };
    const chatService = {
      createSessionWithFirstMessage: jest.fn().mockResolvedValue({ session, userMessage }),
      getSessionOrThrow: jest.fn().mockResolvedValue(session),
      addUserMessage: jest.fn(),
      formatSessionSummary: jest.fn().mockImplementation((value) => value),
      formatMessage: jest.fn().mockImplementation((value) => value),
      listMessages: jest.fn().mockResolvedValue({ messages: [userMessage] }),
      saveAssistantMessage: jest.fn()
    };
    const agentService = {
      streamChatReply: jest.fn().mockImplementation(() => ({
        [Symbol.asyncIterator]() {
          throw new Error('Agent response was empty');
        }
      }))
    };
    const controller = new ChatController(chatService as never, agentService as never);
    const writes: string[] = [];
    const res = {
      setHeader: jest.fn(),
      write: jest.fn((chunk: string) => {
        writes.push(chunk);
        return true;
      }),
      end: jest.fn()
    } as unknown as Response;

    await controller.streamChat(
      { userId: 'user-1', email: 'user@example.com', role: 'USER' },
      { content: ' Ping ' },
      res
    );

    expect(chatService.saveAssistantMessage).not.toHaveBeenCalled();
    expect(writes.some((chunk) => chunk.includes('"type":"run_failed"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('Agent response was empty'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"run_completed"'))).toBe(false);
  });

  it('emits run_failed instead of run_completed when agent stream fails after tool failure', async () => {
    const session = {
      id: 'session-1',
      userId: 'user-1',
      title: 'What time is it?',
      createdAt: '2026-03-26T12:00:00.000Z',
      updatedAt: '2026-03-26T12:00:00.000Z'
    };
    const userMessage = {
      id: 'message-1',
      sessionId: 'session-1',
      role: 'USER',
      content: 'What time is it?',
      createdAt: '2026-03-26T12:00:00.000Z'
    };
    const chatService = {
      createSessionWithFirstMessage: jest.fn().mockResolvedValue({ session, userMessage }),
      getSessionOrThrow: jest.fn().mockResolvedValue(session),
      addUserMessage: jest.fn(),
      formatSessionSummary: jest.fn().mockImplementation((value) => value),
      formatMessage: jest.fn().mockImplementation((value) => value),
      listMessages: jest.fn().mockResolvedValue({ messages: [userMessage] }),
      saveAssistantMessage: jest.fn()
    };
    const agentService = {
      streamChatReply: jest.fn().mockImplementation(async function* () {
        yield {
          type: 'tool_started',
          toolExecution: {
            id: 'tool-execution-1',
            sessionId: 'session-1',
            toolName: 'get_current_time',
            status: 'RUNNING',
            input: '{"timezone":"UTC"}',
            output: null,
            errorMessage: null,
            startedAt: '2026-03-26T12:00:00.000Z',
            finishedAt: null
          }
        };
        yield {
          type: 'tool_failed',
          toolExecution: {
            id: 'tool-execution-1',
            sessionId: 'session-1',
            toolName: 'get_current_time',
            status: 'FAILED',
            input: '{"timezone":"UTC"}',
            output: null,
            errorMessage: 'Tool execution failed',
            startedAt: '2026-03-26T12:00:00.000Z',
            finishedAt: '2026-03-26T12:00:01.000Z'
          }
        };
        throw new Error('Tool execution failed');
      })
    };
    const controller = new ChatController(chatService as never, agentService as never);
    const writes: string[] = [];
    const res = {
      setHeader: jest.fn(),
      write: jest.fn((chunk: string) => {
        writes.push(chunk);
        return true;
      }),
      end: jest.fn()
    } as unknown as Response;

    await controller.streamChat(
      { userId: 'user-1', email: 'user@example.com', role: 'USER' },
      { content: ' What time is it? ' },
      res
    );

    expect(agentService.streamChatReply).toHaveBeenCalledWith({
      userId: 'user-1',
      sessionId: 'session-1',
      history: [],
      prompt: 'What time is it?'
    });
    expect(chatService.saveAssistantMessage).not.toHaveBeenCalled();
    expect(writes.some((chunk) => chunk.includes('"type":"tool_started"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"tool_failed"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"run_failed"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"run_completed"'))).toBe(false);
    expect(res.end).toHaveBeenCalled();
  });
});
