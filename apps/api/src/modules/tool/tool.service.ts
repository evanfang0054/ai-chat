import { Injectable } from '@nestjs/common';
import type { Prisma, ToolExecution } from '@prisma/client';
import { ToolExecutionStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ScheduleService } from '../schedule/schedule.service';
import type { ToolDefinition, ToolExecutionContext, ToolInput, ToolMetadata } from './tool.types';
import { getCurrentTimeTool } from './tools/get-current-time.tool';
import { ManageScheduleTool } from './tools/manage-schedule.tool';

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
