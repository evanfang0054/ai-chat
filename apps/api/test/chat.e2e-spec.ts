import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import type { RunSummary, ToolExecutionSummary } from '@ai-chat/shared';
import { parseDataStreamPart } from 'ai';
import request from 'supertest';

type ParsedStreamPart = ReturnType<typeof parseDataStreamPart>;
type AgentExecute = jest.MockedFunction<(
  request: Record<string, unknown>,
  onEvent?: (event: Record<string, unknown>) => void
) => Promise<{ text: string; run: RunSummary; events: Array<Record<string, unknown>> }>>;

const parseStreamParts = (responseText: string): ParsedStreamPart[] =>
  responseText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => parseDataStreamPart(line));

const getDataParts = (parts: ParsedStreamPart[]) =>
  parts.filter((part): part is Extract<ParsedStreamPart, { type: 'data' }> => part.type === 'data');

jest.setTimeout(30000);

const createRunSummary = (overrides?: Partial<RunSummary>): RunSummary => ({
  id: 'run-1',
  sessionId: 'pending-session-id',
  messageId: 'assistant-run-1',
  scheduleId: null,
  status: 'COMPLETED',
  stage: 'FINALIZING',
  triggerSource: 'USER',
  failureCategory: null,
  failureCode: null,
  failureMessage: null,
  startedAt: null,
  finishedAt: null,
  ...overrides
});

const createToolExecution = (overrides?: Partial<ToolExecutionSummary>): ToolExecutionSummary => ({
  id: 'tool-execution-1',
  sessionId: 'pending-session-id',
  runId: 'run-1',
  messageId: 'assistant-run-1',
  toolName: 'get_current_time',
  status: 'RUNNING',
  progressMessage: null,
  input: '{"timezone":"UTC"}',
  output: null,
  partialOutput: null,
  errorCategory: null,
  errorMessage: null,
  canRetry: false,
  canCancel: true,
  startedAt: '2026-03-26T12:00:00.000Z',
  finishedAt: null,
  ...overrides
});

