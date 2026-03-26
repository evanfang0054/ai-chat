import { Injectable } from '@nestjs/common';
import { LlmService } from '../llm/llm.service';
import type { LlmStreamEvent } from '../llm/llm.types';

interface HistoryMessage {
  role: 'USER' | 'ASSISTANT' | 'SYSTEM';
  content: string;
}

interface StreamReplyInput {
  history: HistoryMessage[];
  prompt: string;
}

@Injectable()
export class RunService {
  constructor(private readonly llmService: LlmService) {}

  async *streamReply(input: StreamReplyInput): AsyncGenerator<LlmStreamEvent> {
    const messages = [
      ...input.history.map((message) => ({
        role:
          message.role === 'ASSISTANT'
            ? ('assistant' as const)
            : message.role === 'SYSTEM'
              ? ('system' as const)
              : ('user' as const),
        content: message.content
      })),
      { role: 'user' as const, content: input.prompt }
    ];

    for await (const event of this.llmService.streamChat(messages)) {
      yield event;
    }
  }
}
