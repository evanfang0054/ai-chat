import { IsBoolean, IsEnum, IsISO8601, IsNotEmpty, IsOptional, IsString } from 'class-validator';

import type { ScheduleType } from '@ai-chat/shared';

export class UpdateScheduleDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  taskPrompt?: string;

  @IsOptional()
  @IsEnum(['CRON', 'ONE_TIME'])
  type?: ScheduleType;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  cronExpr?: string | null;

  @IsOptional()
  @IsISO8601()
  runAt?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  timezone?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
