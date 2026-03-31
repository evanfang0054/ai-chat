import { resolve } from 'node:path';
import { config } from 'dotenv';
import { z } from 'zod';

for (const path of [
  resolve(process.cwd(), '.env.local'),
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env.local'),
  resolve(process.cwd(), '../../.env')
]) {
  config({ path, override: false, quiet: true });
}

export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  API_PORT: z.coerce.number().default(3000),
  SCHEDULE_TICK_EVERY_MS: z.coerce.number().int().positive().default(30000),
  CHAT_STREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  TOOL_EXECUTION_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  SCHEDULE_RUN_TIMEOUT_MS: z.coerce.number().int().positive().default(180000),
  AUTH_ACCESS_TOKEN_TTL: z.string().min(1).default('7d'),
  AUTH_REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
  DEEPSEEK_API_KEY: z.string().min(1),
  DEEPSEEK_BASE_URL: z.string().url().optional(),
  DEEPSEEK_MODEL: z.string().min(1).default('deepseek-chat')
});

export type Env = z.infer<typeof envSchema>;
export const env = envSchema.parse(process.env);
