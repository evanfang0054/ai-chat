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

  it('prepends the tool-usage system prompt before chat history', async () => {
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

    for await (const _event of service.streamChatReply({
      userId: 'user-1',
      sessionId: 'session-1',
      history: [{ role: 'USER', content: 'Hi' }],
      prompt: 'Create a schedule for me'
    })) {
      // drain
    }

    expect(invoke).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('If the user asks you to perform an action that matches an available tool')
        })
      ])
    );
  });
  it('guides the model to infer structured schedule arguments for natural-language schedule requests', async () => {
    const invoke = jest.fn().mockResolvedValue({ content: 'ok', tool_calls: [] });
    const bindTools = jest.fn().mockReturnValue({ invoke });
    const llmService = {
      createChatModel: jest.fn().mockReturnValue({ bindTools })
    };
    const toolService = {
      listDefinitions: jest.fn().mockReturnValue([
        { name: 'manage_schedule', description: 'Create, list, update, enable, or disable schedules.' }
      ]),
      getDefinition: jest.fn().mockReturnValue({ schema: { parse: jest.fn() } }),
      startToolExecution: jest.fn()
    };

    const { AgentService } = await import('./agent.service');
    const service = new AgentService(llmService as never, toolService as never);

    for await (const _event of service.streamChatReply({
      userId: 'user-1',
      sessionId: 'session-1',
      history: [{ role: 'USER', content: 'Hi' }],
      prompt: '请帮我创建一个每10秒执行一次的定时任务，任务内容是调用 get_current_time。'
    })) {
      // drain
    }

    expect(bindTools).toHaveBeenCalledWith(
      expect.any(Array),
      expect.objectContaining({ tool_choice: 'auto' })
    );
    expect(invoke).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('translate phrases like "every 10 seconds"')
        }),
        expect.objectContaining({
          content: expect.stringContaining('create a short title instead of asking for one')
        })
      ])
    );
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

  it('ignores model text content after a successful tool call', async () => {
    const toolStartedExecution = {
      id: 'tool-execution-1',
      sessionId: 'session-1',
      toolName: 'manage_schedule',
      status: 'RUNNING' as const,
      input: '{"action":"create"}',
      output: null,
      errorMessage: null,
      startedAt: '2026-03-26T12:00:00.000Z',
      finishedAt: null
    };
    const toolCompletedExecution = {
      ...toolStartedExecution,
      status: 'SUCCEEDED' as const,
      output: '{"action":"create","schedule":{"id":"schedule-1"}}',
      finishedAt: '2026-03-26T12:00:01.000Z'
    };
    const invoke = jest.fn().mockResolvedValue({
      content: '我理解您想要创建一个每10秒执行一次的定时任务,不过还需要更多说明。',
      tool_calls: [{ name: 'manage_schedule', args: { action: 'create' } }]
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
        { name: 'manage_schedule', description: 'Create, list, update, enable, or disable schedules.' }
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
      prompt: '每10秒创建一个定时任务'
    })) {
      events.push(event);
    }

    expect(events).toEqual([
      { type: 'tool_started', toolExecution: toolStartedExecution },
      { type: 'tool_completed', toolExecution: toolCompletedExecution },
      { type: 'text_delta', delta: toolCompletedExecution.output },
      { type: 'run_completed' }
    ]);
  });

  it('summarizes manage_schedule list results as text', async () => {
    const toolStartedExecution = {
      id: 'tool-execution-2',
      sessionId: 'session-1',
      toolName: 'manage_schedule',
      status: 'RUNNING' as const,
      input: '{"action":"list","enabled":true}',
      output: null,
      errorMessage: null,
      startedAt: '2026-03-27T12:00:00.000Z',
      finishedAt: null
    };
    const toolCompletedExecution = {
      ...toolStartedExecution,
      status: 'SUCCEEDED' as const,
      output:
        '{"schedules":[{"id":"schedule-1","title":"Daily summary","taskPrompt":"Summarize inbox","type":"CRON","cronExpr":"0 9 * * *","runAt":null,"timezone":"UTC","enabled":true,"lastRunAt":null,"nextRunAt":"2026-03-28T09:00:00.000Z","createdAt":"2026-03-27T11:00:00.000Z","updatedAt":"2026-03-27T11:00:00.000Z"}]}',
      finishedAt: '2026-03-27T12:00:01.000Z'
    };
    const invoke = jest.fn().mockResolvedValue({
      content: '',
      tool_calls: [{ name: 'manage_schedule', args: { action: 'list', enabled: true } }]
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
        { name: 'manage_schedule', description: 'Manage the current user\'s schedules.' }
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
      history: [{ role: 'USER', content: 'Show my schedules' }],
      prompt: 'List enabled schedules'
    })) {
      events.push(event);
    }

    expect(toolService.startToolExecution).toHaveBeenCalledWith('manage_schedule', { action: 'list', enabled: true }, {
      sessionId: 'session-1',
      userId: 'user-1'
    });
    expect(events).toEqual([
      { type: 'tool_started', toolExecution: toolStartedExecution },
      { type: 'tool_completed', toolExecution: toolCompletedExecution },
      { type: 'text_delta', delta: 'Found 1 schedules.' },
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
