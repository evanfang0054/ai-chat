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

    for await (const event of service.streamChatReply({ history: [], prompt: 'Ping' })) {
      events.push(event);
    }

    expect(events).toEqual([{ type: 'text_delta', delta: 'ok' }, { type: 'run_completed' }]);
  });
});
