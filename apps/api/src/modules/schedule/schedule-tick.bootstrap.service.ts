import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Queue } from 'bullmq';

import { env } from '../../common/config/env';
import {
  SCHEDULE_TICK_INSTANCE,
  SCHEDULE_TICK_JOB,
  SCHEDULE_TICK_JOB_ID,
  SCHEDULE_TICK_QUEUE
} from '../../common/queue/queue.constants';

@Injectable()
export class ScheduleTickBootstrapService implements OnModuleInit {
  private readonly logger = new Logger(ScheduleTickBootstrapService.name);

  constructor(@InjectQueue(SCHEDULE_TICK_QUEUE) private readonly queue: Queue) {}

  async onModuleInit() {
    this.logger.log('schedule_tick_bootstrap_started', {
      instanceId: SCHEDULE_TICK_INSTANCE,
      queueName: SCHEDULE_TICK_QUEUE
    });

    if (process.env.ENABLE_SCHEDULE_TICK !== 'true') {
      this.logger.debug('Skip schedule tick bootstrap because ENABLE_SCHEDULE_TICK is not true', {
        instanceId: SCHEDULE_TICK_INSTANCE,
        queueName: SCHEDULE_TICK_QUEUE
      });
      return;
    }

    const everyMs = Number(process.env.SCHEDULE_TICK_EVERY_MS ?? env.SCHEDULE_TICK_EVERY_MS);

    await this.queue.upsertJobScheduler(
      SCHEDULE_TICK_JOB_ID,
      {
        every: everyMs
      },
      {
        name: SCHEDULE_TICK_JOB,
        opts: {}
      }
    );

    this.logger.log('schedule_tick_bootstrap_ready', {
      instanceId: SCHEDULE_TICK_INSTANCE,
      queueName: SCHEDULE_TICK_QUEUE,
      everyMs,
      note: 'Tick may be consumed by another API instance if Redis is shared.'
    });
  }
}
