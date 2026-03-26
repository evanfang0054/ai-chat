import type { ToolDefinition } from '../tool.types';

export const getCurrentTimeTool: ToolDefinition<unknown, { now: string }> = {
  name: 'get_current_time',
  description: 'Get the current server time in ISO format.',
  execute() {
    return {
      now: new Date().toISOString()
    };
  }
};
