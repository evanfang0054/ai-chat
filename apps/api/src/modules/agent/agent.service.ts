import { Injectable } from '@nestjs/common';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type {
  ToolExecutionFailedSummary,
  ToolExecutionRunningSummary,
  ToolExecutionSucceededSummary,
  ToolName
} from '@ai-chat/shared';
import { LlmService } from '../llm/llm.service';
import { ToolService } from '../tool/tool.service';
import type { AgentHistoryMessage, AgentStreamEvent, StreamChatReplyInput } from './agent.types';

const AGENT_SYSTEM_PROMPT = `You are a tool-using assistant inside an AI chat product.

Rules:
- If the user asks you to perform an action that matches an available tool, call the tool instead of asking a follow-up question.
- If a schedule or time request can be completed with a reasonable default timezone, use UTC by default.
- Do not ask the user for timezone before creating a schedule unless timezone is explicitly required to avoid an incorrect result.
- When the user asks to create, update, list, enable, disable, or delete schedules, prefer using manage_schedule.
- For schedule creation requests written in natural language, infer the structured manage_schedule arguments yourself whenever a reasonable default exists.
- When creating schedules, translate phrases like "every 10 seconds", "every minute", or "tomorrow at 9am" into manage_schedule fields such as type, cronExpr, intervalMs, runAt, title, taskPrompt, and timezone.
- For "every X seconds" or "every X minutes" (where X < 60), use type=INTERVAL with intervalMs (in milliseconds). For example: "every 10 seconds" = type=INTERVAL, intervalMs=10000.
- For standard cron patterns like "every hour", "daily at 9am", use type=CRON with cronExpr.
- For one-time schedules like "tomorrow at 9am", use type=ONE_TIME with runAt.
- If the user describes the task to run, copy that instruction into taskPrompt and create a short title instead of asking for one.
- Before deleting a schedule, require an explicit user confirmation in natural language unless the user has already clearly confirmed that exact deletion request.
- If the user wants to update, enable, disable, or delete a schedule but the target schedule is ambiguous, prefer calling manage_schedule with action="list" first or ask a disambiguation question instead of guessing.
- When the user asks for the current time, prefer using get_current_time.
- After a tool succeeds, briefly confirm the result in natural language.
- Only ask a follow-up question when a required tool argument cannot be inferred and no safe default exists.`;

class AgentToolExecutionFailedError extends Error {
  constructor(public readonly execution: ToolExecutionFailedSummary) {
    super(execution.errorMessage);
  }
}

@Injectable()
export class AgentService {
  constructor(
    private readonly llmService: LlmService,
    private readonly toolService: ToolService
  ) {}

