import { Module, forwardRef } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { ToolModule } from '../tool/tool.module';
import { AgentService } from './agent.service';

@Module({
  imports: [LlmModule, forwardRef(() => ToolModule)],
  providers: [AgentService],
  exports: [AgentService]
})
export class AgentModule {}
