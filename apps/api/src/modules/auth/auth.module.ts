import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { env } from '../../common/config/env';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'change-me',
      signOptions: { expiresIn: env.AUTH_ACCESS_TOKEN_TTL as never }
    })
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService]
})
export class AuthModule {}
