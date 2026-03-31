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
    const scheduleService = {
      createSchedule: jest.fn(),
      listSchedules: jest.fn(),
      updateSchedule: jest.fn(),
      deleteSchedule: jest.fn(),
      enableSchedule: jest.fn(),
      disableSchedule: jest.fn()
    };

    const { ToolService } = await import('./tool.service');
    const service = new ToolService(prisma as never, scheduleService as never);
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
    const scheduleService = {
      createSchedule: jest.fn(),
      listSchedules: jest.fn(),
      updateSchedule: jest.fn(),
      deleteSchedule: jest.fn(),
      enableSchedule: jest.fn(),
      disableSchedule: jest.fn()
    };

    const { ToolService } = await import('./tool.service');
    const service = new ToolService(prisma as never, scheduleService as never);

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
      category: 'INTERNAL_ERROR',
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

  it('updates execution to failed when tool execution times out', async () => {
    const createdExecution = {
      id: 'tool-execution-timeout',
      sessionId: 'session-1',
      toolName: 'get_current_time',
      status: 'RUNNING',
      input: {},
      output: null,
      errorMessage: null,
      startedAt: new Date('2026-03-26T12:10:00.000Z'),
      finishedAt: null
    };
    const failedExecution = {
      ...createdExecution,
      status: 'FAILED',
      errorMessage: 'Tool execution (get_current_time) timeout',
      finishedAt: new Date('2026-03-26T12:11:00.000Z')
    };
    const create = jest.fn().mockResolvedValue(createdExecution);
    const update = jest.fn().mockResolvedValue(failedExecution);
    const prisma = {
      toolExecution: {
        create,
        update
      }
    };
    const scheduleService = {
      createSchedule: jest.fn(),
      listSchedules: jest.fn(),
      updateSchedule: jest.fn(),
      deleteSchedule: jest.fn(),
      enableSchedule: jest.fn(),
      disableSchedule: jest.fn()
    };

    jest.useFakeTimers();
    const { ToolService } = await import('./tool.service');
    const service = new ToolService(prisma as never, scheduleService as never);
    const originalExecute = service.getDefinition('get_current_time')?.execute;
    service.getDefinition('get_current_time')!.execute = jest.fn(
      () => new Promise(() => undefined)
    );

    const started = await service.startToolExecution('get_current_time', {}, {
      sessionId: 'session-1',
      userId: 'user-1'
    });
    const runPromise = started.run();
    const rejection = expect(runPromise).rejects.toMatchObject({
      message: 'Tool execution (get_current_time) timeout',
      category: 'INTERNAL_ERROR',
      execution: failedExecution
    });
    await jest.advanceTimersByTimeAsync(60000);
    await rejection;
    expect(update).toHaveBeenCalledWith({
      where: { id: 'tool-execution-timeout' },
      data: {
        status: 'FAILED',
        errorMessage: 'Tool execution (get_current_time) timeout',
        finishedAt: expect.any(Date)
      }
    });

    service.getDefinition('get_current_time')!.execute = originalExecute!;
    jest.useRealTimers();
  });

  it('registers manage_schedule tool and can list it', async () => {
    const prisma = {
      toolExecution: {
        create: jest.fn(),
        update: jest.fn()
      }
    };
    const scheduleService = {
      createSchedule: jest.fn(),
      listSchedules: jest.fn(),
      updateSchedule: jest.fn(),
      deleteSchedule: jest.fn(),
      enableSchedule: jest.fn(),
      disableSchedule: jest.fn()
    };

    const { ToolService } = await import('./tool.service');
    const service = new ToolService(prisma as never, scheduleService as never);

    const definitions = service.listDefinitions();
    expect(definitions.map((d) => d.name)).toContain('manage_schedule');
    expect(service.getDefinition('manage_schedule')).not.toBeNull();
  });
});
