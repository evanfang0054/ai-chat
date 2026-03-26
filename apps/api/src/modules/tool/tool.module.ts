import { Module } from '@nestjs/common';
import { PrismaModule } from '../../common/prisma/prisma.module';
import { ToolService } from './tool.service';

@Module({
  imports: [PrismaModule],
  providers: [ToolService],
  exports: [ToolService]
})
export class ToolModule {}
