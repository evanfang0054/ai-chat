import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import type { ToolDefinition, ToolExecutionContext } from './tool.types';
import { getCurrentTimeTool } from './tools/get-current-time.tool';

type ToolExecutionRecord = {
  id: string;
  sessionId: string | null;
  toolName: string;
  input: string | null;
  output: string | null;
  errorMessage: string | null;
  status: string;
  startedAt: Date;
  finishedAt: Date | null;
};

type ToolExecutionDelegate = {
  create(args: {
    data: {
      sessionId: string;
      toolName: string;
      input: string;
      status: 'RUNNING';
    };
  }): Promise<ToolExecutionRecord>;
  update(args: {
    where: { id: string };
    data: {
      status: 'SUCCEEDED' | 'FAILED';
      output?: string;
      errorMessage?: string;
      finishedAt: Date;
    };
  }): Promise<ToolExecutionRecord>;
};

type ToolExecutionError = Error & { execution: ToolExecutionRecord };

@Injectable()
export class ToolService {
  private readonly tools = new Map<string, ToolDefinition>([[getCurrentTimeTool.name, getCurrentTimeTool]]);

  constructor(private readonly prisma: PrismaService) {}

  listDefinitions() {
    return Array.from(this.tools.values());
  }

  async executeTool(name: string, input: unknown, context: ToolExecutionContext) {
    const tool = this.tools.get(name);

    if (!tool) {
      throw new Error(`Unknown tool: ${name}`);
    }

    const execution = await this.toolExecutions.create({
      data: {
        sessionId: context.sessionId,
        toolName: name,
        input: JSON.stringify(input),
        status: 'RUNNING'
      }
    });

    try {
      const output = await tool.execute(input, context);
      const outputText = JSON.stringify(output);
      const updatedExecution = await this.toolExecutions.update({
        where: { id: execution.id },
        data: {
          status: 'SUCCEEDED',
          output: outputText,
          finishedAt: new Date()
        }
      });

      return {
        execution: updatedExecution,
        outputText
      };
    } catch (error) {
      const failedExecution = await this.toolExecutions.update({
        where: { id: execution.id },
        data: {
          status: 'FAILED',
          errorMessage: error instanceof Error ? error.message : String(error),
          finishedAt: new Date()
        }
      });

      const executionError = new Error(error instanceof Error ? error.message : String(error)) as ToolExecutionError;
      executionError.execution = failedExecution;
      throw executionError;
    }
  }

  private get toolExecutions(): ToolExecutionDelegate {
    return (this.prisma as PrismaService & { toolExecution: ToolExecutionDelegate }).toolExecution;
  }
}
