import { IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import type { ScheduleType } from '@ai-chat/shared';

export class CreateScheduleDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  taskPrompt!: string;

  @IsEnum(['CRON', 'ONE_TIME'])
  type!: ScheduleType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cronExpr?: string;

  @IsOptional()
  @IsISO8601()
  runAt?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  timezone?: string;
}
