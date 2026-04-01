import { randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { AIMessage, HumanMessage, SystemMessage, ToolMessage } from '@langchain/core/messages';
import type { FailureCategory, RunStage, RunSummary, ToolName, ToolExecutionSummary } from '@ai-chat/shared';
import { env } from '../../common/config/env';
import { LlmService } from '../llm/llm.service';
import { ToolService } from '../tool/tool.service';
import type {
  AgentFailureDetails,
  AgentHistoryMessage,
  AgentLoopEvent,
  AgentRunContext,
  ExecutionRequest,
  ForcedToolCall,
  StreamChatReplyResult
} from './agent.types';
import { routeExecutionIntent } from './agent-intent-router';

const MAX_REPAIR_ATTEMPTS = 1;

class AgentRuntimeError extends Error {
  constructor(public readonly details: AgentFailureDetails) {
    super(details.errorMessage);
  }
}

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly toolService: ToolService
  ) {}

  async execute(
    request: ExecutionRequest,
    onEvent?: (event: AgentLoopEvent) => void
  ): Promise<StreamChatReplyResult> {
    const route = routeExecutionIntent(request);
    const context: AgentRunContext = {
      userId: request.userId,
      sessionId: request.sessionId,
      messageId: request.messageId ?? null,
      runId: request.runId ?? randomUUID(),
      scheduleId: request.scheduleId ?? null,
      requestId: route.diagnostics.requestId,
      triggerSource: request.triggerSource,
      intent: route.intent,
      maxIterations: route.maxIterations
    };

    const events: AgentLoopEvent[] = [];
    let run = this.createRunSummary(context, 'RUNNING', 'PREPARING');
    const appendEvent = (event: AgentLoopEvent) => {
      events.push(event);
      onEvent?.(event);
      if (event.type === 'run_stage_changed' || event.type === 'run_repaired') {
        run = event.run;
      }
    };

    this.logger.log('agent_reply_started', {
      userId: context.userId,
      sessionId: context.sessionId,
      runId: context.runId,
      messageId: context.messageId,
      requestId: context.requestId,
      triggerSource: context.triggerSource,
      intent: context.intent,
      hasForcedToolCall: Boolean(route.forcedToolCall)
    });

    appendEvent({ type: 'run_stage_changed', run });

    try {
      let text = '';

      if (route.forcedToolCall) {
        const toolOutcome = await this.executeToolCall(route.forcedToolCall, context, appendEvent);
        text += this.buildToolResponseText(toolOutcome.outputText);
      } else {
        text = await this.executeAgentLoop(request.history, request.prompt, route.systemPrompt, context, appendEvent);
      }

      if (!text.trim()) {
        throw new AgentRuntimeError({
          stage: 'FINALIZING',
          errorCategory: 'SYSTEM_ERROR',
          errorMessage: 'Agent response was empty',
          repairAction: null
        });
      }

      run = this.createRunSummary(context, 'COMPLETED', 'FINALIZING');
      appendEvent({ type: 'run_stage_changed', run });

      this.logger.log('agent_reply_finished', {
        userId: context.userId,
        sessionId: context.sessionId,
        runId: context.runId,
        requestId: context.requestId,
        textLength: text.length
      });

      return {
        text,
        run,
        events
      };
    } catch (error) {
      const details = this.toAgentFailureDetails(error);
      run = this.createRunSummary(context, 'FAILED', details.stage, details);
      appendEvent({ type: 'run_stage_changed', run });

      this.logger.error('agent_reply_failed', {
        userId: context.userId,
        sessionId: context.sessionId,
        runId: context.runId,
        requestId: context.requestId,
        stage: details.stage,
        errorCategory: details.errorCategory,
        errorMessage: details.errorMessage
      });

      throw new AgentRuntimeError(details);
    }
  }

  private async executeAgentLoop(
    history: AgentHistoryMessage[],
    prompt: string,
    systemPrompt: string,
    context: AgentRunContext,
    appendEvent: (event: AgentLoopEvent) => void
  ) {
    const model = this.llmService.createChatModel();
    const toolAwareModel = model.bindTools(this.createLangChainTools() as never, {
      tool_choice: 'auto'
    });
    const conversation = [
      new SystemMessage(systemPrompt),
      ...history.map((message) => this.toLangChainMessage(message)),
      new HumanMessage(prompt)
    ];

    let collectedText = '';
    let repairCount = 0;

    for (let iteration = 0; iteration < context.maxIterations; iteration += 1) {
      appendEvent({ type: 'run_stage_changed', run: this.createRunSummary(context, 'RUNNING', 'MODEL_CALLING') });

      let response: AIMessage;
      try {
        response = await this.withTimeout(
          toolAwareModel.invoke(conversation),
          env.CHAT_STREAM_TIMEOUT_MS,
          'Agent LLM response'
        );
      } catch (error) {
        throw this.wrapModelError(error, 'MODEL_CALLING');
      }

      const text = this.readChunkText(response.content);
      if (text) {
        collectedText += text;
        appendEvent({
          type: 'text_delta',
          runId: context.runId ?? randomUUID(),
          messageId: context.messageId ?? `assistant-${context.sessionId}`,
          textDelta: text
        });
      }

      const toolCalls = this.readToolCalls(response);
      if (toolCalls.length === 0) {
        return collectedText;
      }

      appendEvent({ type: 'run_stage_changed', run: this.createRunSummary(context, 'RUNNING', 'TOOL_RUNNING') });
      conversation.push(response);

      for (let toolCallIndex = 0; toolCallIndex < toolCalls.length; toolCallIndex += 1) {
        const toolCall = toolCalls[toolCallIndex];
        try {
          const toolOutcome = await this.executeToolCall(
            {
              name: toolCall.name as ToolName,
              input: this.readToolCallInput(toolCall.args)
            },
            context,
            appendEvent
          );

          conversation.push(
            new ToolMessage({
              tool_call_id: toolCall.id,
              content: toolOutcome.outputText ?? ''
            })
          );
        } catch (error) {
          const runtimeError = this.toAgentRuntimeError(error, 'TOOL_RUNNING');
          conversation.push(
            new ToolMessage({
              tool_call_id: toolCall.id,
              content: runtimeError.details.errorMessage
            })
          );

          for (const skippedToolCall of toolCalls.slice(toolCallIndex + 1)) {
            conversation.push(
              new ToolMessage({
                tool_call_id: skippedToolCall.id,
                content: 'Skipped because another tool call in the same assistant turn failed before execution.'
              })
            );
          }

          if (repairCount >= MAX_REPAIR_ATTEMPTS) {
            throw runtimeError;
          }

          repairCount += 1;
          const repaired = this.createRunSummary(context, 'RUNNING', 'REPAIRING');
          appendEvent({ type: 'run_repaired', run: repaired, repairAction: 'retry_tool_loop_once' });
          appendEvent({ type: 'run_stage_changed', run: repaired });
          conversation.push(new HumanMessage('The previous tool call failed. Try one more time with corrected arguments or continue without that tool if appropriate.'));
          break;
        }
      }
    }

    throw new AgentRuntimeError({
      stage: 'FINALIZING',
      errorCategory: 'TIMEOUT_ERROR',
      errorMessage: `Agent exceeded max iterations (${context.maxIterations})`,
      repairAction: null
    });
  }

  private async executeToolCall(
    toolCall: ForcedToolCall,
    context: AgentRunContext,
    appendEvent: (event: AgentLoopEvent) => void
  ) {
    const started = await this.toolService.startToolExecution(toolCall.name, toolCall.input, {
      sessionId: context.sessionId,
      userId: context.userId,
      scheduleId: context.scheduleId ?? undefined,
      runId: context.runId ?? undefined,
      messageId: context.messageId ?? undefined,
      requestId: context.requestId
    });

    const startedSummary = this.toToolExecutionSummary(started.execution, null);
    appendEvent({ type: 'tool_started', toolExecution: startedSummary });
    appendEvent({ type: 'tool_progressed', toolExecution: startedSummary });

    try {
      const result = await this.withTimeout(
        started.run(),
        env.TOOL_EXECUTION_TIMEOUT_MS,
        `Agent tool call (${toolCall.name})`
      );
      const completedSummary = this.toToolExecutionSummary(result.execution, null);
      appendEvent({ type: 'tool_completed', toolExecution: completedSummary });
      return result;
    } catch (error) {
      const executionWithCategory = this.readExecutionFromError(error);
      if (!executionWithCategory) {
        throw this.wrapToolError(error, 'TOOL_RUNNING');
      }

      const failedSummary = this.toToolExecutionSummary(
        executionWithCategory.execution,
        executionWithCategory.category
      );
      appendEvent({ type: 'tool_failed', toolExecution: failedSummary });
      throw new AgentRuntimeError({
        stage: 'TOOL_RUNNING',
        errorCategory: executionWithCategory.category,
        errorMessage: failedSummary.errorMessage ?? 'Tool execution failed',
        repairAction: 'tool_execution_failed'
      });
    }
  }

  private createRunSummary(
    context: AgentRunContext,
    status: RunSummary['status'],
    stage: RunStage,
    failure?: Pick<AgentFailureDetails, 'errorCategory' | 'errorMessage'> | null
  ): RunSummary {
    return {
      id: context.runId ?? context.requestId,
      sessionId: context.sessionId,
      messageId: context.messageId,
      scheduleId: context.scheduleId,
      status,
      stage,
      triggerSource: context.triggerSource,
      failureCategory: failure?.errorCategory ?? null,
      failureCode: null,
      failureMessage: failure?.errorMessage ?? null,
      startedAt: null,
      finishedAt: null
    };
  }

  private wrapModelError(error: unknown, stage: RunStage) {
    if (error instanceof AgentRuntimeError) {
      return error;
    }

    return new AgentRuntimeError({
      stage,
      errorCategory: error instanceof Error && /timeout$/i.test(error.message) ? 'TIMEOUT_ERROR' : 'MODEL_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Model execution failed',
      repairAction: null
    });
  }

  private wrapToolError(error: unknown, stage: RunStage) {
    if (error instanceof AgentRuntimeError) {
      return error;
    }

    return new AgentRuntimeError({
      stage,
      errorCategory: error instanceof Error && /timeout$/i.test(error.message) ? 'TIMEOUT_ERROR' : 'TOOL_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Tool execution failed',
      repairAction: null
    });
  }

  private toAgentRuntimeError(error: unknown, stage: RunStage) {
    if (error instanceof AgentRuntimeError) {
      return error;
    }

    return this.wrapToolError(error, stage);
  }

  private toAgentFailureDetails(error: unknown): AgentFailureDetails {
    if (error instanceof AgentRuntimeError) {
      return error.details;
    }

    return {
      stage: 'FINALIZING',
      errorCategory: 'SYSTEM_ERROR',
      errorMessage: error instanceof Error ? error.message : 'Agent execution failed',
      repairAction: null
    };
  }

  private createLangChainTools() {
    return this.toolService.listDefinitions().map((definition) => ({
      name: definition.name,
      description: definition.description,
      schema: this.toolService.getDefinition(definition.name)?.schema
    }));
  }

  private toToolExecutionSummary(
    execution: {
      id: string;
      sessionId: string;
      runId?: string | null;
      messageId?: string | null;
      toolName: string;
      status: string;
      input: unknown;
      output: unknown;
      progressMessage?: string | null;
      partialOutput?: string | null;
      errorMessage: string | null;
      startedAt: Date | string;
      finishedAt: Date | string | null;
    },
    failureCategory: FailureCategory | null
  ): ToolExecutionSummary {
    return {
      id: execution.id,
      sessionId: execution.sessionId,
      runId: execution.runId ?? null,
      messageId: execution.messageId ?? null,
      toolName: execution.toolName as ToolExecutionSummary['toolName'],
      status: execution.status as ToolExecutionSummary['status'],
      progressMessage: execution.progressMessage ?? null,
      input: this.toNullableJsonString(execution.input),
      output: execution.status === 'SUCCEEDED' ? this.toNullableJsonString(execution.output) : null,
      partialOutput: execution.partialOutput ?? null,
      errorCategory: failureCategory,
      errorMessage: failureCategory ? execution.errorMessage ?? 'Tool execution failed' : null,
      canRetry: execution.status === 'FAILED',
      canCancel: execution.status === 'PENDING' || execution.status === 'RUNNING',
      startedAt: this.toIsoString(execution.startedAt),
      finishedAt: execution.finishedAt ? this.toIsoString(execution.finishedAt) : null
    };
  }

  private readExecutionFromError(error: unknown) {
    if (typeof error === 'object' && error !== null && 'execution' in error && 'category' in error) {
      return error as {
        execution: {
          id: string;
          sessionId: string;
          runId?: string | null;
          messageId?: string | null;
          toolName: string;
          status: string;
          input: unknown;
          output: unknown;
          progressMessage?: string | null;
          partialOutput?: string | null;
          errorMessage: string | null;
          startedAt: Date | string;
          finishedAt: Date | string | null;
        };
        category: FailureCategory;
      };
    }

    return null;
  }

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

  private readToolCalls(response: {
    tool_calls?: unknown;
    additional_kwargs?: { tool_calls?: unknown };
  }) {
    const normalizedToolCalls = this.normalizeToolCalls(response.tool_calls);
    if (normalizedToolCalls.length > 0) {
      return normalizedToolCalls;
    }

    return this.normalizeOpenAiCompatibleToolCalls(response.additional_kwargs?.tool_calls);
  }

  private normalizeToolCalls(toolCalls: unknown) {
    if (!Array.isArray(toolCalls)) {
      return [];
    }

    return toolCalls.filter(
      (toolCall): toolCall is { id: string; name: string; args: unknown } =>
        typeof toolCall === 'object' &&
        toolCall !== null &&
        typeof toolCall.id === 'string' &&
        typeof toolCall.name === 'string'
    );
  }

  private normalizeOpenAiCompatibleToolCalls(toolCalls: unknown) {
    if (!Array.isArray(toolCalls)) {
      return [];
    }

    return toolCalls.flatMap((toolCall) => {
      if (typeof toolCall !== 'object' || toolCall === null || typeof toolCall.id !== 'string') {
        return [];
      }

      const rawFunction = 'function' in toolCall ? toolCall.function : null;
      if (typeof rawFunction !== 'object' || rawFunction === null || typeof rawFunction.name !== 'string') {
        return [];
      }

      const rawArguments = rawFunction.arguments;
      if (typeof rawArguments === 'string') {
        try {
          return [{ id: toolCall.id, name: rawFunction.name, args: JSON.parse(rawArguments) as unknown }];
        } catch {
          return [{ id: toolCall.id, name: rawFunction.name, args: {} }];
        }
      }

      if (typeof rawArguments === 'object' && rawArguments !== null) {
        return [{ id: toolCall.id, name: rawFunction.name, args: rawArguments }];
      }

      return [{ id: toolCall.id, name: rawFunction.name, args: {} }];
    });
  }

  private readToolCallInput(args: unknown) {
    if (typeof args === 'object' && args !== null) {
      return args as Record<string, unknown>;
    }

    return {};
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
