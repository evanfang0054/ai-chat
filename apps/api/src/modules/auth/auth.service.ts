import { randomBytes, createHash } from 'node:crypto';
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { env } from '../../common/config/env';
import { PrismaService } from '../../common/prisma/prisma.service';
import { hashPassword, verifyPassword } from './password';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('Email already exists');
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: await hashPassword(dto.password)
      }
    });

    return this.createAuthResponse(user.id, user.email, user.role, user.status, user.createdAt);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await verifyPassword(dto.password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    return this.createAuthResponse(user.id, user.email, user.role, user.status, user.createdAt);
  }

  async refresh(refreshToken: string) {
    const tokenHash = this.hashRefreshToken(refreshToken);
    const persistedToken = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: true }
    });

    if (!persistedToken || persistedToken.expiresAt <= new Date()) {
      if (persistedToken) {
        await this.prisma.refreshToken.delete({ where: { id: persistedToken.id } });
      }
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.prisma.refreshToken.delete({ where: { id: persistedToken.id } });

    return this.createAuthResponse(
      persistedToken.user.id,
      persistedToken.user.email,
      persistedToken.user.role,
      persistedToken.user.status,
      persistedToken.user.createdAt
    );
  }

  private async createAuthResponse(
    id: string,
    email: string,
    role: 'ADMIN' | 'USER',
    status: 'ACTIVE' | 'DISABLED',
    createdAt: Date
  ) {
    const accessToken = this.jwtService.sign({ sub: id, email, role });
    const refreshToken = randomBytes(48).toString('hex');
    await this.prisma.refreshToken.create({
      data: {
        tokenHash: this.hashRefreshToken(refreshToken),
        userId: id,
        expiresAt: new Date(Date.now() + env.AUTH_REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000)
      }
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id,
        email,
        role,
        status,
        createdAt: createdAt.toISOString()
      }
    };
  }

  private hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
