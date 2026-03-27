import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { QueueModule } from './common/queue/queue.module';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { ScheduleModule } from './modules/schedule/schedule.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [PrismaModule, QueueModule, UsersModule, AuthModule, ChatModule, ScheduleModule],
  controllers: [HealthController]
})
export class AppModule {}
