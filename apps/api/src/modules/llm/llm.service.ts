import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ChatOpenAI } from '@langchain/openai';
import { env } from '../../common/config/env';

@Injectable()
export class LlmService {
  readonly model = env.DEEPSEEK_MODEL;

  createChatModel() {
    if (!env.DEEPSEEK_API_KEY) {
      throw new InternalServerErrorException('DeepSeek API key is missing');
    }

    return new ChatOpenAI({
      apiKey: env.DEEPSEEK_API_KEY,
      model: this.model,
      configuration: {
        baseURL: env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
      }
    });
  }
}
