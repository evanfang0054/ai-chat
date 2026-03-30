import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';

class FakeAiMessage {
  constructor(
    public readonly content: unknown,
    public readonly tool_calls?: Array<{ name: string; args: Record<string, unknown> }>
  ) {}
}

describe('AI schedule management (e2e)', () => {
  let app: INestApplication;
  let prisma: any;
  let responseQueue: Array<{ content: unknown; tool_calls?: Array<{ name: string; args: Record<string, unknown> }> }> = [];

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

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_chat';
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'change-me';
    process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-key';
    process.env.DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    process.env.DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

    const { AppModule } = await import('../src/app.module');
    const { LlmService } = await import('../src/modules/llm/llm.service');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(LlmService)
      .useValue({
        createChatModel: jest.fn().mockImplementation(() => ({
          bindTools: jest.fn().mockReturnValue({
            invoke: jest.fn().mockImplementation(async () => {
              const nextResponse = responseQueue.shift();
              if (!nextResponse) {
                throw new Error('No fake LLM response queued');
              }
              return new FakeAiMessage(nextResponse.content, nextResponse.tool_calls) as never;
            })
          })
        }))
      })
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get((await import('../src/common/prisma/prisma.service')).PrismaService);
    await prisma.toolExecution.deleteMany();
    await prisma.chatMessage.deleteMany();
    await prisma.chatSession.deleteMany();
    await prisma.scheduleRun.deleteMany();
    await prisma.schedule.deleteMany();
    await prisma.user.deleteMany();
  });

  beforeEach(async () => {
    responseQueue = [];
    await prisma.toolExecution.deleteMany();
    await prisma.chatMessage.deleteMany();
    await prisma.chatSession.deleteMany();
    await prisma.scheduleRun.deleteMany();
    await prisma.schedule.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    if (prisma) {
      await prisma.$disconnect();
    }
  });

  it('asks for confirmation before deleting a schedule when the user has not confirmed yet', async () => {
    const user = await registerUser('ai-delete-confirm@example.com');

    await prisma.schedule.create({
      data: {
        id: 'schedule-delete-target',
        userId: user.userId,
        title: 'Daily summary',
        taskPrompt: 'Summarize inbox',
        type: 'CRON',
        cronExpr: '0 9 * * *',
        runAt: null,
        timezone: 'UTC',
        enabled: true,
        nextRunAt: new Date('2026-03-31T09:00:00.000Z')
      }
    });

    responseQueue.push({
      content: '请先确认是否真的要删除 “Daily summary” 这个定时任务。'
    });

    const response = await request(app.getHttpServer())
      .post('/chat/stream')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set('Accept', 'text/event-stream')
      .send({ content: '删除 Daily summary 这个定时任务' })
      .expect(201);

    const payloads = response.text
      .trim()
      .split('\n\n')
      .map((chunk) => chunk.split('\n').find((line) => line.startsWith('data: ')))
      .filter((line): line is string => Boolean(line))
      .map((line) => JSON.parse(line.slice(6)));

    expect(payloads).toHaveLength(3);
    expect(payloads[0]).toMatchObject({
      type: 'run_started',
      userMessage: { role: 'USER', content: '删除 Daily summary 这个定时任务' }
    });
    expect(payloads[1]).toEqual({
      type: 'text_delta',
      delta: '请先确认是否真的要删除 “Daily summary” 这个定时任务。'
    });
    expect(payloads[2]).toMatchObject({
      type: 'run_completed',
      message: {
        role: 'ASSISTANT',
        content: '请先确认是否真的要删除 “Daily summary” 这个定时任务。'
      }
    });

    const schedules = await prisma.schedule.findMany({ where: { userId: user.userId } });
    const toolExecutions = await prisma.toolExecution.findMany();

    expect(schedules).toHaveLength(1);
    expect(schedules[0].id).toBe('schedule-delete-target');
    expect(toolExecutions).toHaveLength(0);
  });

  it('lists or disambiguates before mutating when multiple schedules match the target', async () => {
    const user = await registerUser('ai-ambiguous-update@example.com');

    await prisma.schedule.createMany({
      data: [
        {
          id: 'schedule-report-1',
          userId: user.userId,
          title: 'Report Morning',
          taskPrompt: 'Generate morning report',
          type: 'CRON',
          cronExpr: '0 9 * * *',
          runAt: null,
          timezone: 'UTC',
          enabled: true,
          nextRunAt: new Date('2026-03-31T09:00:00.000Z')
        },
        {
          id: 'schedule-report-2',
          userId: user.userId,
          title: 'Report Evening',
          taskPrompt: 'Generate evening report',
          type: 'CRON',
          cronExpr: '0 18 * * *',
          runAt: null,
          timezone: 'UTC',
          enabled: true,
          nextRunAt: new Date('2026-03-31T18:00:00.000Z')
        }
      ]
    });

    responseQueue.push({
      content: '我找到了多个与 report 相关的定时任务，请先说明你要操作的是哪一个。'
    });

    const response = await request(app.getHttpServer())
      .post('/chat/stream')
      .set('Authorization', `Bearer ${user.accessToken}`)
      .set('Accept', 'text/event-stream')
      .send({ content: '帮我停用 report 定时任务' })
      .expect(201);

    const payloads = response.text
      .trim()
      .split('\n\n')
      .map((chunk) => chunk.split('\n').find((line) => line.startsWith('data: ')))
      .filter((line): line is string => Boolean(line))
      .map((line) => JSON.parse(line.slice(6)));

    expect(payloads).toHaveLength(3);
    expect(payloads[0]).toMatchObject({
      type: 'run_started',
      userMessage: { role: 'USER', content: '帮我停用 report 定时任务' }
    });
    expect(payloads[1]).toEqual({
      type: 'text_delta',
      delta: '我找到了多个与 report 相关的定时任务，请先说明你要操作的是哪一个。'
    });
    expect(payloads[2]).toMatchObject({
      type: 'run_completed',
      message: {
        role: 'ASSISTANT',
        content: '我找到了多个与 report 相关的定时任务，请先说明你要操作的是哪一个。'
      }
    });

    const schedules = await prisma.schedule.findMany({
      where: { userId: user.userId },
      orderBy: { id: 'asc' }
    });
    const toolExecutions = await prisma.toolExecution.findMany();

    expect(schedules.map((schedule: { id: string; enabled: boolean }) => ({ id: schedule.id, enabled: schedule.enabled }))).toEqual([
      { id: 'schedule-report-1', enabled: true },
      { id: 'schedule-report-2', enabled: true }
    ]);
    expect(toolExecutions).toHaveLength(0);
  });
});
