process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_chat';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.JWT_SECRET = process.env.JWT_SECRET || 'change-me';
process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-key';
process.env.DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
process.env.DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

import type { AgentStreamEvent } from '../agent/agent.types';

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

  function makeAgentStream(textChunks: string[], advanceMs = 0): AsyncGenerator<AgentStreamEvent> {
    return (async function* () {
      if (advanceMs > 0) {
        jest.advanceTimersByTime(advanceMs);
      }
      for (const chunk of textChunks) {
        yield { type: 'text_delta' as const, delta: chunk };
      }
      yield { type: 'run_completed' as const };
    })();
  }

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('creates a run and marks it succeeded after chat execution', async () => {
    const dueSchedule = createScheduleRecord();
    const createdRun = {
      id: 'run-1',
      scheduleId: dueSchedule.id,
      userId: dueSchedule.userId,
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
      status: 'SUCCEEDED',
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
      streamChatReply: jest.fn().mockReturnValue(makeAgentStream(['done'], 5000))
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
        status: 'RUNNING',
        taskPromptSnapshot: dueSchedule.taskPrompt,
        startedAt: now
      }
    });

    expect(chatService.createSessionWithFirstMessage).toHaveBeenCalledWith(dueSchedule.userId, dueSchedule.taskPrompt);

    expect(agentService.streamChatReply).toHaveBeenCalledWith({
      userId: dueSchedule.userId,
      sessionId: 'session-1',
      history: [],
      prompt: dueSchedule.taskPrompt
    });

    expect(chatService.saveAssistantMessage).toHaveBeenCalledWith('session-1', 'done');

    expect(updateRun).toHaveBeenCalledWith({
      where: { id: createdRun.id },
      data: {
        status: 'SUCCEEDED',
        resultSummary: 'done',
        chatSessionId: 'session-1',
        finishedAt
      }
    });

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
      streamChatReply: jest.fn()
    };

    const { ScheduleRunnerService } = await import('./schedule-runner.service');
    const service = new ScheduleRunnerService(prisma as never, chatService as never, agentService as never);

    await service.processDueSchedules();

    expect(updateMany).toHaveBeenCalled();
    expect(createRun).not.toHaveBeenCalled();
    expect(chatService.createSessionWithFirstMessage).not.toHaveBeenCalled();
  });

  it('marks run as FAILED when agent execution throws', async () => {
    const dueSchedule = createScheduleRecord();
    const createdRun = {
      id: 'run-2',
      scheduleId: dueSchedule.id,
      userId: dueSchedule.userId,
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
      streamChatReply: jest.fn().mockImplementation(() => {
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
        errorMessage: 'Agent failed',
        chatSessionId: 'session-2',
        finishedAt
      }
    });
  });

  it('processes CRON schedules and computes next run time', async () => {
    const cronSchedule = createScheduleRecord({
      id: 'schedule-3',
      type: 'CRON',
      cronExpr: '0 9 * * *',
      runAt: null,
      nextRunAt: new Date('2026-03-27T09:00:00.000Z')
    });
    const createdRun = {
      id: 'run-3',
      scheduleId: cronSchedule.id,
      userId: cronSchedule.userId,
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
      status: 'SUCCEEDED',
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
      streamChatReply: jest.fn().mockReturnValue(makeAgentStream(['cron result']))
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
        nextRunAt: new Date('2026-03-28T09:00:00.000Z')
      }
    });
  });
});
