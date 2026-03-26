import OpenAI from 'openai';
import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { env } from '../../common/config/env';
import type { LlmMessage, LlmStreamEvent } from './llm.types';

@Injectable()
export class LlmService {
  private readonly client = new OpenAI({
    apiKey: env.DEEPSEEK_API_KEY,
    baseURL: env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
  });

  readonly model = env.DEEPSEEK_MODEL;

  async *streamChat(messages: LlmMessage[]): AsyncGenerator<LlmStreamEvent> {
    if (!env.DEEPSEEK_API_KEY) {
      throw new InternalServerErrorException('DeepSeek API key is missing');
    }

    const stream = await this.client.chat.completions.create({
      model: this.model,
      stream: true,
      messages
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content;
      if (text) {
        yield { type: 'delta', text };
      }
    }

    yield { type: 'completed' };
  }
}
