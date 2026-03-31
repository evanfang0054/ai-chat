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
    expect(events).toEqual([
      { type: 'text-delta', textDelta: 'Hello world' },
      { type: 'finish' }
    ]);
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

  it('requires explicit confirmation before deleting a schedule', async () => {
    const invoke = jest.fn().mockResolvedValue({ content: 'Please confirm which schedule to delete.', tool_calls: [] });
    const bindTools = jest.fn().mockReturnValue({ invoke });
    const llmService = {
      createChatModel: jest.fn().mockReturnValue({ bindTools })
    };
    const toolService = {
      listDefinitions: jest.fn().mockReturnValue([
        { name: 'manage_schedule', description: 'Manage the current user\'s schedules.' }
      ]),
      getDefinition: jest.fn().mockReturnValue({ schema: { parse: jest.fn() } }),
      startToolExecution: jest.fn()
    };

    const { AgentService } = await import('./agent.service');
    const service = new AgentService(llmService as never, toolService as never);

    for await (const _event of service.streamChatReply({
      userId: 'user-1',
      sessionId: 'session-1',
      history: [{ role: 'USER', content: 'Delete my daily summary schedule.' }],
      prompt: 'Delete my daily summary schedule.'
    })) {
      // drain
    }

    expect(invoke).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('require an explicit user confirmation in natural language')
        })
      ])
    );
    expect(toolService.startToolExecution).not.toHaveBeenCalled();
  });

  it('guides the model to list or disambiguate ambiguous schedule targets before mutation', async () => {
    const invoke = jest.fn().mockResolvedValue({ content: 'I found multiple matching schedules.', tool_calls: [] });
    const bindTools = jest.fn().mockReturnValue({ invoke });
    const llmService = {
      createChatModel: jest.fn().mockReturnValue({ bindTools })
    };
    const toolService = {
      listDefinitions: jest.fn().mockReturnValue([
        { name: 'manage_schedule', description: 'Manage the current user\'s schedules.' }
      ]),
      getDefinition: jest.fn().mockReturnValue({ schema: { parse: jest.fn() } }),
      startToolExecution: jest.fn()
    };

    const { AgentService } = await import('./agent.service');
    const service = new AgentService(llmService as never, toolService as never);

    for await (const _event of service.streamChatReply({
      userId: 'user-1',
      sessionId: 'session-1',
      history: [{ role: 'USER', content: 'Disable my report schedule.' }],
      prompt: 'Disable my report schedule.'
    })) {
      // drain
    }

    expect(invoke).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          content: expect.stringContaining('prefer calling manage_schedule with action="list" first or ask a disambiguation question instead of guessing')
        })
      ])
    );
    expect(toolService.startToolExecution).not.toHaveBeenCalled();
  });

  it('emits agent-error when LLM invocation times out', async () => {
    jest.useFakeTimers();
    const invoke = jest.fn().mockImplementation(() => new Promise(() => undefined));
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
    const runPromise = (async () => {
      for await (const event of service.streamChatReply({
        userId: 'user-1',
        sessionId: 'session-1',
        history: [],
        prompt: 'Hello'
      })) {
        events.push(event);
      }
    })();

    const rejection = expect(runPromise).rejects.toThrow('Agent LLM response timeout');
    await jest.advanceTimersByTimeAsync(120000);
    await rejection;
    expect(events).toEqual([
      {
        type: 'agent-error',
        error: {
          stage: 'LLM',
          errorCategory: 'INTERNAL_ERROR',
          errorMessage: 'Agent LLM response timeout'
        }
      }
    ]);
    jest.useRealTimers();
  });

  it('emits agent-error when tool execution times out before a failed execution summary exists', async () => {
    jest.useFakeTimers();
    const toolStartedExecution = {
      id: 'tool-execution-timeout',
      sessionId: 'session-1',
      toolName: 'get_current_time',
      status: 'RUNNING' as const,
      input: '{"timezone":"UTC"}',
      output: null,
      errorCategory: null,
      errorMessage: null,
      startedAt: '2026-03-26T12:00:00.000Z',
      finishedAt: null
    };
    const invoke = jest.fn().mockResolvedValue({
      content: '',
      tool_calls: [{ name: 'get_current_time', args: { timezone: 'UTC' } }]
    });
    const bindTools = jest.fn().mockReturnValue({ invoke });
    const run = jest.fn().mockImplementation(() => new Promise(() => undefined));
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
    const runPromise = (async () => {
      for await (const event of service.streamChatReply({
        userId: 'user-1',
        sessionId: 'session-1',
        history: [{ role: 'USER', content: 'Hi' }],
        prompt: 'What time is it now in UTC?'
      })) {
        events.push(event);
      }
    })();

    const rejection = expect(runPromise).rejects.toThrow('Agent tool call (get_current_time) timeout');
    await jest.advanceTimersByTimeAsync(60000);
    await rejection;
    expect(toolService.startToolExecution).toHaveBeenCalledWith('get_current_time', { timezone: 'UTC' }, {
      sessionId: 'session-1',
      userId: 'user-1',
      scheduleId: undefined,
      runId: undefined
    });
    expect(events).toEqual([
      { type: 'tool-input-start', toolExecution: toolStartedExecution },
      { type: 'tool-input-available', toolExecution: toolStartedExecution },
      {
        type: 'agent-error',
        error: {
          stage: 'LLM',
          errorCategory: 'INTERNAL_ERROR',
          errorMessage: 'Agent tool call (get_current_time) timeout'
        }
      }
    ]);
    jest.useRealTimers();
  });

  it('emits the tool-success event sequence for a LangChain tool call', async () => {
    const toolStartedExecution = {
      id: 'tool-execution-1',
      sessionId: 'session-1',
      toolName: 'get_current_time',
      status: 'RUNNING' as const,
      input: '{"timezone":"UTC"}',
      output: null,
      errorCategory: null,
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
      userId: 'user-1',
      scheduleId: undefined,
      runId: undefined
    });
    expect(run).toHaveBeenCalled();
    expect(events).toEqual([
      { type: 'tool-input-start', toolExecution: toolStartedExecution },
      { type: 'tool-input-available', toolExecution: toolStartedExecution },
      { type: 'tool-output-available', toolExecution: toolCompletedExecution },
      { type: 'text-delta', textDelta: 'The current UTC time is 2026-03-26T12:00:00.000Z.' },
      { type: 'finish' }
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
      errorCategory: null,
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
      { type: 'tool-input-start', toolExecution: toolStartedExecution },
      { type: 'tool-input-available', toolExecution: toolStartedExecution },
      { type: 'tool-output-available', toolExecution: toolCompletedExecution },
      { type: 'text-delta', textDelta: toolCompletedExecution.output },
      { type: 'finish' }
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
      errorCategory: null,
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
      userId: 'user-1',
      scheduleId: undefined,
      runId: undefined
    });
    expect(events).toEqual([
      { type: 'tool-input-start', toolExecution: toolStartedExecution },
      { type: 'tool-input-available', toolExecution: toolStartedExecution },
      { type: 'tool-output-available', toolExecution: toolCompletedExecution },
      { type: 'text-delta', textDelta: 'Found 1 schedules.' },
      { type: 'finish' }
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
      errorCategory: null,
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
      execution: toolFailedExecution,
      category: 'INTERNAL_ERROR'
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
      userId: 'user-1',
      scheduleId: undefined,
      runId: undefined
    });
    expect(run).toHaveBeenCalled();
    expect(events).toEqual([
      { type: 'tool-input-start', toolExecution: toolStartedExecution },
      { type: 'tool-input-available', toolExecution: toolStartedExecution },
      {
        type: 'tool-output-error',
        toolExecution: {
          ...toolFailedExecution,
          errorCategory: 'INTERNAL_ERROR'
        }
      },
      {
        type: 'agent-error',
        error: {
          stage: 'TOOL',
          errorCategory: 'INTERNAL_ERROR',
          errorMessage: 'Tool execution failed'
        }
      }
    ]);
  });
});
