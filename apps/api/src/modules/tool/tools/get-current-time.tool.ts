import type { ToolDefinition } from '../tool.types';

export const getCurrentTimeTool: ToolDefinition = {
  name: 'get_current_time',
  description: 'Get the current server time in ISO format.',
  execute: async () => ({ now: new Date().toISOString() })
};
