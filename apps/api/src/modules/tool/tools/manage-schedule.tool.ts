import { z } from 'zod';
import type { CreateScheduleRequest, UpdateScheduleRequest } from '@ai-chat/shared';

import { ScheduleService } from '../../schedule/schedule.service';
import type { ToolDefinition } from '../tool.types';

const manageScheduleToolSchema = z.object({
  action: z.enum(['create', 'list', 'update', 'delete', 'enable', 'disable']),
  scheduleId: z.string().trim().min(1).nullable(),
  title: z.string().trim().min(1).nullable(),
  taskPrompt: z.string().trim().min(1).nullable(),
  type: z.enum(['CRON', 'ONE_TIME']).nullable(),
  cronExpr: z.string().trim().min(1).nullable(),
  runAt: z.string().datetime({ offset: true }).nullable(),
  timezone: z.string().trim().min(1).nullable(),
  enabled: z.boolean().nullable()
});

export type ManageScheduleToolInput = z.infer<typeof manageScheduleToolSchema>;

function requireString(value: string | null, field: string) {
  if (!value) {
    throw new Error(`${field} is required`);
  }

  return value;
}

function requireType(value: 'CRON' | 'ONE_TIME' | null) {
  if (!value) {
    throw new Error('type is required');
  }

  return value;
}

function toCreateRequest(input: ManageScheduleToolInput): CreateScheduleRequest {
  const type = requireType(input.type);

  if (type === 'CRON') {
    return {
      title: requireString(input.title, 'title'),
      taskPrompt: requireString(input.taskPrompt, 'taskPrompt'),
      type: 'CRON',
      cronExpr: requireString(input.cronExpr, 'cronExpr'),
      timezone: input.timezone ?? undefined
    };
  }

  return {
    title: requireString(input.title, 'title'),
    taskPrompt: requireString(input.taskPrompt, 'taskPrompt'),
    type: 'ONE_TIME',
    runAt: requireString(input.runAt, 'runAt'),
    timezone: input.timezone ?? undefined
  };
}

function toUpdateRequest(input: ManageScheduleToolInput): UpdateScheduleRequest {
  const type = input.type;

  if (type === 'CRON') {
    return {
      title: input.title ?? undefined,
      taskPrompt: input.taskPrompt ?? undefined,
      type: 'CRON',
      cronExpr: requireString(input.cronExpr, 'cronExpr'),
      timezone: input.timezone ?? undefined,
      enabled: input.enabled ?? undefined
    };
  }

  if (type === 'ONE_TIME') {
    return {
      title: input.title ?? undefined,
      taskPrompt: input.taskPrompt ?? undefined,
      type: 'ONE_TIME',
      runAt: requireString(input.runAt, 'runAt'),
      timezone: input.timezone ?? undefined,
      enabled: input.enabled ?? undefined
    };
  }

  return {
    title: input.title ?? undefined,
    taskPrompt: input.taskPrompt ?? undefined,
    cronExpr: input.cronExpr ?? undefined,
    runAt: input.runAt ?? undefined,
    timezone: input.timezone ?? undefined,
    enabled: input.enabled ?? undefined
  };
}

export class ManageScheduleTool implements ToolDefinition<ManageScheduleToolInput> {
  readonly name = 'manage_schedule' as const;
  readonly description =
    'Manage the current user\'s schedules. Use this tool to create, list, update, enable, disable, or delete schedules.';
  readonly schema = manageScheduleToolSchema;

  constructor(private readonly scheduleService: ScheduleService) {}

  async execute(input: ManageScheduleToolInput, context: { userId: string }) {
    if (input.action === 'create') {
      return this.scheduleService.createSchedule(context.userId, toCreateRequest(input));
    }

    if (input.action === 'list') {
      return this.scheduleService.listSchedules(context.userId, {
        enabled: input.enabled ?? undefined,
        type: input.type ?? undefined
      });
    }

    if (input.action === 'update') {
      return this.scheduleService.updateSchedule(
        context.userId,
        requireString(input.scheduleId, 'scheduleId'),
        toUpdateRequest(input)
      );
    }

    if (input.action === 'delete') {
      const scheduleId = requireString(input.scheduleId, 'scheduleId');
      await this.scheduleService.deleteSchedule(context.userId, scheduleId);
      return { deletedScheduleId: scheduleId };
    }

    if (input.action === 'enable') {
      return this.scheduleService.enableSchedule(context.userId, requireString(input.scheduleId, 'scheduleId'));
    }

    return this.scheduleService.disableSchedule(context.userId, requireString(input.scheduleId, 'scheduleId'));
  }
}
