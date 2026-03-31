import { Injectable, Logger } from '@nestjs/common';
import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import type {
  ErrorCategory,
  ToolExecutionFailedSummary,
  ToolExecutionRunningSummary,
  ToolExecutionSucceededSummary,
  ToolName
} from '@ai-chat/shared';
import { env } from '../../common/config/env';
import { LlmService } from '../llm/llm.service';
import { ToolService } from '../tool/tool.service';
import type {
  AgentExecutionContext,
  AgentFailureDetails,
  AgentHistoryMessage,
  AgentStreamEvent,
  StreamChatReplyInput
} from './agent.types';

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
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly toolService: ToolService
  ) {}

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs);
        if (typeof timer === 'object' && typeof timer.unref === 'function') {
          timer.unref();
        }
      })
    ]);
  }

  async *streamChatReply(input: StreamChatReplyInput): AsyncGenerator<AgentStreamEvent> {
    const executionContext = this.buildExecutionContext(input);
    this.logger.log('agent_reply_started', {
      ...executionContext,
      hasForcedToolCall: Boolean(input.forcedToolCall)
    });

    if (input.forcedToolCall) {
      let hasOutput = false;

      try {
        for await (const event of this.runToolCall(input.forcedToolCall.name, input.forcedToolCall.input, input)) {
          if (event.type === 'text-delta' && event.textDelta) {
            hasOutput = true;
          }
          yield event;
        }

        if (!hasOutput) {
          throw new Error('Agent response was empty');
        }

        this.logger.log('agent_reply_finished', {
          ...executionContext,
          finishReason: 'forced_tool_call_completed'
        });
        yield { type: 'finish' };
        return;
      } catch (error) {
        const failure = this.toAgentFailureDetails(error);
        this.logger.error('agent_reply_failed', {
          ...executionContext,
          ...failure
        });
        yield { type: 'agent-error', error: failure };
        throw error;
      }
    }

    const model = this.llmService.createChatModel();
    const messages = [
      new SystemMessage(AGENT_SYSTEM_PROMPT),
      ...input.history.map((message) => this.toLangChainMessage(message)),
      new HumanMessage(input.prompt)
    ];

    try {
      const toolAwareModel = model.bindTools(this.createLangChainTools() as never, {
        tool_choice: 'auto'
      });
      const response = await this.withTimeout(
        toolAwareModel.invoke(messages),
        env.CHAT_STREAM_TIMEOUT_MS,
        'Agent LLM response'
      );
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

      this.logger.log('agent_reply_finished', {
        ...executionContext,
        finishReason: toolCalls.length > 0 ? 'tool_call_completed' : 'text_completed'
      });
      yield { type: 'finish' };
    } catch (error) {
      const failure = this.toAgentFailureDetails(error);
      this.logger.error('agent_reply_failed', {
        ...executionContext,
        ...failure
      });
      yield { type: 'agent-error', error: failure };
      throw error;
    }
  }

  private buildExecutionContext(input: StreamChatReplyInput): AgentExecutionContext {
    return {
      userId: input.userId,
      sessionId: input.sessionId,
      scheduleId: input.scheduleId ?? null,
      runId: input.runId ?? null
    };
  }

  private toAgentFailureDetails(error: unknown): AgentFailureDetails {
    if (error instanceof AgentToolExecutionFailedError) {
      return {
        stage: 'TOOL',
        errorCategory: error.execution.errorCategory,
        errorMessage: error.execution.errorMessage
      };
    }

    return {
      stage: 'LLM',
      errorCategory: 'INTERNAL_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Agent execution failed'
    };
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
    const executionContext = this.buildExecutionContext(context);
    const started = await this.toolService.startToolExecution(name, toolInput, {
      sessionId: context.sessionId,
      userId: context.userId,
      scheduleId: context.scheduleId,
      runId: context.runId
    });

    this.logger.log('agent_tool_call_started', {
      ...executionContext,
      toolName: name,
      toolExecutionId: started.execution.id
    });
    yield { type: 'tool-input-start', toolExecution: this.toRunningExecutionSummary(started.execution) };
    yield { type: 'tool-input-available', toolExecution: this.toRunningExecutionSummary(started.execution) };

    try {
      const result = await this.withTimeout(started.run(), env.TOOL_EXECUTION_TIMEOUT_MS, `Agent tool call (${name})`);
      this.logger.log('agent_tool_call_succeeded', {
        ...executionContext,
        toolName: name,
        toolExecutionId: result.execution.id
      });
      yield {
        type: 'tool-output-available',
        toolExecution: this.toSucceededExecutionSummary(result.execution)
      };

      const response = this.buildToolResponseText(result.outputText);
      if (response) {
        yield { type: 'text-delta', textDelta: response };
      }
    } catch (error) {
      const executionWithCategory = this.readExecutionFromError(error);
      if (!executionWithCategory) {
        throw error;
      }

      const failedSummary = this.toFailedExecutionSummary(
        executionWithCategory.execution,
        executionWithCategory.category
      );
      this.logger.error('agent_tool_call_failed', {
        ...executionContext,
        toolName: name,
        toolExecutionId: failedSummary.id,
        errorCategory: failedSummary.errorCategory,
        errorMessage: failedSummary.errorMessage
      });
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
      errorCategory: null,
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
      errorCategory: null,
      errorMessage: null,
      startedAt: this.toIsoString(execution.startedAt),
      finishedAt: this.toIsoString(finishedAt)
    };
  }

  private toFailedExecutionSummary(
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
    },
    errorCategory: ErrorCategory
  ): ToolExecutionFailedSummary {
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
      errorCategory,
      errorMessage: execution.errorMessage ?? 'Tool execution failed',
      startedAt: this.toIsoString(execution.startedAt),
      finishedAt: this.toIsoString(finishedAt)
    };
  }

  private readExecutionFromError(error: unknown) {
    if (typeof error === 'object' && error !== null && 'execution' in error && 'category' in error) {
      return error as {
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
        category: ErrorCategory;
      };
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
