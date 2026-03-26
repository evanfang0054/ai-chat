import { z } from 'zod';
import type { ToolDefinition } from '../tool.types';

export const getCurrentTimeTool: ToolDefinition<{ timezone?: string }> = {
  name: 'get_current_time',
  description: 'Get the current server time in ISO format.',
  schema: z.object({
    timezone: z.string().optional()
  }),
  execute: async () => ({ now: new Date().toISOString() })
};
