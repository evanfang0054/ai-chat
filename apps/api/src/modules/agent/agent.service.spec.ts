process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_chat';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'change-me';
process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-key';
process.env.DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
process.env.DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

import type { AgentStreamEvent } from './agent.types';

describe('AgentService', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_chat';
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'change-me';
    process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-key';
    process.env.DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    process.env.DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
  });

  it('converts chat history into LangChain messages and emits text deltas', async () => {
    const invoke = jest.fn().mockResolvedValue({ content: 'Hello world', tool_calls: [] });
    const bindTools = jest.fn().mockReturnValue({ invoke });
    const llmService = {
      createChatModel: jest.fn().mockReturnValue({ bindTools })
    };
    const toolService = {
      listDefinitions: jest.fn().mockReturnValue([]),
      getDefinition: jest.fn(),
      startToolExecution: jest.fn()
    };

    const { AgentService } = await import('./agent.service');
    const service = new AgentService(llmService as never, toolService as never);
    const events: AgentStreamEvent[] = [];

    for await (const event of service.streamChatReply({
      userId: 'user-1',
      sessionId: 'session-1',
      history: [
        { role: 'SYSTEM', content: 'You are helpful.' },
        { role: 'USER', content: 'Hi' },
        { role: 'ASSISTANT', content: 'Hello!' }
      ],
      prompt: 'Tell me something nice'
    })) {
      events.push(event);
    }

    expect(llmService.createChatModel).toHaveBeenCalled();
    expect(bindTools).toHaveBeenCalled();
    expect(toolService.startToolExecution).not.toHaveBeenCalled();
    expect(events).toEqual([{ type: 'text_delta', delta: 'Hello world' }, { type: 'run_completed' }]);
  });

  it('throws when the model returns no text and no tool output', async () => {
    const invoke = jest.fn().mockResolvedValue({ content: '', tool_calls: [] });
    const bindTools = jest.fn().mockReturnValue({ invoke });
    const llmService = {
      createChatModel: jest.fn().mockReturnValue({ bindTools })
    };
    const toolService = {
      listDefinitions: jest.fn().mockReturnValue([]),
      getDefinition: jest.fn(),
      startToolExecution: jest.fn()
    };

    const { AgentService } = await import('./agent.service');
    const service = new AgentService(llmService as never, toolService as never);

    await expect(
      (async () => {
        for await (const _event of service.streamChatReply({
          userId: 'user-1',
          sessionId: 'session-1',
          history: [],
          prompt: 'Ping'
        })) {
          // drain
        }
      })()
    ).rejects.toThrow('Agent response was empty');
  });

  it('emits the tool-success event sequence for a LangChain tool call', async () => {
    const toolStartedExecution = {
      id: 'tool-execution-1',
      sessionId: 'session-1',
      toolName: 'get_current_time',
      status: 'RUNNING' as const,
      input: '{"timezone":"UTC"}',
      output: null,
      errorMessage: null,
      startedAt: '2026-03-26T12:00:00.000Z',
      finishedAt: null
    };
    const toolCompletedExecution = {
      ...toolStartedExecution,
      status: 'SUCCEEDED' as const,
      output: '{"now":"2026-03-26T12:00:00.000Z"}',
      finishedAt: '2026-03-26T12:00:01.000Z'
    };
    const invoke = jest.fn().mockResolvedValue({
      content: '',
      tool_calls: [{ name: 'get_current_time', args: { timezone: 'UTC' } }]
    });
    const bindTools = jest.fn().mockReturnValue({ invoke });
    const run = jest.fn().mockResolvedValue({
      execution: toolCompletedExecution,
      outputText: toolCompletedExecution.output
    });
    const llmService = {
      createChatModel: jest.fn().mockReturnValue({ bindTools })
    };
    const toolService = {
      listDefinitions: jest.fn().mockReturnValue([
        { name: 'get_current_time', description: 'Get the current server time in ISO format.' }
      ]),
      getDefinition: jest.fn().mockReturnValue({ schema: { parse: jest.fn() } }),
      startToolExecution: jest.fn().mockResolvedValue({
        execution: toolStartedExecution,
        run
      })
    };

    const { AgentService } = await import('./agent.service');
    const service = new AgentService(llmService as never, toolService as never);
    const events: AgentStreamEvent[] = [];

    for await (const event of service.streamChatReply({
      userId: 'user-1',
      sessionId: 'session-1',
      history: [{ role: 'USER', content: 'Hi' }],
      prompt: 'What is the current time in UTC?'
    })) {
      events.push(event);
    }

    expect(toolService.startToolExecution).toHaveBeenCalledWith('get_current_time', { timezone: 'UTC' }, {
      sessionId: 'session-1',
      userId: 'user-1'
    });
    expect(run).toHaveBeenCalled();
    expect(events).toEqual([
      { type: 'tool_started', toolExecution: toolStartedExecution },
      { type: 'tool_completed', toolExecution: toolCompletedExecution },
      { type: 'text_delta', delta: 'The current UTC time is 2026-03-26T12:00:00.000Z.' },
      { type: 'run_completed' }
    ]);
  });

  it('emits the tool-failure event sequence for a LangChain tool call', async () => {
    const toolStartedExecution = {
      id: 'tool-execution-1',
      sessionId: 'session-1',
      toolName: 'get_current_time',
      status: 'RUNNING' as const,
      input: '{"timezone":"UTC"}',
      output: null,
      errorMessage: null,
      startedAt: '2026-03-26T12:00:00.000Z',
      finishedAt: null
    };
    const toolFailedExecution = {
      ...toolStartedExecution,
      status: 'FAILED' as const,
      output: null,
      errorMessage: 'Tool execution failed',
      finishedAt: '2026-03-26T12:05:01.000Z'
    };
    const toolError = Object.assign(new Error('Tool execution failed'), {
      execution: toolFailedExecution
    });
    const invoke = jest.fn().mockResolvedValue({
      content: '',
      tool_calls: [{ name: 'get_current_time', args: { timezone: 'UTC' } }]
    });
    const bindTools = jest.fn().mockReturnValue({ invoke });
    const run = jest.fn().mockRejectedValue(toolError);
    const llmService = {
      createChatModel: jest.fn().mockReturnValue({ bindTools })
    };
    const toolService = {
      listDefinitions: jest.fn().mockReturnValue([
        { name: 'get_current_time', description: 'Get the current server time in ISO format.' }
      ]),
      getDefinition: jest.fn().mockReturnValue({ schema: { parse: jest.fn() } }),
      startToolExecution: jest.fn().mockResolvedValue({
        execution: toolStartedExecution,
        run
      })
    };

    const { AgentService } = await import('./agent.service');
    const service = new AgentService(llmService as never, toolService as never);
    const events: AgentStreamEvent[] = [];

    await expect(
      (async () => {
        for await (const event of service.streamChatReply({
          userId: 'user-1',
          sessionId: 'session-1',
          history: [{ role: 'USER', content: 'Hi' }],
          prompt: 'What time is it now in UTC?'
        })) {
          events.push(event);
        }
      })()
    ).rejects.toThrow('Tool execution failed');

    expect(toolService.startToolExecution).toHaveBeenCalledWith('get_current_time', { timezone: 'UTC' }, {
      sessionId: 'session-1',
      userId: 'user-1'
    });
    expect(run).toHaveBeenCalled();
    expect(events).toEqual([
      { type: 'tool_started', toolExecution: toolStartedExecution },
      { type: 'tool_failed', toolExecution: toolFailedExecution }
    ]);
  });
});
