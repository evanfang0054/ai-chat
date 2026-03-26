import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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

  private createAuthResponse(
    id: string,
    email: string,
    role: 'ADMIN' | 'USER',
    status: 'ACTIVE' | 'DISABLED',
    createdAt: Date
  ) {
    const accessToken = this.jwtService.sign({ sub: id, email, role });

    return {
      accessToken,
      user: {
        id,
        email,
        role,
        status,
        createdAt: createdAt.toISOString()
      }
    };
  }
}
