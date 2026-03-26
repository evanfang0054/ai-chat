import { Module } from '@nestjs/common';
import { LlmModule } from '../llm/llm.module';
import { RunService } from './run.service';

@Module({
  imports: [LlmModule],
  providers: [RunService],
  exports: [RunService]
})
export class RunModule {}
