import { Injectable } from '@nestjs/common';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { LlmService } from '../llm/llm.service';
import type { AgentHistoryMessage, AgentStreamEvent, StreamChatReplyInput } from './agent.types';

@Injectable()
export class AgentService {
  constructor(private readonly llmService: LlmService) {}

  async *streamChatReply(input: StreamChatReplyInput): AsyncGenerator<AgentStreamEvent> {
    const model = this.llmService.createChatModel();
    const messages = [
      ...input.history.map((message) => this.toLangChainMessage(message)),
      new HumanMessage(input.prompt)
    ];

    const stream = await model.stream(messages);
    for await (const chunk of stream) {
      const text = this.readChunkText(chunk.content);
      if (text) {
        yield { type: 'text_delta', delta: text };
      }
    }

    yield { type: 'run_completed' };
  }

  private toLangChainMessage(message: AgentHistoryMessage) {
    if (message.role === 'SYSTEM') {
      return new SystemMessage(message.content);
    }
    if (message.role === 'ASSISTANT') {
      return new AIMessage(message.content);
    }
    return new HumanMessage(message.content);
  }

  private readChunkText(content: unknown) {
    if (typeof content === 'string') {
      return content;
    }
    if (Array.isArray(content)) {
      return content
        .filter((item): item is { type?: string; text?: string } => typeof item === 'object' && item !== null)
        .map((item) => (item.type === 'text' ? item.text ?? '' : ''))
        .join('');
    }
    return '';
  }
}
