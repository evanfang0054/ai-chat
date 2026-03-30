import { Injectable } from '@nestjs/common';
import type { Prisma, ToolExecution } from '@prisma/client';
import { ToolExecutionStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ManageScheduleToolFactory } from './tools/manage-schedule.tool';
import { getCurrentTimeTool } from './tools/get-current-time.tool';
import type { ToolDefinition, ToolExecutionContext, ToolInput, ToolMetadata } from './tool.types';

class ToolExecutionError extends Error {
  constructor(
    message: string,
    public readonly execution: ToolExecution
  ) {
    super(message);
  }
}

@Injectable()
export class ToolService {
  private readonly tools: Map<string, ToolDefinition>;

  constructor(
    private readonly prisma: PrismaService,
    manageScheduleToolFactory: ManageScheduleToolFactory
  ) {
    this.tools = new Map<string, ToolDefinition>([
      [getCurrentTimeTool.name, getCurrentTimeTool],
      ['manage_schedule', manageScheduleToolFactory.create()]
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

  async startToolExecution(name: string, input: ToolInput, context: ToolExecutionContext) {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const execution = await this.prisma.toolExecution.create({
      data: {
        sessionId: context.sessionId,
        toolName: tool.name,
        status: ToolExecutionStatus.RUNNING,
        input: this.toJsonValue(input)
      }
    });

    return {
      execution,
      run: async () => {
        try {
          const output = await tool.execute(input, context);
          const outputText = JSON.stringify(output);
          const finishedAt = new Date();
          const updatedExecution = await this.prisma.toolExecution.update({
            where: { id: execution.id },
            data: {
              status: ToolExecutionStatus.SUCCEEDED,
              output: outputText,
              finishedAt
            }
          });

          return { execution: updatedExecution, outputText };
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Tool execution failed';
          const failedExecution = await this.prisma.toolExecution.update({
            where: { id: execution.id },
            data: {
              status: ToolExecutionStatus.FAILED,
              errorMessage: message,
              finishedAt: new Date()
            }
          });

          throw new ToolExecutionError(message, failedExecution);
        }
      }
    };
  }

  async executeTool(name: string, input: ToolInput, context: ToolExecutionContext) {
    const started = await this.startToolExecution(name, input, context);
    return started.run();
  }
}
