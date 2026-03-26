import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { ToolModule } from '../tool/tool.module';
import { AgentService } from './agent.service';

@Module({
  imports: [LlmModule, ToolModule],
  providers: [AgentService],
  exports: [AgentService]
})
export class AgentModule {}
