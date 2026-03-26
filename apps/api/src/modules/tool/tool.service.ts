import { Injectable } from '@nestjs/common';
import type { ToolExecution } from '@prisma/client';
import { ToolExecutionStatus } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { ToolDefinition, ToolExecutionContext, ToolInput, ToolMetadata } from './tool.types';
import { getCurrentTimeTool } from './tools/get-current-time.tool';

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
  private readonly tools = new Map<string, ToolDefinition>([[getCurrentTimeTool.name, getCurrentTimeTool]]);

  constructor(private readonly prisma: PrismaService) {}

  listDefinitions(): ToolMetadata[] {
    return Array.from(this.tools.values(), ({ name, description }) => ({ name, description }));
  }

  async executeTool(name: string, input: ToolInput, context: ToolExecutionContext) {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const execution = await this.prisma.toolExecution.create({
      data: {
        sessionId: context.sessionId,
        toolName: tool.name,
        status: ToolExecutionStatus.RUNNING,
        input
      }
    });

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
}
