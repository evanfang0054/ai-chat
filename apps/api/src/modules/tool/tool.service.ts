import { Injectable, Logger } from '@nestjs/common';
import type { Prisma, ToolExecution } from '@prisma/client';
import { ToolExecutionStatus } from '@prisma/client';
import { env } from '../../common/config/env';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ScheduleService } from '../schedule/schedule.service';
import type { ToolDefinition, ToolExecutionContext, ToolFailureCategory, ToolInput, ToolMetadata } from './tool.types';
import { getCurrentTimeTool } from './tools/get-current-time.tool';
import { ManageScheduleTool } from './tools/manage-schedule.tool';

class ToolExecutionError extends Error {
  constructor(
    message: string,
    public readonly category: ToolFailureCategory,
    public readonly execution: ToolExecution
  ) {
    super(message);
  }
}

@Injectable()
export class ToolService {
  private readonly logger = new Logger(ToolService.name);
  private readonly tools: Map<string, ToolDefinition<any>>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduleService: ScheduleService
  ) {
    const manageScheduleTool = new ManageScheduleTool(this.scheduleService);
    this.tools = new Map<string, ToolDefinition<any>>([
      [getCurrentTimeTool.name, getCurrentTimeTool],
      [manageScheduleTool.name, manageScheduleTool]
    ]);
  }

  listDefinitions(): ToolMetadata[] {
    return Array.from(this.tools.values(), ({ name, description }) => ({ name, description }));
  }

  getDefinition(name: string) {
    return this.tools.get(name) ?? null;
  }

  private toJsonValue(value: ToolInput): Prisma.InputJsonValue {
    return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  }

  private buildLogContext(context: ToolExecutionContext, extra: Record<string, unknown> = {}) {
    return {
      userId: context.userId,
      sessionId: context.sessionId,
      scheduleId: context.scheduleId ?? null,
      runId: context.runId ?? null,
      messageId: context.messageId ?? null,
      requestId: context.requestId ?? null,
      ...extra
    };
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

  private categorizeToolFailure(error: unknown): ToolFailureCategory {
    if (
      typeof error === 'object' &&
      error !== null &&
      'category' in error &&
      typeof error.category === 'string' &&
      [
        'INPUT_ERROR',
        'TOOL_ERROR',
        'MODEL_ERROR',
        'DEPENDENCY_ERROR',
        'TIMEOUT_ERROR',
        'SYSTEM_ERROR',
        'CANCELLED'
      ].includes(error.category)
    ) {
      return error.category as ToolFailureCategory;
    }

    if (error instanceof Error && /timeout$/i.test(error.message)) {
      return 'TIMEOUT_ERROR';
    }

    return 'TOOL_ERROR';
  }

  async startToolExecution(name: string, input: ToolInput, context: ToolExecutionContext) {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const startedAt = new Date();
    const pendingExecution = {
      id: `pending-${startedAt.getTime()}`,
      sessionId: context.sessionId,
      runId: context.runId ?? null,
      messageId: context.messageId ?? null,
      toolName: tool.name,
      status: 'PENDING' as const,
      input,
      output: null,
      progressMessage: 'Tool queued',
      partialOutput: null,
      errorMessage: null,
      startedAt,
      finishedAt: null
    };

    const execution = await this.prisma.toolExecution.create({
      data: {
        sessionId: context.sessionId,
        runId: context.runId ?? null,
        messageId: context.messageId ?? null,
        requestId: context.requestId ?? null,
        toolName: tool.name,
        status: ToolExecutionStatus.RUNNING,
        input: this.toJsonValue(input),
        progressMessage: 'Tool running',
        partialOutput: null
      }
    });

    const runningExecution = execution;

    this.logger.log('tool_execution_started', this.buildLogContext(context, { toolName: name, toolExecutionId: execution.id }));

    return {
      execution: runningExecution,
      pendingExecution,
      run: async () => {
        try {
          const output = await this.withTimeout(
            Promise.resolve(tool.execute(input, context)),
            env.TOOL_EXECUTION_TIMEOUT_MS,
            `Tool execution (${name})`
          );
          const outputText = JSON.stringify(output);
          const finishedAt = new Date();
          const updatedExecution = await this.prisma.toolExecution.update({
            where: { id: execution.id },
            data: {
              status: ToolExecutionStatus.SUCCEEDED,
              output: outputText,
              progressMessage: 'Tool completed',
              partialOutput: null,
              finishedAt
            }
          });

          this.logger.log('tool_execution_succeeded', this.buildLogContext(context, { toolName: name, toolExecutionId: updatedExecution.id }));
          return {
            execution: updatedExecution,
            outputText
          };
        } catch (error) {
          const category = this.categorizeToolFailure(error);
          const message = error instanceof Error ? error.message : 'Tool execution failed';
          const failedExecution = await this.prisma.toolExecution.update({
            where: { id: execution.id },
            data: {
              status: ToolExecutionStatus.FAILED,
              progressMessage: 'Tool failed',
              partialOutput: null,
              errorMessage: message,
              finishedAt: new Date()
            }
          });

          this.logger.error('tool_execution_failed', this.buildLogContext(context, { toolName: name, toolExecutionId: failedExecution.id, errorCategory: category, errorMessage: message }));
          throw new ToolExecutionError(message, category, failedExecution);
        }
      }
    };
  }

  async executeTool(name: string, input: ToolInput, context: ToolExecutionContext) {
    const started = await this.startToolExecution(name, input, context);
    return started.run();
  }
}
