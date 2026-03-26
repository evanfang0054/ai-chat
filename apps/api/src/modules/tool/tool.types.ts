export interface ToolExecutionContext {
  sessionId: string;
  userId: string;
}

export interface ToolDefinition<Input = unknown, Output = unknown> {
  name: string;
  description: string;
  execute: (input: Input, context: ToolExecutionContext) => Promise<Output> | Output;
}
