import { z } from 'zod';
import type { ToolDefinition } from '../tool.types';

export const getCurrentTimeTool: ToolDefinition<{ timezone: string | null }> = {
  name: 'get_current_time',
  description: 'Get the current server time in ISO format.',
  schema: z.object({
    timezone: z.string().nullable()
  }),
  execute: async () => ({ now: new Date().toISOString() })
};
