import type { FailureCategory } from '@ai-chat/shared';
import type { z } from 'zod';

export type ToolFailureCategory = FailureCategory;

export interface ToolFailureDetails {
  category: ToolFailureCategory;
  message: string;
}

export interface ToolExecutionContext {
  sessionId: string;
  userId: string;
  scheduleId?: string;
  runId?: string;
  messageId?: string;
  requestId?: string;
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
