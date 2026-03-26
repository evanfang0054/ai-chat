import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { AgentService } from './agent.service';

@Module({
  imports: [LlmModule],
  providers: [AgentService],
  exports: [AgentService]
})
export class AgentModule {}
