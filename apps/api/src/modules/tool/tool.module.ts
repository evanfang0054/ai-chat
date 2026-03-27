import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { ToolService } from './tool.service';

@Module({
  imports: [PrismaModule, forwardRef(() => ScheduleModule)],
  providers: [ToolService],
  exports: [ToolService]
})
export class ToolModule {}
