import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

describe('ScheduleController (e2e)', () => {
  let app: INestApplication;
  let prisma: any;
  let AgentService: typeof import('../src/modules/agent/agent.service').AgentService;
  let agentService: {
    streamChatReply: jest.Mock;
  };

  const registerUser = async (email: string) => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email, password: 'password123' })
      .expect(201);

    return {
      userId: response.body.user.id as string,
      accessToken: response.body.accessToken as string
    };
  };

  const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

  const waitFor = async (predicate: () => Promise<boolean>, timeoutMs = 15000, intervalMs = 50) => {
    const deadline = Date.now() + timeoutMs;

    while (Date.now() < deadline) {
      if (await predicate()) {
        return;
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }

    throw new Error(`Condition not met within ${timeoutMs}ms`);
  };

  beforeAll(async () => {
    try {
      process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_chat';
      process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
      process.env.JWT_SECRET = process.env.JWT_SECRET || 'change-me';
      process.env.SCHEDULE_TICK_EVERY_MS = process.env.SCHEDULE_TICK_EVERY_MS || '10000';
      process.env.ENABLE_SCHEDULE_TICK = 'true';
      process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-key';
      process.env.DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
      process.env.DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

      const { AppModule } = await import('../src/app.module');
      ({ AgentService } = await import('../src/modules/agent/agent.service'));
      agentService = {
        streamChatReply: jest.fn(async function* () {
          yield { type: 'text-delta', textDelta: 'Automated result' };
          yield { type: 'finish' };
        })
      };
      const moduleRef = await Test.createTestingModule({
        imports: [AppModule]
      })
        .overrideProvider(AgentService)
        .useValue(agentService)
        .compile();

      app = moduleRef.createNestApplication();
      await app.init();
      prisma = app.get((await import('../src/common/prisma/prisma.service')).PrismaService);
      agentService = app.get(AgentService);
    } catch (error) {
      console.error('SCHEDULE_E2E_BEFORE_ALL_ERROR', error);
      throw error;
    }
  });

  beforeEach(async () => {
    try {
      agentService.streamChatReply.mockReset();
      agentService.streamChatReply.mockImplementation(async function* () {
        yield { type: 'text-delta', textDelta: 'Automated result' };
        yield { type: 'finish' };
      });
      await prisma.scheduleRun.deleteMany();
      await prisma.schedule.deleteMany();
      await prisma.chatMessage.deleteMany();
      await prisma.chatSession.deleteMany();
      await prisma.user.deleteMany();
    } catch (error) {
      console.error('SCHEDULE_E2E_BEFORE_EACH_ERROR', error);
      throw error;
    }
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('GET /health reports db redis and tick status', async () => {
    const response = await request(app.getHttpServer()).get('/health').expect(200);

    expect(response.body).toMatchObject({
      ok: true,
      checks: expect.objectContaining({
        database: 'up',
        redis: 'up',
        scheduleTick: expect.any(String)
      })
    });
  });

  it('requires authentication for schedule and run routes', async () => {
    await request(app.getHttpServer()).post('/schedules').send({}).expect(401);
    await request(app.getHttpServer()).get('/schedules').expect(401);
    await request(app.getHttpServer()).patch('/schedules/any-id').send({ title: 'Nope' }).expect(401);
    await request(app.getHttpServer()).delete('/schedules/any-id').expect(401);
    await request(app.getHttpServer()).post('/schedules/any-id/enable').expect(401);
    await request(app.getHttpServer()).post('/schedules/any-id/disable').expect(401);
    await request(app.getHttpServer()).get('/runs').expect(401);
    await request(app.getHttpServer()).get('/runs/any-id').expect(401);
  });

  it('POST /schedules creates a one-time schedule for the current user', async () => {
    const user = await registerUser('schedule-create@example.com');

    const response = await request(app.getHttpServer())
      .post('/schedules')
      .set(authHeader(user.accessToken))
      .send({
        title: 'Morning brief',
        taskPrompt: 'Summarize unread issues',
        type: 'ONE_TIME',
        runAt: '2026-03-28T09:00:00.000Z',
        timezone: 'UTC'
      })
      .expect(201);

    expect(response.body).toMatchObject({
      title: 'Morning brief',
      taskPrompt: 'Summarize unread issues',
      type: 'ONE_TIME',
      cronExpr: null,
      runAt: '2026-03-28T09:00:00.000Z',
      timezone: 'UTC',
      enabled: true,
      lastRunAt: null
    });
    expect(response.body.id).toEqual(expect.any(String));
    expect(response.body.nextRunAt).toEqual(expect.any(String));
  });

  it('GET /schedules returns only current user schedules and applies filters', async () => {
    const owner = await registerUser('schedule-owner@example.com');
    const otherUser = await registerUser('schedule-other@example.com');

    await prisma.schedule.createMany({
      data: [
        {
          id: 'schedule-cron-enabled',
          userId: owner.userId,
          title: 'Daily brief',
          taskPrompt: 'Daily sync',
          type: 'CRON',
          cronExpr: '0 9 * * *',
          runAt: null,
          timezone: 'UTC',
          enabled: true,
          nextRunAt: new Date('2026-03-28T09:00:00.000Z')
        },
        {
          id: 'schedule-cron-disabled',
          userId: owner.userId,
          title: 'Disabled brief',
          taskPrompt: 'Disabled sync',
          type: 'CRON',
          cronExpr: '0 18 * * *',
          runAt: null,
          timezone: 'UTC',
          enabled: false,
          nextRunAt: null
        },
        {
          id: 'schedule-other-user',
          userId: otherUser.userId,
          title: 'Other user schedule',
          taskPrompt: 'Should not leak',
          type: 'CRON',
          cronExpr: '0 10 * * *',
          runAt: null,
          timezone: 'UTC',
          enabled: true,
          nextRunAt: new Date('2026-03-28T10:00:00.000Z')
        }
      ]
    });

    const response = await request(app.getHttpServer())
      .get('/schedules?enabled=true&type=CRON')
      .set(authHeader(owner.accessToken))
      .expect(200);

    expect(response.body.schedules).toHaveLength(1);
    expect(response.body.schedules[0]).toMatchObject({
      id: 'schedule-cron-enabled',
      title: 'Daily brief',
      type: 'CRON',
      cronExpr: '0 9 * * *',
      enabled: true
    });
  });

  it('PATCH /schedules/:id updates owned schedule and rejects another user', async () => {
    const owner = await registerUser('schedule-patch-owner@example.com');
    const otherUser = await registerUser('schedule-patch-other@example.com');

    await prisma.schedule.create({
      data: {
        id: 'schedule-to-update',
        userId: owner.userId,
        title: 'Initial title',
        taskPrompt: 'Initial prompt',
        type: 'ONE_TIME',
        cronExpr: null,
        runAt: new Date('2026-03-28T09:00:00.000Z'),
        timezone: 'UTC',
        enabled: true,
        nextRunAt: new Date('2026-03-28T09:00:00.000Z')
      }
    });

    const updated = await request(app.getHttpServer())
      .patch('/schedules/schedule-to-update')
      .set(authHeader(owner.accessToken))
      .send({
        title: 'Updated title',
        taskPrompt: 'Updated prompt',
        runAt: '2026-03-29T09:30:00.000Z'
      })
      .expect(200);

    expect(updated.body).toMatchObject({
      id: 'schedule-to-update',
      title: 'Updated title',
      taskPrompt: 'Updated prompt',
      type: 'ONE_TIME',
      runAt: '2026-03-29T09:30:00.000Z'
    });

    await request(app.getHttpServer())
      .patch('/schedules/schedule-to-update')
      .set(authHeader(otherUser.accessToken))
      .send({ title: 'Should fail' })
      .expect(404);
  });

  it('DELETE /schedules/:id deletes owned schedule and rejects another user', async () => {
    const owner = await registerUser('schedule-delete-owner@example.com');
    const otherUser = await registerUser('schedule-delete-other@example.com');

    await prisma.schedule.create({
      data: {
        id: 'schedule-to-delete',
        userId: owner.userId,
        title: 'Delete me',
        taskPrompt: 'Remove this schedule',
        type: 'ONE_TIME',
        cronExpr: null,
        runAt: new Date('2026-03-28T09:00:00.000Z'),
        timezone: 'UTC',
        enabled: true,
        nextRunAt: new Date('2026-03-28T09:00:00.000Z')
      }
    });

    await request(app.getHttpServer())
      .delete('/schedules/schedule-to-delete')
      .set(authHeader(otherUser.accessToken))
      .expect(404);

    const deleted = await request(app.getHttpServer())
      .delete('/schedules/schedule-to-delete')
      .set(authHeader(owner.accessToken))
      .expect(200);

    expect(deleted.body).toEqual({
      deletedScheduleId: 'schedule-to-delete'
    });

    const schedule = await prisma.schedule.findUnique({
      where: { id: 'schedule-to-delete' }
    });

    expect(schedule).toBeNull();
  });

  it('POST /schedules/:id/disable and /enable toggles schedule state and rejects another user', async () => {
    const user = await registerUser('schedule-toggle@example.com');
    const otherUser = await registerUser('schedule-toggle-other@example.com');

    await prisma.schedule.create({
      data: {
        id: 'schedule-toggle',
        userId: user.userId,
        title: 'Toggle me',
        taskPrompt: 'Run later',
        type: 'CRON',
        cronExpr: '0 9 * * *',
        runAt: null,
        timezone: 'UTC',
        enabled: true,
        nextRunAt: new Date('2026-03-28T09:00:00.000Z')
      }
    });

    await request(app.getHttpServer())
      .post('/schedules/schedule-toggle/disable')
      .set(authHeader(otherUser.accessToken))
      .expect(404);

    const disabled = await request(app.getHttpServer())
      .post('/schedules/schedule-toggle/disable')
      .set(authHeader(user.accessToken))
      .expect(201);

    expect(disabled.body).toMatchObject({
      id: 'schedule-toggle',
      enabled: false,
      nextRunAt: null
    });

    await request(app.getHttpServer())
      .post('/schedules/schedule-toggle/enable')
      .set(authHeader(otherUser.accessToken))
      .expect(404);

    const enabled = await request(app.getHttpServer())
      .post('/schedules/schedule-toggle/enable')
      .set(authHeader(user.accessToken))
      .expect(201);

    expect(enabled.body).toMatchObject({
      id: 'schedule-toggle',
      enabled: true,
      type: 'CRON',
      cronExpr: '0 9 * * *'
    });
    expect(enabled.body.nextRunAt).toEqual(expect.any(String));
  });

  it('GET /runs returns filtered runs for the current user only', async () => {
    const owner = await registerUser('runs-owner@example.com');
    const otherUser = await registerUser('runs-other@example.com');

    await prisma.schedule.createMany({
      data: [
        {
          id: 'owner-schedule',
          userId: owner.userId,
          title: 'Owner schedule',
          taskPrompt: 'Owner prompt',
          type: 'CRON',
          cronExpr: '0 9 * * *',
          runAt: null,
          timezone: 'UTC',
          enabled: true,
          nextRunAt: new Date('2026-03-28T09:00:00.000Z')
        },
        {
          id: 'other-schedule',
          userId: otherUser.userId,
          title: 'Other schedule',
          taskPrompt: 'Other prompt',
          type: 'CRON',
          cronExpr: '0 10 * * *',
          runAt: null,
          timezone: 'UTC',
          enabled: true,
          nextRunAt: new Date('2026-03-28T10:00:00.000Z')
        }
      ]
    });

    await prisma.scheduleRun.createMany({
      data: [
        {
          id: 'owner-run-succeeded',
          scheduleId: 'owner-schedule',
          userId: owner.userId,
          status: 'SUCCEEDED',
          stage: 'COMPLETED',
          errorCategory: null,
          triggerSource: 'SCHEDULE',
          taskPromptSnapshot: 'Owner prompt',
          resultSummary: 'Done',
          errorMessage: null,
          chatSessionId: null,
          startedAt: new Date('2026-03-27T09:00:00.000Z'),
          finishedAt: new Date('2026-03-27T09:00:05.000Z'),
          createdAt: new Date('2026-03-27T09:00:05.000Z')
        },
        {
          id: 'owner-run-failed',
          scheduleId: 'owner-schedule',
          userId: owner.userId,
          status: 'FAILED',
          stage: 'AGENT',
          errorCategory: 'INTERNAL_ERROR',
          triggerSource: 'SCHEDULE',
          taskPromptSnapshot: 'Owner prompt',
          resultSummary: null,
          errorMessage: 'Boom',
          chatSessionId: null,
          startedAt: new Date('2026-03-27T10:00:00.000Z'),
          finishedAt: new Date('2026-03-27T10:00:02.000Z'),
          createdAt: new Date('2026-03-27T10:00:02.000Z')
        },
        {
          id: 'other-run-succeeded',
          scheduleId: 'other-schedule',
          userId: otherUser.userId,
          status: 'SUCCEEDED',
          stage: 'COMPLETED',
          errorCategory: null,
          triggerSource: 'SCHEDULE',
          taskPromptSnapshot: 'Other prompt',
          resultSummary: 'Should not leak',
          errorMessage: null,
          chatSessionId: null,
          startedAt: new Date('2026-03-27T11:00:00.000Z'),
          finishedAt: new Date('2026-03-27T11:00:03.000Z'),
          createdAt: new Date('2026-03-27T11:00:03.000Z')
        }
      ]
    });

    const response = await request(app.getHttpServer())
      .get('/runs?scheduleId=owner-schedule&status=SUCCEEDED')
      .set(authHeader(owner.accessToken))
      .expect(200);

    expect(response.body.runs).toHaveLength(1);
    expect(response.body.runs[0]).toMatchObject({
      id: 'owner-run-succeeded',
      scheduleId: 'owner-schedule',
      userId: owner.userId,
      status: 'SUCCEEDED',
      stage: 'COMPLETED',
      errorCategory: null,
      triggerSource: 'SCHEDULE',
      durationMs: 5000,
      toolExecutionCount: 0,
      resultSummary: 'Done',
      errorMessage: null,
      schedule: {
        id: 'owner-schedule',
        title: 'Owner schedule',
        type: 'CRON'
      }
    });

    const hidden = await request(app.getHttpServer())
      .get('/runs?scheduleId=other-schedule')
      .set(authHeader(owner.accessToken))
      .expect(200);

    expect(hidden.body.runs).toEqual([]);
  });

  it('GET /runs/:id returns run detail and rejects another user', async () => {
    const owner = await registerUser('run-detail-owner@example.com');
    const otherUser = await registerUser('run-detail-other@example.com');

    await prisma.schedule.create({
      data: {
        id: 'detail-schedule',
        userId: owner.userId,
        title: 'Detail schedule',
        taskPrompt: 'Detail prompt',
        type: 'ONE_TIME',
        cronExpr: null,
        runAt: new Date('2026-03-28T09:00:00.000Z'),
        timezone: 'UTC',
        enabled: false,
        nextRunAt: null
      }
    });

    await prisma.scheduleRun.create({
      data: {
        id: 'detail-run',
        scheduleId: 'detail-schedule',
        userId: owner.userId,
        status: 'FAILED',
        stage: 'TOOL',
        errorCategory: 'EXTERNAL_ERROR',
        triggerSource: 'MANUAL_RETRY',
        taskPromptSnapshot: 'Detail prompt',
        resultSummary: null,
        errorMessage: 'Agent failed',
        chatSessionId: null,
        startedAt: new Date('2026-03-27T12:00:00.000Z'),
        finishedAt: new Date('2026-03-27T12:00:01.000Z'),
        createdAt: new Date('2026-03-27T12:00:01.000Z')
      }
    });

    const response = await request(app.getHttpServer())
      .get('/runs/detail-run')
      .set(authHeader(owner.accessToken))
      .expect(200);

    expect(response.body.run).toMatchObject({
      id: 'detail-run',
      status: 'FAILED',
      stage: 'TOOL',
      errorCategory: 'EXTERNAL_ERROR',
      triggerSource: 'MANUAL_RETRY',
      durationMs: 1000,
      toolExecutionCount: 0,
      errorMessage: 'Agent failed',
      resultSummary: null,
      schedule: {
        id: 'detail-schedule',
        title: 'Detail schedule',
        type: 'ONE_TIME'
      }
    });

    await request(app.getHttpServer())
      .get('/runs/detail-run')
      .set(authHeader(otherUser.accessToken))
      .expect(404);
  });

  it('automatically executes due one-time schedules via tick job', async () => {
    const user = await registerUser('schedule-auto-run@example.com');

    const dueAt = new Date(Date.now() - 1000);

    await prisma.schedule.create({
      data: {
        id: 'auto-run-schedule',
        userId: user.userId,
        title: 'Auto run once',
        taskPrompt: 'Run automatically',
        type: 'ONE_TIME',
        cronExpr: null,
        runAt: dueAt,
        timezone: 'UTC',
        enabled: true,
        nextRunAt: dueAt
      }
    });

    await waitFor(async () => {
      const run = await prisma.scheduleRun.findFirst({
        where: { scheduleId: 'auto-run-schedule' }
      });

      return Boolean(run && run.status !== 'RUNNING');
    });

    const run = await prisma.scheduleRun.findFirstOrThrow({
      where: { scheduleId: 'auto-run-schedule' }
    });
    const schedule = await prisma.schedule.findUniqueOrThrow({
      where: { id: 'auto-run-schedule' }
    });
    const session = await prisma.chatSession.findUnique({
      where: { id: run.chatSessionId }
    });
    const assistantMessage = await prisma.chatMessage.findFirst({
      where: {
        sessionId: run.chatSessionId,
        role: 'ASSISTANT'
      }
    });

    expect(run.userId).toBe(user.userId);
    expect(run.status).toBe('SUCCEEDED');
    expect(run.resultSummary).toEqual(expect.any(String));
    expect(run.resultSummary.length).toBeGreaterThan(0);
    expect(run.chatSessionId).toEqual(expect.any(String));
    expect(schedule.enabled).toBe(false);
    expect(schedule.nextRunAt).toBeNull();
    expect(schedule.lastRunAt).not.toBeNull();
    expect(session?.userId).toBe(user.userId);
    expect(session?.title).toBe('Run automatically');
    expect(assistantMessage?.content).toEqual(expect.any(String));
    expect(assistantMessage?.content?.length ?? 0).toBeGreaterThan(0);
  }, 20000);
});
