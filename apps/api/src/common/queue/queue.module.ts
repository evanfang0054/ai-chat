import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';

import { env } from '../config/env';
import { SCHEDULE_TICK_QUEUE } from './queue.constants';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        url: env.REDIS_URL
      }
    }),
    BullModule.registerQueue({
      name: SCHEDULE_TICK_QUEUE
    })
  ],
  exports: [BullModule]
})
export class QueueModule {}
