import { randomUUID } from 'node:crypto';
import type { RunTriggerSource } from '@ai-chat/shared';
import type { ExecutionIntent, ExecutionRequest, ForcedToolCall, IntentRouteResult } from './agent.types';

const AGENT_SYSTEM_PROMPT = `You are a tool-using assistant inside an AI chat product.

Rules:
- If the user asks you to perform an action that matches an available tool, call the tool instead of asking a follow-up question.
- If a schedule or time request can be completed with a reasonable default timezone, use UTC by default.
- Do not ask the user for timezone before creating a schedule unless timezone is explicitly required to avoid an incorrect result.
- When the user asks to create, update, list, enable, disable, or delete schedules, prefer using manage_schedule.
- For schedule creation requests written in natural language, infer the structured manage_schedule arguments yourself whenever a reasonable default exists.
- When creating schedules, translate phrases like "every 10 seconds", "every minute", or "tomorrow at 9am" into manage_schedule fields such as type, cronExpr, intervalMs, runAt, title, taskPrompt, and timezone.
- For "every X seconds" or "every X minutes" (where X < 60), use type=INTERVAL with intervalMs (in milliseconds). For example: "every 10 seconds" = type=INTERVAL, intervalMs=10000.
- For standard cron patterns like "every hour", "daily at 9am", use type=CRON with cronExpr.
- For one-time schedules like "tomorrow at 9am", use type=ONE_TIME with runAt.
- If the user describes the task to run, copy that instruction into taskPrompt and create a short title instead of asking for one.
- Before deleting a schedule, require an explicit user confirmation in natural language unless the user has already clearly confirmed that exact deletion request.
- If the user wants to update, enable, disable, or delete a schedule but the target schedule is ambiguous, prefer calling manage_schedule with action="list" first or ask a disambiguation question instead of guessing.
- When the user asks for the current time, prefer using get_current_time.
- After a tool succeeds, briefly confirm the result in natural language.
- Only ask a follow-up question when a required tool argument cannot be inferred and no safe default exists.`;

const FORCE_GET_CURRENT_TIME_PATTERNS = [/\bget_current_time\b/i, /当前时间/i, /current time/i];

function inferForcedToolCall(prompt: string): ForcedToolCall | undefined {
  if (!FORCE_GET_CURRENT_TIME_PATTERNS.some((pattern) => pattern.test(prompt))) {
    return undefined;
  }

  return {
    name: 'get_current_time',
    input: { timezone: 'UTC' }
  };
}

function resolveIntent(triggerSource: RunTriggerSource): ExecutionIntent {
  if (triggerSource === 'SCHEDULE') {
    return 'schedule';
  }
  if (triggerSource === 'MANUAL_RETRY') {
    return 'manual_retry';
  }
  if (triggerSource === 'DIAGNOSTICS_REPLAY') {
    return 'diagnostics_replay';
  }
  return 'chat';
}

function resolveMaxIterations(intent: ExecutionIntent, forcedToolCall?: ForcedToolCall) {
  if (forcedToolCall) {
    return 1;
  }

  if (intent === 'schedule' || intent === 'manual_retry') {
    return 4;
  }

  return 3;
}

export function routeExecutionIntent(request: ExecutionRequest): IntentRouteResult {
  const intent = request.intent ?? resolveIntent(request.triggerSource);
  const forcedToolCall = request.forcedToolCall ?? inferForcedToolCall(request.prompt);

  return {
    intent,
    systemPrompt: AGENT_SYSTEM_PROMPT,
    forcedToolCall,
    maxIterations: resolveMaxIterations(intent, forcedToolCall),
    diagnostics: {
      requestId: request.requestId ?? randomUUID(),
      sessionId: request.sessionId,
      runId: request.runId ?? null,
      messageId: request.messageId ?? null,
      triggerSource: request.triggerSource
    }
  };
}