  async *streamChatReply(input: StreamChatReplyInput): AsyncGenerator<AgentStreamEvent> {
    if (input.forcedToolCall) {
      let hasOutput = false;

      for await (const event of this.runToolCall(input.forcedToolCall.name, input.forcedToolCall.input, input)) {
        if (event.type === 'text-delta' && event.textDelta) {
          hasOutput = true;
        }
        yield event;
      }

      if (!hasOutput) {
        throw new Error('Agent response was empty');
      }

      yield { type: 'finish' };
      return;
    }

    const model = this.llmService.createChatModel();
    const messages = [
      new SystemMessage(AGENT_SYSTEM_PROMPT),
      ...input.history.map((message) => this.toLangChainMessage(message)),
      new HumanMessage(input.prompt)
    ];

    const toolAwareModel = model.bindTools(this.createLangChainTools() as never, {
      tool_choice: 'auto'
    });
    const response = await toolAwareModel.invoke(messages);
    let hasOutput = false;

    const toolCalls = this.readToolCalls(response);
    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        for await (const event of this.runToolCall(toolCall.name, this.readToolCallInput(toolCall.args), input)) {
          if (event.type === 'text-delta' && event.textDelta) {
            hasOutput = true;
          }
          yield event;
        }
      }
    }

    const text = toolCalls.length === 0 ? this.readChunkText(response.content) : '';
    if (text) {
      hasOutput = true;
      yield { type: 'text-delta', textDelta: text };
    }

    if (!hasOutput) {
      throw new Error('Agent response was empty');
    }

    yield { type: 'finish' };
  }

  private createLangChainTools() {
    return this.toolService.listDefinitions().map((definition) => ({
      name: definition.name,
      description: definition.description,
      schema: this.toolService.getDefinition(definition.name)?.schema
    }));
  }

  private async *runToolCall(
    name: string,
    toolInput: Record<string, unknown>,
    context: StreamChatReplyInput
  ): AsyncGenerator<AgentStreamEvent> {
    const started = await this.toolService.startToolExecution(name, toolInput, {
      sessionId: context.sessionId,
      userId: context.userId
    });

    yield { type: 'tool-input-start', toolExecution: this.toRunningExecutionSummary(started.execution) };
    yield { type: 'tool-input-available', toolExecution: this.toRunningExecutionSummary(started.execution) };

    try {
      const result = await started.run();
      yield {
        type: 'tool-output-available',
        toolExecution: this.toSucceededExecutionSummary(result.execution)
      };

      const response = this.buildToolResponseText(result.outputText);
      if (response) {
        yield { type: 'text-delta', textDelta: response };
      }
    } catch (error) {
      const execution = this.readExecutionFromError(error);
      if (!execution) {
        throw error;
      }

      const failedSummary = this.toFailedExecutionSummary(execution);
      yield {
        type: 'tool-output-error',
        toolExecution: failedSummary
      };
      throw new AgentToolExecutionFailedError(failedSummary);
    }
  }

  private readToolCalls(response: { tool_calls?: unknown }) {
    if (Array.isArray(response.tool_calls)) {
      return response.tool_calls.filter(
        (toolCall): toolCall is { name: string; args: unknown } =>
          typeof toolCall === 'object' && toolCall !== null && typeof toolCall.name === 'string'
      );
    }

    return [];
  }

  private readToolCallInput(args: unknown) {
    if (typeof args === 'object' && args !== null) {
      return args as Record<string, unknown>;
    }

    return {};
  }

  private toRunningExecutionSummary(execution: {
    id: string;
    sessionId: string;
    toolName: string;
    status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
    input: unknown;
    output: unknown;
    errorMessage: string | null;
    startedAt: Date | string;
    finishedAt: Date | string | null;
  }): ToolExecutionRunningSummary {
    return {
      id: execution.id,
      sessionId: execution.sessionId,
      toolName: execution.toolName as ToolName,
      status: 'RUNNING',
      input: this.toNullableJsonString(execution.input),
      output: null,
      errorMessage: null,
      startedAt: this.toIsoString(execution.startedAt),
      finishedAt: null
    };
  }

  private toSucceededExecutionSummary(execution: {
    id: string;
    sessionId: string;
    toolName: string;
    status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
    input: unknown;
    output: unknown;
    errorMessage: string | null;
    startedAt: Date | string;
    finishedAt: Date | string | null;
  }): ToolExecutionSucceededSummary {
    const finishedAt = execution.finishedAt;
    if (finishedAt === null) {
      throw new Error('Succeeded tool execution is missing finishedAt');
    }

    return {
      id: execution.id,
      sessionId: execution.sessionId,
      toolName: execution.toolName as ToolName,
      status: 'SUCCEEDED',
      input: this.toNullableJsonString(execution.input),
      output: this.toNullableJsonString(execution.output),
      errorMessage: null,
      startedAt: this.toIsoString(execution.startedAt),
      finishedAt: this.toIsoString(finishedAt)
    };
  }

  private toFailedExecutionSummary(execution: {
    id: string;
    sessionId: string;
    toolName: string;
    status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
    input: unknown;
    output: unknown;
    errorMessage: string | null;
    startedAt: Date | string;
    finishedAt: Date | string | null;
  }): ToolExecutionFailedSummary {
    const finishedAt = execution.finishedAt;
    if (finishedAt === null) {
      throw new Error('Failed tool execution is missing finishedAt');
    }

    return {
      id: execution.id,
      sessionId: execution.sessionId,
      toolName: execution.toolName as ToolName,
      status: 'FAILED',
      input: this.toNullableJsonString(execution.input),
      output: this.toNullableJsonString(execution.output),
      errorMessage: execution.errorMessage ?? 'Tool execution failed',
      startedAt: this.toIsoString(execution.startedAt),
      finishedAt: this.toIsoString(finishedAt)
    };
  }

  private readExecutionFromError(error: unknown) {
    if (typeof error === 'object' && error !== null && 'execution' in error) {
      return (error as {
        execution: {
          id: string;
          sessionId: string;
          toolName: string;
          status: 'RUNNING' | 'SUCCEEDED' | 'FAILED';
          input: unknown;
          output: unknown;
          errorMessage: string | null;
          startedAt: Date | string;
          finishedAt: Date | string | null;
        };
      }).execution;
    }

    return null;
  }

  private buildToolResponseText(outputText: string | null) {
    if (!outputText) {
      return '';
    }

    try {
      const parsed = JSON.parse(outputText) as {
        now?: string;
        time?: string;
        deletedScheduleId?: string;
        schedules?: Array<{ title?: string; type?: string; enabled?: boolean }>;
        title?: string;
        type?: string;
        enabled?: boolean;
      };
      const currentTime = parsed.now ?? parsed.time;
      if (currentTime) {
        return `The current UTC time is ${currentTime}.`;
      }
      if (parsed.deletedScheduleId) {
        return `Deleted schedule ${parsed.deletedScheduleId}.`;
      }
      if (Array.isArray(parsed.schedules)) {
        if (parsed.schedules.length === 0) {
          return 'No schedules found.';
        }
        return `Found ${parsed.schedules.length} schedules.`;
      }
      if (typeof parsed.title === 'string' && typeof parsed.type === 'string') {
        return `Schedule "${parsed.title}" (${parsed.type}) is now ${parsed.enabled ? 'enabled' : 'saved'}.`;
      }
    } catch {
      return outputText;
    }

    return outputText;
  }

  private toIsoString(value: Date | string) {
    return value instanceof Date ? value.toISOString() : value;
  }

  private toNullableJsonString(value: unknown) {
    if (value === null || value === undefined) {
      return null;
    }

    return typeof value === 'string' ? value : JSON.stringify(value);
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
