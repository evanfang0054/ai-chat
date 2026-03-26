import type { z } from 'zod';

export interface ToolExecutionContext {
  sessionId: string;
  userId: string;
}

export interface ToolMetadata {
  name: string;
  description: string;
}

export type ToolInput = Record<string, unknown>;

export interface ToolDefinition<Input extends ToolInput = ToolInput, Output = unknown>
  extends ToolMetadata {
  schema: z.ZodType<Input>;
  execute: (input: Input, context: ToolExecutionContext) => Promise<Output> | Output;
}
