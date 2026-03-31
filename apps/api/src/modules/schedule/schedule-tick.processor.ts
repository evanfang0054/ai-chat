import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';

import {
  markScheduleTickHeartbeat,
  SCHEDULE_TICK_INSTANCE,
  SCHEDULE_TICK_JOB,
  SCHEDULE_TICK_QUEUE
} from '../../common/queue/queue.constants';
import { ScheduleRunnerService } from './schedule-runner.service';

@Injectable()
@Processor(SCHEDULE_TICK_QUEUE)
export class ScheduleTickProcessor extends WorkerHost {
  private readonly logger = new Logger(ScheduleTickProcessor.name);

  constructor(private readonly scheduleRunnerService: ScheduleRunnerService) {
    super();
  }

  async process(job: Job): Promise<void> {
    if (job.name !== SCHEDULE_TICK_JOB) {
      this.logger.warn('schedule_tick_unexpected_job', {
        instanceId: SCHEDULE_TICK_INSTANCE,
        queueName: SCHEDULE_TICK_QUEUE,
        jobName: job.name
      });
      return;
    }

    markScheduleTickHeartbeat(new Date(), SCHEDULE_TICK_INSTANCE);
    this.logger.debug('schedule_tick_started', {
      instanceId: SCHEDULE_TICK_INSTANCE,
      queueName: SCHEDULE_TICK_QUEUE,
      jobId: job.id
    });
    await this.scheduleRunnerService.processDueSchedules(new Date());
    this.logger.debug('schedule_tick_completed', {
      instanceId: SCHEDULE_TICK_INSTANCE,
      queueName: SCHEDULE_TICK_QUEUE,
      jobId: job.id
    });
  }

  @OnWorkerEvent('error')
  onError(error: Error) {
    if (error.message === 'Connection is closed.') {
      this.logger.debug('Ignore BullMQ worker shutdown error after Redis connection closes');
      return;
    }

    this.logger.error(error.message, error.stack);
  }
}
