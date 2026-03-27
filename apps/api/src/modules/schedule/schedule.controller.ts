import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import type { CreateScheduleRequest, ScheduleRunStatus, ScheduleType, UpdateScheduleRequest } from '@ai-chat/shared';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import type { CurrentUser as CurrentUserPayload } from '../chat/chat.types';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { UpdateScheduleDto } from './dto/update-schedule.dto';
import { ScheduleService } from './schedule.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post('schedules')
  createSchedule(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateScheduleDto) {
    return this.scheduleService.createSchedule(user.userId, dto as CreateScheduleRequest);
  }

  @Get('schedules')
  listSchedules(
    @CurrentUser() user: CurrentUserPayload,
    @Query('enabled') enabled?: 'true' | 'false',
    @Query('type') type?: ScheduleType
  ) {
    return this.scheduleService.listSchedules(user.userId, {
      enabled: enabled === undefined ? undefined : enabled === 'true',
      type
    });
  }

  @Patch('schedules/:id')
  updateSchedule(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() dto: UpdateScheduleDto) {
    return this.scheduleService.updateSchedule(user.userId, id, dto as UpdateScheduleRequest);
  }

  @Post('schedules/:id/enable')
  enableSchedule(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.scheduleService.enableSchedule(user.userId, id);
  }

  @Post('schedules/:id/disable')
  disableSchedule(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return this.scheduleService.disableSchedule(user.userId, id);
  }

  @Get('runs')
  listRuns(
    @CurrentUser() user: CurrentUserPayload,
    @Query('scheduleId') scheduleId?: string,
    @Query('status') status?: ScheduleRunStatus
  ) {
    return this.scheduleService.listRuns(user.userId, {
      scheduleId,
      status
    });
  }

  @Get('runs/:id')
  async getRun(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
    return {
      run: await this.scheduleService.getRunOrThrow(user.userId, id)
    };
  }
}
