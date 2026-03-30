import { Injectable } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import type { CreateScheduleRequest, UpdateScheduleRequest } from '@ai-chat/shared';
import { z } from 'zod';
import { ScheduleService } from '../../schedule/schedule.service';
import type { ToolDefinition } from '../tool.types';

const manageScheduleInputSchema = z.object({
  action: z.enum(['create', 'list', 'update', 'enable', 'disable']),
  scheduleId: z.string().min(1).optional().describe('Existing schedule id. Required for update, enable, and disable.'),
  title: z.string().min(1).optional().describe('Short schedule title. For create, infer a concise title from the user request when not explicitly given.'),
  taskPrompt: z.string().min(1).optional().describe('The task that should run when the schedule fires. Copy the user intent here.'),
  type: z.enum(['CRON', 'ONE_TIME']).optional().describe('Schedule type. Use CRON for recurring schedules and ONE_TIME for a single future run.'),
  cronExpr: z.string().min(1).optional().describe('Cron expression for recurring schedules. Infer it from phrases like every 10 seconds or every day at 9am.'),
  runAt: z.string().min(1).optional().describe('ISO-8601 datetime for one-time schedules.'),
  timezone: z.string().min(1).optional().describe('IANA timezone such as UTC. Default to UTC when the user does not specify one.'),
  enabled: z.boolean().optional().describe('Optional enabled filter for list, or enabled flag for update.')
});

type ManageScheduleToolInput = z.infer<typeof manageScheduleInputSchema>;

function validateManageScheduleInput(input: ManageScheduleToolInput) {
  switch (input.action) {
    case 'create':
      if (!input.title || !input.taskPrompt || !input.type) {
        throw new Error('create action requires title, taskPrompt, and type');
      }
      if (input.type === 'CRON' && !input.cronExpr) {
        throw new Error('create CRON action requires cronExpr');
      }
      if (input.type === 'ONE_TIME' && !input.runAt) {
        throw new Error('create ONE_TIME action requires runAt');
      }
      return input as ManageScheduleToolInput & {
        action: 'create';
        title: string;
        taskPrompt: string;
        type: 'CRON' | 'ONE_TIME';
        cronExpr?: string;
        runAt?: string;
      };
    case 'list':
      return input;
    case 'update':
      if (!input.scheduleId) {
        throw new Error('update action requires scheduleId');
      }
      return input as ManageScheduleToolInput & { action: 'update'; scheduleId: string };
    case 'enable':
    case 'disable':
      if (!input.scheduleId) {
        throw new Error(`${input.action} action requires scheduleId`);
      }
      return input as ManageScheduleToolInput & {
        action: 'enable' | 'disable';
        scheduleId: string;
      };
  }
}

@Injectable()
export class ManageScheduleToolFactory {
  constructor(private readonly moduleRef: ModuleRef) {}

  create(): ToolDefinition {
    return {
      name: 'manage_schedule',
      description:
        'Create, list, update, enable, or disable schedules for the current user. Use UTC by default when timezone is omitted.',
      schema: manageScheduleInputSchema,
      execute: async (rawInput, context) => {
        const parsedInput = manageScheduleInputSchema.parse(rawInput);
        const input = validateManageScheduleInput(parsedInput);
        const scheduleService = this.moduleRef.get(ScheduleService, { strict: false });

        if (!scheduleService) {
          throw new Error('ScheduleService is unavailable');
        }

        switch (input.action) {
          case 'create': {
            const title = input.title!;
            const taskPrompt = input.taskPrompt!;
            const request: CreateScheduleRequest =
              input.type === 'CRON'
                ? {
                    title,
                    taskPrompt,
                    type: 'CRON',
                    cronExpr: input.cronExpr!,
                    timezone: input.timezone
                  }
                : {
                    title,
                    taskPrompt,
                    type: 'ONE_TIME',
                    runAt: input.runAt!,
                    timezone: input.timezone
                  };

            return {
              action: 'create',
              schedule: await scheduleService.createSchedule(context.userId, request)
            };
          }
          case 'list':
            return {
              action: 'list',
              ...(await scheduleService.listSchedules(context.userId, {
                enabled: input.enabled,
                type: input.type
              }))
            };
          case 'update': {
            const scheduleId = input.scheduleId!;
            const baseRequest = {
              title: input.title,
              taskPrompt: input.taskPrompt,
              timezone: input.timezone,
              enabled: input.enabled
            };

            const request: UpdateScheduleRequest =
              input.type === 'CRON'
                ? {
                    ...baseRequest,
                    type: 'CRON',
                    ...(input.cronExpr !== undefined ? { cronExpr: input.cronExpr } : {})
                  }
                : input.type === 'ONE_TIME'
                  ? {
                      ...baseRequest,
                      type: 'ONE_TIME',
                      ...(input.runAt !== undefined ? { runAt: input.runAt } : {})
                    }
                  : {
                      ...baseRequest,
                      cronExpr: input.cronExpr,
                      runAt: input.runAt
                    };

            return {
              action: 'update',
              schedule: await scheduleService.updateSchedule(context.userId, scheduleId, request)
            };
          }
          case 'enable': {
            const scheduleId = input.scheduleId!;
            return {
              action: 'enable',
              schedule: await scheduleService.enableSchedule(context.userId, scheduleId)
            };
          }
          case 'disable': {
            const scheduleId = input.scheduleId!;
            return {
              action: 'disable',
              schedule: await scheduleService.disableSchedule(context.userId, scheduleId)
            };
          }
        }
      }
    };
  }
}