describe('ChatController (e2e)', () => {
  let app: INestApplication;
  let prisma: any;
  let shouldFailAgent = false;
  const agentService: { execute: AgentExecute } = {
    execute: jest.fn() as AgentExecute
  };

  beforeAll(async () => {
    try {
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
    } catch (error) {
      console.error('CHAT_E2E_BEFORE_ALL_ERROR', error);
      throw error;
    }
  });

  beforeEach(async () => {
    agentService.execute.mockReset();
    shouldFailAgent = false;
    await prisma.chatMessage.deleteMany();
    await prisma.chatSession.deleteMany();
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

  it('POST /chat/stream returns 401 when token user no longer exists', async () => {
    const user = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'deleted-user@example.com', password: 'password123' })
      .expect(201);

    await prisma.user.delete({ where: { id: user.body.user.id } });

    await request(app.getHttpServer())
      .post('/chat/stream')
      .set('Authorization', `Bearer ${user.body.accessToken}`)
      .send({ content: 'Hello after deletion' })
      .expect(401);
  });

  it('POST /chat/stream creates a session, streams tool and assistant output, and saves messages', async () => {
    agentService.execute.mockImplementation(async (request, onEvent) => {
      onEvent?.({
        type: 'run_stage_changed',
        run: createRunSummary({
          id: request.runId as string,
          sessionId: request.sessionId as string,
          messageId: request.messageId as string,
          status: 'RUNNING',
          stage: 'MODEL_CALLING'
        })
      });
      onEvent?.({
        type: 'tool_started',
        toolExecution: createToolExecution({
          id: 'tool-execution-1',
          sessionId: request.sessionId as string,
          runId: request.runId as string,
          messageId: request.messageId as string
        })
      });
      onEvent?.({
        type: 'tool_progressed',
        toolExecution: createToolExecution({
          id: 'tool-execution-1',
          sessionId: request.sessionId as string,
          runId: request.runId as string,
          messageId: request.messageId as string,
          progressMessage: 'Looking up UTC time'
        })
      });
      onEvent?.({
        type: 'tool_completed',
        toolExecution: createToolExecution({
          id: 'tool-execution-1',
          sessionId: request.sessionId as string,
          runId: request.runId as string,
          messageId: request.messageId as string,
          status: 'SUCCEEDED',
          output: '{"now":"2026-03-26T12:00:00.000Z"}',
          canCancel: false,
          finishedAt: '2026-03-26T12:00:01.000Z'
        })
      });
      onEvent?.({
        type: 'text_delta',
        runId: request.runId as string,
        messageId: request.messageId as string,
        textDelta: 'Hello'
      });
      onEvent?.({
        type: 'text_delta',
        runId: request.runId as string,
        messageId: request.messageId as string,
        textDelta: ' world'
      });

      return {
        text: 'Hello world',
        run: createRunSummary({
          id: request.runId as string,
          sessionId: request.sessionId as string,
          messageId: request.messageId as string
        }),
        events: []
      };
    });

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

    const parts = parseStreamParts(response.text);
    const dataParts = getDataParts(parts);

    expect(parts).toEqual([
      expect.objectContaining({
        type: 'start_step',
        value: { messageId: expect.any(String) }
      }),
      expect.objectContaining({
        type: 'data',
        value: [
          expect.objectContaining({
            type: 'run_started',
            run: expect.objectContaining({
              status: 'RUNNING',
              stage: 'PREPARING',
              triggerSource: 'USER'
            }),
            session: expect.objectContaining({
              title: 'Tell me something nice',
              model: 'deepseek-chat'
            }),
            message: expect.objectContaining({
              role: 'USER',
              content: 'Tell me something nice'
            })
          })
        ]
      }),
      expect.objectContaining({
        type: 'data',
        value: [
          expect.objectContaining({
            type: 'run_stage_changed',
            run: expect.objectContaining({
              status: 'RUNNING',
              stage: 'MODEL_CALLING'
            })
          })
        ]
      }),
      expect.objectContaining({
        type: 'data',
        value: [
          expect.objectContaining({
            type: 'tool_started',
            toolExecution: expect.objectContaining({
              id: 'tool-execution-1',
              toolName: 'get_current_time',
              status: 'RUNNING',
              input: '{"timezone":"UTC"}',
              output: null,
              sessionId: expect.any(String)
            })
          })
        ]
      }),
      expect.objectContaining({
        type: 'tool_call',
        value: {
          toolCallId: 'tool-execution-1',
          toolName: 'get_current_time',
          args: { timezone: 'UTC' }
        }
      }),
      expect.objectContaining({
        type: 'data',
        value: [
          expect.objectContaining({
            type: 'tool_progressed',
            toolExecution: expect.objectContaining({
              id: 'tool-execution-1',
              toolName: 'get_current_time',
              status: 'RUNNING',
              progressMessage: 'Looking up UTC time',
              sessionId: expect.any(String)
            })
          })
        ]
      }),
      expect.objectContaining({
        type: 'tool_call',
        value: {
          toolCallId: 'tool-execution-1',
          toolName: 'get_current_time',
          args: { timezone: 'UTC' }
        }
      }),
      expect.objectContaining({
        type: 'data',
        value: [
          expect.objectContaining({
            type: 'tool_completed',
            toolExecution: expect.objectContaining({
              id: 'tool-execution-1',
              toolName: 'get_current_time',
              status: 'SUCCEEDED',
              output: '{"now":"2026-03-26T12:00:00.000Z"}',
              sessionId: expect.any(String)
            })
          })
        ]
      }),
      expect.objectContaining({
        type: 'tool_result',
        value: {
          toolCallId: 'tool-execution-1',
          result: { now: '2026-03-26T12:00:00.000Z' }
        }
      }),
      expect.objectContaining({
        type: 'data',
        value: [
          expect.objectContaining({
            type: 'text_delta',
            textDelta: 'Hello'
          })
        ]
      }),
      expect.objectContaining({ type: 'text', value: 'Hello' }),
      expect.objectContaining({
        type: 'data',
        value: [
          expect.objectContaining({
            type: 'text_delta',
            textDelta: ' world'
          })
        ]
      }),
      expect.objectContaining({ type: 'text', value: ' world' }),
      expect.objectContaining({
        type: 'data',
        value: [
          expect.objectContaining({
            type: 'run_completed',
            run: expect.objectContaining({
              status: 'COMPLETED',
              stage: 'FINALIZING'
            }),
            message: expect.objectContaining({
              role: 'ASSISTANT',
              content: 'Hello world'
            })
          })
        ]
      }),
      expect.objectContaining({
        type: 'finish_step',
        value: {
          isContinued: false,
          finishReason: 'stop'
        }
      }),
      expect.objectContaining({
        type: 'finish_message',
        value: {
          finishReason: 'stop'
        }
      })
    ]);

    const runStarted = dataParts[0].value[0] as Record<string, any>;
    const toolStarted = dataParts[2].value[0] as Record<string, any>;
    const toolProgressed = dataParts[3].value[0] as Record<string, any>;
    const toolCompleted = dataParts[4].value[0] as Record<string, any>;
    const runCompleted = dataParts[7].value[0] as Record<string, any>;

    expect(toolStarted.toolExecution.sessionId).toBe(runStarted.session.id);
    expect(toolProgressed.toolExecution.sessionId).toBe(runStarted.session.id);
    expect(toolCompleted.toolExecution.sessionId).toBe(runStarted.session.id);
    expect(runCompleted.run.sessionId).toBe(runStarted.session.id);
    expect(agentService.execute).toHaveBeenCalledWith(
      {
        userId: user.body.user.id,
        sessionId: runStarted.session.id,
        messageId: expect.any(String),
        runId: expect.any(String),
        triggerSource: 'USER',
        history: [],
        prompt: 'Tell me something nice'
      },
      expect.any(Function)
    );

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

  it('POST /chat/stream emits tool failure data and does not persist assistant on agent failure', async () => {
    agentService.execute.mockImplementation(async (request, onEvent) => {
      if (shouldFailAgent) {
        onEvent?.({
          type: 'tool_started',
          toolExecution: createToolExecution({
            id: 'tool-execution-2',
            sessionId: request.sessionId as string,
            runId: request.runId as string,
            messageId: request.messageId as string
          })
        });
        throw new Error('Tool execution failed');
      }

      return {
        text: '',
        run: createRunSummary({
          id: request.runId as string,
          sessionId: request.sessionId as string,
          messageId: request.messageId as string,
          status: 'FAILED',
          stage: 'FINALIZING',
          failureCategory: 'SYSTEM_ERROR',
          failureMessage: 'Tool execution failed'
        }),
        events: []
      };
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

    const parts = parseStreamParts(response.text);
    const dataParts = getDataParts(parts);

    expect(parts).toEqual([
      expect.objectContaining({
        type: 'start_step',
        value: { messageId: expect.any(String) }
      }),
      expect.objectContaining({
        type: 'data',
        value: [
          expect.objectContaining({
            type: 'run_started',
            session: expect.objectContaining({ title: 'Trigger failure' }),
            message: expect.objectContaining({ role: 'USER', content: 'Trigger failure' })
          })
        ]
      }),
      expect.objectContaining({
        type: 'data',
        value: [
          expect.objectContaining({
            type: 'tool_started',
            toolExecution: expect.objectContaining({
              id: 'tool-execution-2',
              status: 'RUNNING',
              finishedAt: null,
              sessionId: expect.any(String)
            })
          })
        ]
      }),
      expect.objectContaining({
        type: 'tool_call',
        value: {
          toolCallId: 'tool-execution-2',
          toolName: 'get_current_time',
          args: { timezone: 'UTC' }
        }
      }),
      expect.objectContaining({
        type: 'data',
        value: [
          expect.objectContaining({
            type: 'run_failed',
            run: expect.objectContaining({
              status: 'FAILED',
              stage: 'FINALIZING',
              failureCategory: 'SYSTEM_ERROR',
              failureMessage: 'Tool execution failed'
            })
          })
        ]
      }),
      expect.objectContaining({
        type: 'error',
        value: 'Tool execution failed'
      })
    ]);

    const runStarted = dataParts[0].value[0] as Record<string, any>;
    const toolStarted = dataParts[1].value[0] as Record<string, any>;
    const runFailed = dataParts[2].value[0] as Record<string, any>;

    expect(toolStarted.toolExecution.sessionId).toBe(runStarted.session.id);
    expect(runFailed.run.sessionId).toBe(runStarted.session.id);

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
    agentService.execute.mockImplementation(async (request, onEvent) => {
      onEvent?.({
        type: 'text_delta',
        runId: request.runId as string,
        messageId: request.messageId as string,
        textDelta: 'Second'
      });
      onEvent?.({
        type: 'text_delta',
        runId: request.runId as string,
        messageId: request.messageId as string,
        textDelta: ' reply'
      });

      return {
        text: 'Second reply',
        run: createRunSummary({
          id: request.runId as string,
          sessionId: request.sessionId as string,
          messageId: request.messageId as string
        }),
        events: []
      };
    });

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

    const parts = parseStreamParts(response.text);
    const dataParts = getDataParts(parts);

    expect(parts[0]).toMatchObject({
      type: 'start_step',
      value: { messageId: expect.any(String) }
    });
    expect(parts[1]).toMatchObject({
      type: 'data',
      value: [
        expect.objectContaining({
          type: 'run_started',
          session: expect.objectContaining({ id: 'existing-session', title: 'Existing session', model: 'deepseek-chat' }),
          message: expect.objectContaining({ role: 'USER', content: 'Second question' })
        })
      ]
    });
    expect(parts[2]).toMatchObject({
      type: 'data',
      value: [expect.objectContaining({ type: 'text_delta', textDelta: 'Second' })]
    });
    expect(parts[3]).toMatchObject({ type: 'text', value: 'Second' });
    expect(parts[4]).toMatchObject({
      type: 'data',
      value: [expect.objectContaining({ type: 'text_delta', textDelta: ' reply' })]
    });
    expect(parts[5]).toMatchObject({ type: 'text', value: ' reply' });
    expect(parts[6]).toMatchObject({
      type: 'data',
      value: [
        expect.objectContaining({
          type: 'run_completed',
          run: expect.objectContaining({ sessionId: 'existing-session' }),
          message: expect.objectContaining({ role: 'ASSISTANT', content: 'Second reply' })
        })
      ]
    });
    expect(parts[7]).toMatchObject({
      type: 'finish_step',
      value: { isContinued: false, finishReason: 'stop' }
    });
    expect(parts[8]).toMatchObject({
      type: 'finish_message',
      value: { finishReason: 'stop' }
    });

    const runStarted = dataParts[0].value[0] as Record<string, any>;
    expect(runStarted.session.id).toBe('existing-session');

    expect(agentService.execute).toHaveBeenCalledWith(
      {
        userId: user.body.user.id,
        sessionId: 'existing-session',
        messageId: expect.any(String),
        runId: expect.any(String),
        triggerSource: 'USER',
        history: [
          { role: 'USER', content: 'First question' },
          { role: 'ASSISTANT', content: 'First answer' }
        ],
        prompt: 'Second question'
      },
      expect.any(Function)
    );

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
