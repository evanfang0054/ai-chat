process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_chat';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'change-me';
process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-key';
process.env.DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
process.env.DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

import { Logger } from '@nestjs/common';

describe('ScheduleRunnerService', () => {
  const userId = 'user-1';
  const now = new Date('2026-03-27T09:00:00.000Z');

  type ScheduleRecord = {
    id: string;
    userId: string;
    title: string;
    taskPrompt: string;
    type: 'CRON' | 'ONE_TIME';
    cronExpr: string | null;
    intervalMs: number | null;
    runAt: Date | null;
    timezone: string;
    enabled: boolean;
    lastRunAt: Date | null;
    nextRunAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };

  function createScheduleRecord(overrides: Partial<ScheduleRecord> = {}): ScheduleRecord {
    return {
      id: 'schedule-1',
      userId,
      title: 'Morning summary',
      taskPrompt: 'Summarize unread issues',
      type: 'ONE_TIME',
      cronExpr: null,
      intervalMs: null,
      runAt: new Date('2026-03-27T09:00:00.000Z'),
      timezone: 'UTC',
      enabled: true,
      lastRunAt: null,
      nextRunAt: new Date('2026-03-27T09:00:00.000Z'),
      createdAt: new Date('2026-03-27T08:00:00.000Z'),
      updatedAt: new Date('2026-03-27T08:00:00.000Z'),
      ...overrides
    };
  }

  let debugSpy: jest.SpyInstance;
  let logSpy: jest.SpyInstance;
  let warnSpy: jest.SpyInstance;

  beforeEach(() => {
    debugSpy = jest.spyOn(Logger.prototype, 'debug').mockImplementation(() => undefined);
    logSpy = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('creates a run and marks it completed after chat execution', async () => {
    const dueSchedule = createScheduleRecord();
    const createdRun = {
      id: 'run-1',
      scheduleId: dueSchedule.id,
      userId: dueSchedule.userId,
      requestId: 'request-run-1',
      status: 'RUNNING' as const,
      taskPromptSnapshot: dueSchedule.taskPrompt,
      resultSummary: null,
      errorMessage: null,
      chatSessionId: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now
    };
    const finishedAt = new Date('2026-03-27T09:00:05.000Z');

    const findMany = jest.fn().mockResolvedValue([dueSchedule]);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const createRun = jest.fn().mockResolvedValue(createdRun);
    const updateRun = jest.fn().mockResolvedValue({
      ...createdRun,
      status: 'COMPLETED',
      stage: 'FINALIZING',
      resultSummary: 'done',
      chatSessionId: 'session-1',
      finishedAt
    });
    const updateSchedule = jest.fn().mockResolvedValue({
      ...dueSchedule,
      enabled: false,
      lastRunAt: now,
      nextRunAt: null
    });

    const prisma = {
      schedule: {
        findMany,
        updateMany,
        update: updateSchedule
      },
      scheduleRun: {
        create: createRun,
        update: updateRun
      }
    };

    const chatService = {
      createSessionWithFirstMessage: jest.fn().mockResolvedValue({
        session: {
          id: 'session-1',
          userId: dueSchedule.userId,
          title: 'Morning summary',
          model: 'deepseek-chat',
          createdAt: now,
          updatedAt: now
        },
        userMessage: {
          id: 'msg-1',
          sessionId: 'session-1',
          role: 'USER',
          content: dueSchedule.taskPrompt,
          createdAt: now
        }
      }),
      saveAssistantMessage: jest.fn().mockResolvedValue({
        id: 'msg-2',
        sessionId: 'session-1',
        role: 'ASSISTANT',
        content: 'done',
        createdAt: finishedAt
      })
    };

    const agentService = {
      execute: jest.fn().mockResolvedValue({
        text: 'done',
        run: { id: 'run-1', status: 'COMPLETED', stage: 'FINALIZING' },
        events: []
      })
    };

    const { ScheduleRunnerService } = await import('./schedule-runner.service');
    const service = new ScheduleRunnerService(prisma as never, chatService as never, agentService as never);

    await service.processDueSchedules();

    expect(findMany).toHaveBeenCalledWith({
      where: {
        enabled: true,
        nextRunAt: { lte: now }
      },
      orderBy: { nextRunAt: 'asc' },
      take: 20
    });

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: dueSchedule.id,
        enabled: true,
        nextRunAt: dueSchedule.nextRunAt
      },
      data: {
        lastRunAt: now,
        nextRunAt: null
      }
    });

    expect(createRun).toHaveBeenCalledWith({
      data: {
        scheduleId: dueSchedule.id,
        userId: dueSchedule.userId,
        requestId: expect.any(String),
        status: 'RUNNING',
        stage: 'PREPARING',
        triggerSource: 'SCHEDULE',
        taskPromptSnapshot: dueSchedule.taskPrompt,
        startedAt: now
      },
      select: {
        id: true,
        requestId: true
      }
    });

    expect(chatService.createSessionWithFirstMessage).toHaveBeenCalledWith(
      dueSchedule.userId,
      dueSchedule.taskPrompt,
      createdRun.id
    );

    expect(agentService.execute).toHaveBeenCalledWith({
      userId: dueSchedule.userId,
      sessionId: 'session-1',
      messageId: 'msg-1',
      history: [],
      prompt: dueSchedule.taskPrompt,
      forcedToolCall: undefined,
      scheduleId: dueSchedule.id,
      runId: createdRun.id,
      requestId: createdRun.requestId,
      triggerSource: 'SCHEDULE'
    });

    expect(chatService.saveAssistantMessage).toHaveBeenCalledWith('session-1', 'done', createdRun.id);

    expect(updateRun).toHaveBeenCalledWith({
      where: { id: createdRun.id },
      data: {
        status: 'COMPLETED',
        stage: 'FINALIZING',
        errorCategory: null,
        resultSummary: 'done',
        chatSessionId: 'session-1',
        finishedAt: expect.any(Date)
      }
    });

    expect(debugSpy).toHaveBeenCalledWith(
      'schedule_runner_execution_started',
      {
        scheduleId: dueSchedule.id,
        runId: createdRun.id,
        userId: dueSchedule.userId
      }
    );
    expect(logSpy).toHaveBeenCalledWith(
      'schedule_runner_execution_succeeded',
      {
        scheduleId: dueSchedule.id,
        runId: createdRun.id,
        userId: dueSchedule.userId,
        sessionId: 'session-1',
        resultSummaryLength: 4
      }
    );

    expect(updateSchedule).toHaveBeenCalledWith({
      where: { id: dueSchedule.id },
      data: {
        enabled: false,
        nextRunAt: null,
        lastRunAt: now
      }
    });
  });

  it('skips schedule when already claimed by another runner', async () => {
    const dueSchedule = createScheduleRecord();

    const findMany = jest.fn().mockResolvedValue([dueSchedule]);
    const updateMany = jest.fn().mockResolvedValue({ count: 0 });
    const createRun = jest.fn();

    const prisma = {
      schedule: {
        findMany,
        updateMany,
        update: jest.fn()
      },
      scheduleRun: {
        create: createRun,
        update: jest.fn()
      }
    };

    const chatService = {
      createSessionWithFirstMessage: jest.fn(),
      saveAssistantMessage: jest.fn()
    };

    const agentService = {
      execute: jest.fn()
    };

    const { ScheduleRunnerService } = await import('./schedule-runner.service');
    const service = new ScheduleRunnerService(prisma as never, chatService as never, agentService as never);

    await service.processDueSchedules();

    expect(updateMany).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(
      'schedule_runner_claim_skipped',
      {
        scheduleId: dueSchedule.id,
        userId: dueSchedule.userId
      }
    );
    expect(createRun).not.toHaveBeenCalled();
    expect(chatService.createSessionWithFirstMessage).not.toHaveBeenCalled();
  });

  it('marks run as FAILED when agent execution throws', async () => {
    const dueSchedule = createScheduleRecord();
    const createdRun = {
      id: 'run-2',
      scheduleId: dueSchedule.id,
      userId: dueSchedule.userId,
      requestId: 'request-run-2',
      status: 'RUNNING' as const,
      taskPromptSnapshot: dueSchedule.taskPrompt,
      resultSummary: null,
      errorMessage: null,
      chatSessionId: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now
    };
    const finishedAt = new Date('2026-03-27T09:00:03.000Z');

    const findMany = jest.fn().mockResolvedValue([dueSchedule]);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const createRun = jest.fn().mockResolvedValue(createdRun);
    const updateRun = jest.fn().mockResolvedValue({
      ...createdRun,
      status: 'FAILED',
      errorMessage: 'Agent failed',
      chatSessionId: 'session-2',
      finishedAt
    });

    const prisma = {
      schedule: {
        findMany,
        updateMany,
        update: jest.fn().mockResolvedValue({
          ...dueSchedule,
          enabled: false,
          lastRunAt: now,
          nextRunAt: null
        })
      },
      scheduleRun: {
        create: createRun,
        update: updateRun
      }
    };

    const chatService = {
      createSessionWithFirstMessage: jest.fn().mockImplementation(async () => {
        jest.advanceTimersByTime(3000);
        return {
          session: {
            id: 'session-2',
            userId: dueSchedule.userId,
            title: 'Morning summary',
            model: 'deepseek-chat',
            createdAt: now,
            updatedAt: finishedAt
          },
          userMessage: {
            id: 'msg-3',
            sessionId: 'session-2',
            role: 'USER',
            content: dueSchedule.taskPrompt,
            createdAt: finishedAt
          }
        };
      }),
      saveAssistantMessage: jest.fn()
    };

    const agentService = {
      execute: jest.fn().mockImplementation(() => {
        throw new Error('Agent failed');
      })
    };

    const { ScheduleRunnerService } = await import('./schedule-runner.service');
    const service = new ScheduleRunnerService(prisma as never, chatService as never, agentService as never);

    await service.processDueSchedules();

    expect(updateRun).toHaveBeenCalledWith({
      where: { id: createdRun.id },
      data: {
        status: 'FAILED',
        stage: 'FINALIZING',
        errorCategory: 'SYSTEM_ERROR',
        errorMessage: 'Agent failed',
        chatSessionId: 'session-2',
        finishedAt: expect.any(Date)
      }
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'schedule_runner_execution_failed',
      {
        scheduleId: dueSchedule.id,
        runId: createdRun.id,
        userId: dueSchedule.userId,
        sessionId: 'session-2',
        stage: 'FINALIZING',
        errorCategory: 'SYSTEM_ERROR',
        errorMessage: 'Agent failed'
      }
    );
  });

  it('marks run as FAILED when schedule execution times out', async () => {
    const dueSchedule = createScheduleRecord({
      id: 'schedule-timeout',
      taskPrompt: 'Summarize unread issues slowly'
    });
    const createdRun = {
      id: 'run-timeout',
      scheduleId: dueSchedule.id,
      userId: dueSchedule.userId,
      requestId: 'request-run-timeout',
      status: 'RUNNING' as const,
      taskPromptSnapshot: dueSchedule.taskPrompt,
      resultSummary: null,
      errorMessage: null,
      chatSessionId: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now
    };

    const findMany = jest.fn().mockResolvedValue([dueSchedule]);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const createRun = jest.fn().mockResolvedValue(createdRun);
    const updateRun = jest.fn().mockResolvedValue({
      ...createdRun,
      status: 'FAILED',
      errorMessage: `Schedule run (${dueSchedule.id}) timeout`,
      chatSessionId: 'session-timeout',
      finishedAt: new Date('2026-03-27T09:03:00.000Z')
    });

    const prisma = {
      schedule: {
        findMany,
        updateMany,
        update: jest.fn().mockResolvedValue({
          ...dueSchedule,
          enabled: false,
          lastRunAt: now,
          nextRunAt: null
        })
      },
      scheduleRun: {
        create: createRun,
        update: updateRun
      }
    };

    const chatService = {
      createSessionWithFirstMessage: jest.fn().mockResolvedValue({
        session: {
          id: 'session-timeout',
          userId: dueSchedule.userId,
          title: dueSchedule.title,
          model: 'deepseek-chat',
          createdAt: now,
          updatedAt: now
        },
        userMessage: {
          id: 'msg-timeout-user',
          sessionId: 'session-timeout',
          role: 'USER',
          content: dueSchedule.taskPrompt,
          createdAt: now
        }
      }),
      saveAssistantMessage: jest.fn()
    };

    const agentService = {
      execute: jest.fn().mockImplementation(() => new Promise(() => undefined))
    };

    const { ScheduleRunnerService } = await import('./schedule-runner.service');
    const service = new ScheduleRunnerService(prisma as never, chatService as never, agentService as never);

    const processPromise = service.processDueSchedules();
    await jest.advanceTimersByTimeAsync(180000);
    await processPromise;

    expect(chatService.saveAssistantMessage).not.toHaveBeenCalled();
    expect(updateRun).toHaveBeenCalledWith({
      where: { id: createdRun.id },
      data: {
        status: 'FAILED',
        stage: 'FINALIZING',
        errorCategory: 'TIMEOUT_ERROR',
        errorMessage: `Schedule run (${dueSchedule.id}) timeout`,
        chatSessionId: 'session-timeout',
        finishedAt: expect.any(Date)
      }
    });
    expect(warnSpy).toHaveBeenCalledWith(
      'schedule_runner_execution_failed',
      {
        scheduleId: dueSchedule.id,
        runId: createdRun.id,
        userId: dueSchedule.userId,
        sessionId: 'session-timeout',
        stage: 'FINALIZING',
        errorCategory: 'TIMEOUT_ERROR',
        errorMessage: `Schedule run (${dueSchedule.id}) timeout`
      }
    );
  });

  it('forces get_current_time for schedule prompts that ask to call get_current_time', async () => {
    const dueSchedule = createScheduleRecord({
      id: 'schedule-force-tool',
      taskPrompt: '调用 get_current_time'
    });
    const createdRun = {
      id: 'run-force-tool',
      scheduleId: dueSchedule.id,
      userId: dueSchedule.userId,
      requestId: 'request-run-force-tool',
      status: 'RUNNING' as const,
      taskPromptSnapshot: dueSchedule.taskPrompt,
      resultSummary: null,
      errorMessage: null,
      chatSessionId: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now
    };

    const prisma = {
      schedule: {
        findMany: jest.fn().mockResolvedValue([dueSchedule]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({
          ...dueSchedule,
          enabled: false,
          lastRunAt: now,
          nextRunAt: null
        })
      },
      scheduleRun: {
        create: jest.fn().mockResolvedValue(createdRun),
        update: jest.fn().mockResolvedValue(createdRun)
      }
    };

    const chatService = {
      createSessionWithFirstMessage: jest.fn().mockResolvedValue({
        session: {
          id: 'session-force-tool',
          userId: dueSchedule.userId,
          title: dueSchedule.title,
          model: 'deepseek-chat',
          createdAt: now,
          updatedAt: now
        },
        userMessage: {
          id: 'msg-force-tool-user',
          sessionId: 'session-force-tool',
          role: 'USER',
          content: dueSchedule.taskPrompt,
          createdAt: now
        }
      }),
      saveAssistantMessage: jest.fn().mockResolvedValue({
        id: 'msg-force-tool-assistant',
        sessionId: 'session-force-tool',
        role: 'ASSISTANT',
        content: '2026-03-27T09:00:00.000Z',
        createdAt: now
      })
    };

    const agentService = {
      execute: jest.fn().mockResolvedValue({
        text: '2026-03-27T09:00:00.000Z',
        run: { id: 'run-force-tool', status: 'COMPLETED', stage: 'FINALIZING' },
        events: []
      })
    };

    const { ScheduleRunnerService } = await import('./schedule-runner.service');
    const service = new ScheduleRunnerService(prisma as never, chatService as never, agentService as never);

    await service.processDueSchedules();

    expect(agentService.execute).toHaveBeenCalledWith({
      userId: dueSchedule.userId,
      sessionId: 'session-force-tool',
      messageId: 'msg-force-tool-user',
      history: [],
      prompt: dueSchedule.taskPrompt,
      forcedToolCall: {
        name: 'get_current_time',
        input: { timezone: 'UTC' }
      },
      scheduleId: dueSchedule.id,
      runId: createdRun.id,
      requestId: createdRun.requestId,
      triggerSource: 'SCHEDULE'
    });
  });

  it('does not force get_current_time for unrelated schedule prompts', async () => {
    const dueSchedule = createScheduleRecord({
      id: 'schedule-no-force',
      taskPrompt: 'Summarize unread issues'
    });
    const createdRun = {
      id: 'run-no-force',
      scheduleId: dueSchedule.id,
      userId: dueSchedule.userId,
      requestId: 'request-run-no-force',
      status: 'RUNNING' as const,
      taskPromptSnapshot: dueSchedule.taskPrompt,
      resultSummary: null,
      errorMessage: null,
      chatSessionId: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now
    };

    const prisma = {
      schedule: {
        findMany: jest.fn().mockResolvedValue([dueSchedule]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({
          ...dueSchedule,
          enabled: false,
          lastRunAt: now,
          nextRunAt: null
        })
      },
      scheduleRun: {
        create: jest.fn().mockResolvedValue(createdRun),
        update: jest.fn().mockResolvedValue(createdRun)
      }
    };

    const chatService = {
      createSessionWithFirstMessage: jest.fn().mockResolvedValue({
        session: {
          id: 'session-no-force',
          userId: dueSchedule.userId,
          title: dueSchedule.title,
          model: 'deepseek-chat',
          createdAt: now,
          updatedAt: now
        },
        userMessage: {
          id: 'msg-no-force-user',
          sessionId: 'session-no-force',
          role: 'USER',
          content: dueSchedule.taskPrompt,
          createdAt: now
        }
      }),
      saveAssistantMessage: jest.fn().mockResolvedValue({
        id: 'msg-no-force-assistant',
        sessionId: 'session-no-force',
        role: 'ASSISTANT',
        content: 'done',
        createdAt: now
      })
    };

    const agentService = {
      execute: jest.fn().mockResolvedValue({
        text: 'done',
        run: { id: 'run-no-force', status: 'COMPLETED', stage: 'FINALIZING' },
        events: []
      })
    };

    const { ScheduleRunnerService } = await import('./schedule-runner.service');
    const service = new ScheduleRunnerService(prisma as never, chatService as never, agentService as never);

    await service.processDueSchedules();

    expect(agentService.execute).toHaveBeenCalledWith({
      userId: dueSchedule.userId,
      sessionId: 'session-no-force',
      messageId: 'msg-no-force-user',
      history: [],
      prompt: dueSchedule.taskPrompt,
      forcedToolCall: undefined,
      scheduleId: dueSchedule.id,
      runId: createdRun.id,
      requestId: createdRun.requestId,
      triggerSource: 'SCHEDULE'
    });
  });

  it('processes CRON schedules and computes next run time', async () => {
    const cronSchedule = createScheduleRecord({
      id: 'schedule-3',
      type: 'CRON',
      cronExpr: '0 9 * * *',
      intervalMs: null,
      runAt: null,
      nextRunAt: new Date('2026-03-27T09:00:00.000Z')
    });
    const createdRun = {
      id: 'run-3',
      scheduleId: cronSchedule.id,
      userId: cronSchedule.userId,
      requestId: 'request-run-3',
      status: 'RUNNING' as const,
      taskPromptSnapshot: cronSchedule.taskPrompt,
      resultSummary: null,
      errorMessage: null,
      chatSessionId: null,
      startedAt: now,
      finishedAt: null,
      createdAt: now
    };

    const findMany = jest.fn().mockResolvedValue([cronSchedule]);
    const updateMany = jest.fn().mockResolvedValue({ count: 1 });
    const createRun = jest.fn().mockResolvedValue(createdRun);
    const updateRun = jest.fn().mockResolvedValue({
      ...createdRun,
      status: 'COMPLETED',
      stage: 'FINALIZING',
      resultSummary: 'cron result',
      chatSessionId: 'session-3',
      finishedAt: new Date('2026-03-27T09:00:00.000Z')
    });

    const prisma = {
      schedule: {
        findMany,
        updateMany,
        update: jest.fn().mockResolvedValue({
          ...cronSchedule,
          lastRunAt: now,
          nextRunAt: new Date('2026-03-28T09:00:00.000Z')
        })
      },
      scheduleRun: {
        create: createRun,
        update: updateRun
      }
    };

    const chatService = {
      createSessionWithFirstMessage: jest.fn().mockResolvedValue({
        session: {
          id: 'session-3',
          userId: cronSchedule.userId,
          title: 'Morning summary',
          model: 'deepseek-chat',
          createdAt: now,
          updatedAt: now
        },
        userMessage: {
          id: 'msg-4',
          sessionId: 'session-3',
          role: 'USER',
          content: cronSchedule.taskPrompt,
          createdAt: now
        }
      }),
      saveAssistantMessage: jest.fn().mockResolvedValue({
        id: 'msg-5',
        sessionId: 'session-3',
        role: 'ASSISTANT',
        content: 'cron result',
        createdAt: now
      })
    };

    const agentService = {
      execute: jest.fn().mockResolvedValue({
        text: 'cron result',
        run: { id: 'run-3', status: 'COMPLETED', stage: 'FINALIZING' },
        events: []
      })
    };

    const { ScheduleRunnerService } = await import('./schedule-runner.service');
    const service = new ScheduleRunnerService(prisma as never, chatService as never, agentService as never);

    await service.processDueSchedules();

    expect(updateMany).toHaveBeenCalledWith({
      where: {
        id: cronSchedule.id,
        enabled: true,
        nextRunAt: cronSchedule.nextRunAt
      },
      data: {
        lastRunAt: now,
        nextRunAt: expect.any(Date)
      }
    });
  });
});
