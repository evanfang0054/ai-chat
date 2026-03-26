const createLlmStream = async function* () {
  yield { type: 'delta' as const, text: 'Hello' };
  yield { type: 'completed' as const };
};

const llmService = {
  streamChat: jest.fn()
};

describe('RunService', () => {
  beforeEach(() => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_chat';
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'change-me';
    process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-key';
    process.env.DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    process.env.DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    llmService.streamChat.mockReset();
  });

  it('maps chat history into llm messages and yields llm events', async () => {
    llmService.streamChat.mockImplementation(createLlmStream);

    const { RunService } = await import('./run.service');
    const service = new RunService(llmService as never);
    const result: Array<{ type: string; text?: string }> = [];

    for await (const event of service.streamReply({
      history: [
        { role: 'USER', content: 'Hi' },
        { role: 'ASSISTANT', content: 'Hello, how can I help?' }
      ],
      prompt: 'Tell me a joke'
    })) {
      result.push(event);
    }

    expect(llmService.streamChat).toHaveBeenCalledWith([
      { role: 'user', content: 'Hi' },
      { role: 'assistant', content: 'Hello, how can I help?' },
      { role: 'user', content: 'Tell me a joke' }
    ]);
    expect(result).toEqual([
      { type: 'delta', text: 'Hello' },
      { type: 'completed' }
    ]);
  });
});
