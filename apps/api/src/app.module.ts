import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthController } from './health.controller';
import { AuthModule } from './modules/auth/auth.module';
import { ChatModule } from './modules/chat/chat.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [PrismaModule, UsersModule, AuthModule, ChatModule],
  controllers: [HealthController]
})
export class AppModule {}
