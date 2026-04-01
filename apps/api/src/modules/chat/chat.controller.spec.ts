process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_chat';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'change-me';
process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-key';
process.env.DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
process.env.DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

import type { Response } from 'express';
import type { ChatRunEvent, RunSummary, ToolExecutionSummary } from '@ai-chat/shared';
import { ChatController } from './chat.controller';

const formatDataStreamPartMock = jest.fn((type: string, value: unknown) => JSON.stringify({ type, value }));
const pipeDataStreamToResponseMock = jest.fn(
  async (
    res: Response,
    options: {
      status: number;
      execute: (writer: { write: (chunk: string) => void; writeData: (value: unknown) => void }) => Promise<void>;
      onError: (error: unknown) => string;
    }
  ) => {
    const writer = {
      write: (chunk: string) => {
        res.write(chunk);
      },
      writeData: (value: unknown) => {
        res.write(JSON.stringify(value));
      }
    };

    res.statusCode = options.status;

    try {
      await options.execute(writer);
    } catch (error) {
      res.write(options.onError(error));
    } finally {
      res.end();
    }
  }
);

jest.mock('ai', () => ({
  formatDataStreamPart: (type: string, value: unknown) => formatDataStreamPartMock(type, value),
  pipeDataStreamToResponse: (res: Response, options: Parameters<typeof pipeDataStreamToResponseMock>[1]) =>
    pipeDataStreamToResponseMock(res, options)
}));

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
    runId: null,
    role: 'USER' as const,
    content: 'Ping',
    createdAt: '2026-03-26T12:00:00.000Z'
  };

  const finalizedMessage = {
    id: 'message-2',
    sessionId: 'session-1',
    runId: 'run-1',
    role: 'ASSISTANT' as const,
    content: '',
    createdAt: '2026-03-26T12:00:01.000Z'
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

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

  function createCompletedRun(overrides: Partial<RunSummary> = {}): RunSummary {
    return {
      id: 'run-1',
      sessionId: 'session-1',
      messageId: 'message-1',
      scheduleId: null,
      status: 'COMPLETED',
      stage: 'FINALIZING',
      triggerSource: 'USER',
      failureCategory: null,
      failureCode: null,
      failureMessage: null,
      startedAt: null,
      finishedAt: null,
      ...overrides
    };
  }

  function createToolExecution(overrides: Partial<ToolExecutionSummary> = {}): ToolExecutionSummary {
    return {
      id: 'tool-execution-1',
      sessionId: 'other-session',
      runId: 'run-1',
      messageId: 'message-1',
      toolName: 'get_current_time',
      status: 'RUNNING',
      progressMessage: 'Tool running',
      input: '{"timezone":"UTC"}',
      output: null,
      partialOutput: null,
      errorCategory: null,
      errorMessage: null,
      canRetry: false,
      canCancel: true,
      startedAt: '2026-03-26T12:00:00.000Z',
      finishedAt: null,
      ...overrides
    };
  }

  it('emits run_failed when agent execution throws', async () => {
    const chatService = createChatService();
    const agentService = {
      execute: jest.fn().mockRejectedValue(new Error('Agent response was empty'))
    };
    const controller = new ChatController(chatService as never, agentService as never);
    const { res, writes, waitForEnd } = createResponseRecorder();

    await controller.streamChat(
      { userId: 'user-1', email: 'user@example.com', role: 'USER' },
      { content: ' Ping ' },
      res
    );
    await waitForEnd();

    expect(agentService.execute).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        sessionId: 'session-1',
        messageId: expect.stringMatching(/^assistant-/),
        runId: expect.any(String),
        triggerSource: 'USER',
        history: [],
        prompt: 'Ping'
      },
      expect.any(Function)
    );
    expect(chatService.finalizeAssistantReply).not.toHaveBeenCalled();
    expect(writes.some((chunk) => chunk.includes('"type":"start_step"') && chunk.includes('assistant-'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"run_started"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"run_failed"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('Agent response was empty'))).toBe(true);
    expect(res.end).toHaveBeenCalled();
  });

  it('emits tool and text events and finalizes the response', async () => {
    const toolStarted = createToolExecution();
    const toolFailed = createToolExecution({
      status: 'FAILED',
      progressMessage: 'Tool failed',
      errorCategory: 'TOOL_ERROR',
      errorMessage: 'Tool execution failed',
      canRetry: true,
      canCancel: false,
      finishedAt: '2026-03-26T12:00:01.000Z'
    });
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
      execute: jest.fn().mockImplementation(async (_request, onEvent?: (event: ChatRunEvent) => void) => {
        onEvent?.({ type: 'tool_started', toolExecution: toolStarted });
        onEvent?.({ type: 'tool_progressed', toolExecution: toolStarted });
        onEvent?.({ type: 'tool_failed', toolExecution: toolFailed });
        onEvent?.({ type: 'text_delta', runId: 'run-1', messageId: 'assistant-run-1', textDelta: 'Recovered after tool failure' });
        return {
          text: 'Recovered after tool failure',
          run: createCompletedRun(),
          events: []
        };
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

    expect(chatService.finalizeAssistantReply).toHaveBeenCalledWith('session-1', 'Recovered after tool failure', expect.any(String));
    expect(writes.some((chunk) => chunk.includes('"type":"run_started"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"tool_started"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"tool_progressed"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"tool_failed"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('Tool execution failed'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"text_delta"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('Recovered after tool failure'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"run_completed"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"tool_call"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"sessionId":"session-1"'))).toBe(true);
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
      execute: jest.fn().mockImplementation(async (_request, onEvent?: (event: ChatRunEvent) => void) => {
        onEvent?.({ type: 'text_delta', runId: 'run-1', messageId: 'assistant-run-1', textDelta: 'Hello ' });
        onEvent?.({ type: 'text_delta', runId: 'run-1', messageId: 'assistant-run-1', textDelta: 'world' });
        return {
          text: 'Hello world',
          run: createCompletedRun(),
          events: []
        };
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

    expect(chatService.finalizeAssistantReply).toHaveBeenCalledWith('session-1', 'Hello world', expect.any(String));
    expect(writes.some((chunk) => chunk.includes('"type":"start_step"') && chunk.includes('assistant-'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"run_started"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('Hello world'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"run_completed"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"finish_step"'))).toBe(true);
    expect(writes.some((chunk) => chunk.includes('"type":"finish_message"'))).toBe(true);
    expect(res.end).toHaveBeenCalled();
  });
});
