process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_chat';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'change-me';
process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-key';
process.env.DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
process.env.DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

describe('ToolService', () => {
  it('creates a running execution and updates it to succeeded with JSON input', async () => {
    const createdExecution = {
      id: 'tool-execution-1',
      sessionId: 'session-1',
      toolName: 'get_current_time',
      status: 'RUNNING',
      input: { timezone: 'UTC' },
      output: null,
      errorMessage: null,
      startedAt: new Date('2026-03-26T12:00:00.000Z'),
      finishedAt: null
    };
    const updatedExecution = {
      ...createdExecution,
      status: 'SUCCEEDED',
      output: '{"now":"2026-03-26T12:00:00.000Z"}',
      finishedAt: new Date('2026-03-26T12:00:01.000Z')
    };
    const create = jest.fn().mockResolvedValue(createdExecution);
    const update = jest.fn().mockResolvedValue(updatedExecution);
    const prisma = {
      toolExecution: {
        create,
        update
      }
    };

    const { ToolService } = await import('./tool.service');
    const manageScheduleToolFactory = {
      create: jest.fn().mockReturnValue({
        name: 'manage_schedule',
        description: 'manage schedules',
        schema: { parse: jest.fn() },
        execute: jest.fn()
      })
    };
    const service = new ToolService(prisma as never, manageScheduleToolFactory as never);
    const started = await service.startToolExecution('get_current_time', { timezone: 'UTC' }, {
      sessionId: 'session-1',
      userId: 'user-1'
    });
    const result = await started.run();

    expect(create).toHaveBeenCalledWith({
      data: {
        sessionId: 'session-1',
        toolName: 'get_current_time',
        status: 'RUNNING',
        input: { timezone: 'UTC' }
      }
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'tool-execution-1' },
      data: {
        status: 'SUCCEEDED',
        output: expect.stringMatching(/^\{"now":".+"\}$/),
        finishedAt: expect.any(Date)
      }
    });
    expect(result.execution).toBe(updatedExecution);
    expect(result.outputText).toMatch(/^\{"now":".+"\}$/);
  });

  it('updates execution to failed and rethrows a ToolExecutionError when tool execution fails', async () => {
    const createdExecution = {
      id: 'tool-execution-2',
      sessionId: 'session-1',
      toolName: 'get_current_time',
      status: 'RUNNING',
      input: {},
      output: null,
      errorMessage: null,
      startedAt: new Date('2026-03-26T12:05:00.000Z'),
      finishedAt: null
    };
    const failedExecution = {
      ...createdExecution,
      status: 'FAILED',
      errorMessage: 'boom',
      finishedAt: new Date('2026-03-26T12:05:01.000Z')
    };
    const create = jest.fn().mockResolvedValue(createdExecution);
    const update = jest.fn().mockResolvedValue(failedExecution);
    const prisma = {
      toolExecution: {
        create,
        update
      }
    };

    const { ToolService } = await import('./tool.service');
    const manageScheduleToolFactory = {
      create: jest.fn().mockReturnValue({
        name: 'manage_schedule',
        description: 'manage schedules',
        schema: { parse: jest.fn() },
        execute: jest.fn()
      })
    };
    const service = new ToolService(prisma as never, manageScheduleToolFactory as never);

    const originalNow = Date.now;
    Date.now = jest.fn().mockReturnValue(new Date('2026-03-26T12:05:00.000Z').valueOf());
    const originalExecute = service.getDefinition('get_current_time')?.execute;
    service.getDefinition('get_current_time')!.execute = jest.fn().mockRejectedValue(new Error('boom'));

    const started = await service.startToolExecution('get_current_time', {}, {
      sessionId: 'session-1',
      userId: 'user-1'
    });

    await expect(started.run()).rejects.toMatchObject({
      message: 'boom',
      execution: failedExecution
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        sessionId: 'session-1',
        toolName: 'get_current_time',
        status: 'RUNNING',
        input: {}
      }
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'tool-execution-2' },
      data: {
        status: 'FAILED',
        errorMessage: 'boom',
        finishedAt: expect.any(Date)
      }
    });

    service.getDefinition('get_current_time')!.execute = originalExecute!;
    Date.now = originalNow;
  });
});
