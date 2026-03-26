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
    const llmService = {
      createChatModel: jest.fn().mockReturnValue({
        stream: jest.fn().mockResolvedValue(
          (async function* () {
            yield { content: 'Hello' };
            yield { content: ' world' };
          })()
        )
      })
    };

    const { AgentService } = await import('./agent.service');
    const service = new AgentService(llmService as never);
    const events = [];

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
    expect(events).toEqual([
      { type: 'text_delta', delta: 'Hello' },
      { type: 'text_delta', delta: ' world' },
      { type: 'run_completed' }
    ]);
  });

  it('ignores empty chunks and still completes', async () => {
    const llmService = {
      createChatModel: jest.fn().mockReturnValue({
        stream: jest.fn().mockResolvedValue(
          (async function* () {
            yield { content: '' };
            yield { content: [{ type: 'text', text: 'ok' }] };
          })()
        )
      })
    };

    const { AgentService } = await import('./agent.service');
    const service = new AgentService(llmService as never);
    const events = [];

    for await (const event of service.streamChatReply({
      userId: 'user-1',
      sessionId: 'session-1',
      history: [],
      prompt: 'Ping'
    })) {
      events.push(event);
    }

    expect(events).toEqual([{ type: 'text_delta', delta: 'ok' }, { type: 'run_completed' }]);
  });

  it('emits tool events before final text when a tool is called', async () => {
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
      output: '{"time":"2026-03-26T12:00:00.000Z"}',
      finishedAt: '2026-03-26T12:00:01.000Z'
    };
    const llmService = {
      createChatModel: jest.fn().mockReturnValue({
        stream: jest.fn().mockResolvedValue(
          (async function* () {
            yield { content: 'The current UTC time is 12:00.' };
          })()
        )
      })
    };
    const toolService = {
      executeTool: jest.fn().mockResolvedValue({
        execution: toolCompletedExecution,
        outputText: toolCompletedExecution.output
      })
    };

    const { AgentService } = await import('./agent.service');
    const service = new AgentService(llmService as never, toolService as never);
    const events = [];

    for await (const event of service.streamChatReply({
      userId: 'user-1',
      sessionId: 'session-1',
      history: [{ role: 'USER', content: 'What time is it in UTC?' }],
      prompt: 'Use the current time tool before answering.'
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual([
      'tool_started',
      'tool_completed',
      'text_delta',
      'run_completed'
    ]);
    expect(events).toEqual([
      { type: 'tool_started', execution: toolStartedExecution },
      { type: 'tool_completed', execution: toolCompletedExecution },
      { type: 'text_delta', delta: 'The current UTC time is 12:00.' },
      { type: 'run_completed' }
    ]);
  });

  it('emits tool_failed when tool execution throws', async () => {
    const toolStartedExecution = {
      id: 'tool-execution-2',
      sessionId: 'session-1',
      toolName: 'get_current_time',
      status: 'RUNNING' as const,
      input: '{"timezone":"UTC"}',
      output: null,
      errorMessage: null,
      startedAt: '2026-03-26T12:05:00.000Z',
      finishedAt: null
    };
    const toolFailedExecution = {
      ...toolStartedExecution,
      status: 'FAILED' as const,
      errorMessage: 'Tool execution failed',
      finishedAt: '2026-03-26T12:05:01.000Z'
    };
    const llmService = {
      createChatModel: jest.fn().mockReturnValue({
        stream: jest.fn().mockResolvedValue(
          (async function* () {
            yield { content: 'This should never be emitted.' };
          })()
        )
      })
    };
    const toolError = Object.assign(new Error('Tool execution failed'), {
      execution: toolFailedExecution
    });
    const toolService = {
      executeTool: jest.fn().mockRejectedValue(toolError)
    };

    const { AgentService } = await import('./agent.service');
    const service = new AgentService(llmService as never, toolService as never);
    const events = [];

    for await (const event of service.streamChatReply({
      userId: 'user-1',
      sessionId: 'session-1',
      history: [{ role: 'USER', content: 'What time is it in UTC?' }],
      prompt: 'Use the current time tool before answering.'
    })) {
      events.push(event);
    }

    expect(events.map((event) => event.type)).toEqual(['tool_started', 'tool_failed']);
    expect(events).toEqual([
      { type: 'tool_started', execution: toolStartedExecution },
      { type: 'tool_failed', execution: toolFailedExecution }
    ]);
  });
});
