import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';

const createStream = async function* (...events: Array<{ type: string; delta?: string }>) {
  for (const event of events) {
    yield event;
  }
};

describe('ChatController (e2e)', () => {
  let app: INestApplication;
  let prisma: any;
  let shouldFailAgent = false;
  const agentService = {
    streamChatReply: jest.fn()
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_chat';
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'change-me';
    process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-key';
    process.env.DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    process.env.DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';

    const { AppModule } = await import('../src/app.module');
    const { AgentService } = await import('../src/modules/agent/agent.service');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    })
      .overrideProvider(AgentService)
      .useValue(agentService)
      .compile();

    app = moduleRef.createNestApplication();
    await app.init();
    prisma = app.get((await import('../src/common/prisma/prisma.service')).PrismaService);
    await prisma.chatMessage.deleteMany();
    await prisma.chatSession.deleteMany();
    await prisma.user.deleteMany();
  });

  beforeEach(async () => {
    agentService.streamChatReply.mockReset();
    shouldFailAgent = false;
    await prisma.chatMessage.deleteMany();
    await prisma.chatSession.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
    await prisma.$disconnect();
  });

  it('GET /chat/sessions returns only current user sessions', async () => {
    const user1 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'chat1@example.com', password: 'password123' })
      .expect(201);

    const user2 = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'chat2@example.com', password: 'password123' })
      .expect(201);

    await prisma.chatSession.createMany({
      data: [
        { id: 'session-1', userId: user1.body.user.id, title: 'Mine', model: 'deepseek-chat' },
        { id: 'session-2', userId: user2.body.user.id, title: 'Not mine', model: 'deepseek-chat' }
      ]
    });

    const response = await request(app.getHttpServer())
      .get('/chat/sessions')
      .set('Authorization', `Bearer ${user1.body.accessToken}`)
      .expect(200);

    expect(response.body.sessions).toEqual([
      expect.objectContaining({ id: 'session-1', title: 'Mine', model: 'deepseek-chat' })
    ]);
  });

  it('GET /chat/sessions/:sessionId/messages rejects access to another user session', async () => {
    const owner = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'owner@example.com', password: 'password123' })
      .expect(201);

    const otherUser = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'other@example.com', password: 'password123' })
      .expect(201);

    await prisma.chatSession.create({
      data: {
        id: 'private-session',
        userId: owner.body.user.id,
        title: 'Private session',
        model: 'deepseek-chat',
        messages: {
          create: [
            {
              id: 'private-message',
              role: 'USER',
              content: 'secret'
            }
          ]
        }
      }
    });

    await request(app.getHttpServer())
      .get('/chat/sessions/private-session/messages')
      .set('Authorization', `Bearer ${otherUser.body.accessToken}`)
      .expect(404);
  });

  it('GET /chat/sessions/:sessionId/messages returns session and ordered messages', async () => {
    const user = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'history@example.com', password: 'password123' })
      .expect(201);

    await prisma.chatSession.create({
      data: {
        id: 'history-session',
        userId: user.body.user.id,
        title: 'History',
        model: 'deepseek-chat',
        messages: {
          create: [
            {
              id: 'message-1',
              role: 'USER',
              content: 'Hi',
              createdAt: new Date('2026-03-26T10:00:00.000Z')
            },
            {
              id: 'message-2',
              role: 'ASSISTANT',
              content: 'Hello',
              createdAt: new Date('2026-03-26T10:00:01.000Z')
            }
          ]
        }
      }
    });

    const response = await request(app.getHttpServer())
      .get('/chat/sessions/history-session/messages')
      .set('Authorization', `Bearer ${user.body.accessToken}`)
      .expect(200);

    expect(response.body.session).toEqual(
      expect.objectContaining({
        id: 'history-session',
        title: 'History',
        model: 'deepseek-chat'
      })
    );
    expect(response.body.messages).toEqual([
      expect.objectContaining({ id: 'message-1', role: 'USER', content: 'Hi' }),
      expect.objectContaining({ id: 'message-2', role: 'ASSISTANT', content: 'Hello' })
    ]);
  });

  it('POST /chat/stream rejects blank content', async () => {
    const user = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'blank@example.com', password: 'password123' })
      .expect(201);

    await request(app.getHttpServer())
      .post('/chat/stream')
      .set('Authorization', `Bearer ${user.body.accessToken}`)
      .send({ content: '' })
      .expect(400);
  });

  it('POST /chat/stream creates a session, streams assistant output, and saves messages', async () => {
    agentService.streamChatReply.mockImplementation(() =>
      createStream(
        { type: 'text_delta', delta: 'Hello' },
        { type: 'text_delta', delta: ' world' },
        { type: 'run_completed' }
      )
    );

    const user = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'stream@example.com', password: 'password123' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/chat/stream')
      .set('Authorization', `Bearer ${user.body.accessToken}`)
      .set('Accept', 'text/event-stream')
      .send({ content: 'Tell me something nice' })
      .expect(201);

    expect(response.text).toContain('event: message');

    const payloads = response.text
      .trim()
      .split('\n\n')
      .map((chunk) => chunk.split('\n').find((line) => line.startsWith('data: ')))
      .filter((line): line is string => Boolean(line))
      .map((line) => JSON.parse(line.slice(6)));

    expect(payloads).toHaveLength(4);
    expect(payloads[0]).toMatchObject({
      type: 'run_started',
      session: {
        title: 'Tell me something nice',
        model: 'deepseek-chat'
      },
      userMessage: {
        role: 'USER',
        content: 'Tell me something nice'
      }
    });
    expect(payloads[1]).toEqual({ type: 'text_delta', delta: 'Hello' });
    expect(payloads[2]).toEqual({ type: 'text_delta', delta: ' world' });
    expect(payloads[3]).toMatchObject({
      type: 'run_completed',
      session: {
        id: payloads[0].session.id,
        title: 'Tell me something nice'
      },
      message: {
        role: 'ASSISTANT',
        content: 'Hello world'
      }
    });

    expect(agentService.streamChatReply).toHaveBeenCalledWith({
      history: [],
      prompt: 'Tell me something nice'
    });

    const sessions = await prisma.chatSession.findMany({
      where: { userId: user.body.user.id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    expect(sessions).toHaveLength(1);
    expect(sessions[0].title).toBe('Tell me something nice');
    expect(sessions[0].messages.map((message: { role: string; content: string }) => ({ role: message.role, content: message.content }))).toEqual([
      { role: 'USER', content: 'Tell me something nice' },
      { role: 'ASSISTANT', content: 'Hello world' }
    ]);
  });

  it('POST /chat/stream emits error event and does not persist assistant on agent failure', async () => {
    agentService.streamChatReply.mockImplementation(async function* () {
      if (shouldFailAgent) {
        throw new Error('agent failed');
      }

      yield { type: 'run_completed' as const };
    });
    shouldFailAgent = true;

    const user = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'agentfail@example.com', password: 'password123' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/chat/stream')
      .set('Authorization', `Bearer ${user.body.accessToken}`)
      .set('Accept', 'text/event-stream')
      .send({ content: 'Trigger failure' })
      .expect(201);

    expect(response.text).toContain('"type":"run_failed"');

    const session = await prisma.chatSession.findFirstOrThrow({
      where: { userId: user.body.user.id }
    });
    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: session.id },
      orderBy: { createdAt: 'asc' }
    });

    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe('USER');
    expect(messages[0].content).toBe('Trigger failure');
  });

  it('POST /chat/stream appends to an existing session and keeps prior history', async () => {
    agentService.streamChatReply.mockImplementation(() =>
      createStream(
        { type: 'text_delta', delta: 'Second' },
        { type: 'text_delta', delta: ' reply' },
        { type: 'run_completed' }
      )
    );

    const user = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'existing@example.com', password: 'password123' })
      .expect(201);

    await prisma.chatSession.create({
      data: {
        id: 'existing-session',
        userId: user.body.user.id,
        title: 'Existing session',
        model: 'deepseek-chat',
        messages: {
          create: [
            {
              id: 'existing-user-message',
              role: 'USER',
              content: 'First question',
              createdAt: new Date('2026-03-26T10:00:00.000Z')
            },
            {
              id: 'existing-assistant-message',
              role: 'ASSISTANT',
              content: 'First answer',
              createdAt: new Date('2026-03-26T10:00:01.000Z')
            }
          ]
        }
      }
    });

    const response = await request(app.getHttpServer())
      .post('/chat/stream')
      .set('Authorization', `Bearer ${user.body.accessToken}`)
      .set('Accept', 'text/event-stream')
      .send({ sessionId: 'existing-session', content: 'Second question' })
      .expect(201);

    const payloads = response.text
      .trim()
      .split('\n\n')
      .map((chunk) => chunk.split('\n').find((line) => line.startsWith('data: ')))
      .filter((line): line is string => Boolean(line))
      .map((line) => JSON.parse(line.slice(6)));

    expect(payloads[0]).toMatchObject({
      type: 'run_started',
      session: { id: 'existing-session' },
      userMessage: { role: 'USER', content: 'Second question' }
    });
    expect(payloads[payloads.length - 1]).toMatchObject({
      type: 'run_completed',
      message: { role: 'ASSISTANT', content: 'Second reply' }
    });

    expect(agentService.streamChatReply).toHaveBeenCalledWith({
      history: [
        { role: 'USER', content: 'First question' },
        { role: 'ASSISTANT', content: 'First answer' }
      ],
      prompt: 'Second question'
    });

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: 'existing-session' },
      orderBy: { createdAt: 'asc' }
    });

    expect(messages.map((message: { role: string; content: string }) => ({ role: message.role, content: message.content }))).toEqual([
      { role: 'USER', content: 'First question' },
      { role: 'ASSISTANT', content: 'First answer' },
      { role: 'USER', content: 'Second question' },
      { role: 'ASSISTANT', content: 'Second reply' }
    ]);
  });
});
