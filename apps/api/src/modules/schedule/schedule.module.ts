import { Module } from '@nestjs/common';

import { QueueModule } from '../../common/queue/queue.module';
import { AgentModule } from '../agent/agent.module';
import { ChatModule } from '../chat/chat.module';
import { ScheduleTickBootstrapService } from './schedule-tick.bootstrap.service';
import { ScheduleTickProcessor } from './schedule-tick.processor';
import { ScheduleController } from './schedule.controller';
import { ScheduleRunnerService } from './schedule-runner.service';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [QueueModule, ChatModule, AgentModule],
  controllers: [ScheduleController],
  providers: [ScheduleService, ScheduleRunnerService, ScheduleTickProcessor, ScheduleTickBootstrapService]
})
export class ScheduleModule {}
