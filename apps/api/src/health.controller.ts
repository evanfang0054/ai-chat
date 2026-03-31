import { InjectQueue } from '@nestjs/bullmq';
import { Controller, Get } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { PrismaService } from './common/prisma/prisma.service';
import {
  readLatestScheduleTickConsumerInstanceId,
  readScheduleTickStatus,
  SCHEDULE_TICK_QUEUE
} from './common/queue/queue.constants';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(SCHEDULE_TICK_QUEUE) private readonly queue: Queue
  ) {}

  @Get()
  async getHealth() {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);

    return {
      ok: database === 'up' && redis === 'up',
      checks: {
        database,
        redis,
        scheduleTick: readScheduleTickStatus(),
        latestConsumerInstanceId: readLatestScheduleTickConsumerInstanceId()
      }
    };
  }

  private async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }

  private async checkRedis() {
    try {
      const client = await this.queue.client;
      const pong = await client.ping();
      return pong === 'PONG' ? 'up' : 'down';
    } catch {
      return 'down';
    }
  }
}
