import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  const cleanupAuthData = async () => {
    try {
      await prisma.$executeRawUnsafe('DELETE FROM "RefreshToken"');
    } catch {
      // RefreshToken table is added later in this TDD cycle.
    }
    await prisma.user.deleteMany();
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_chat';
    process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'change-me';
    process.env.DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'test-key';
    process.env.DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com';
    process.env.DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat';
    prisma = new PrismaClient();

    const { AppModule } = await import('../src/app.module');

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await cleanupAuthData();
  });

  beforeEach(async () => {
    await cleanupAuthData();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('POST /auth/register creates a user and refresh token', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'user1@example.com', password: 'password123' })
      .expect(201);

    expect(response.body.user.email).toBe('user1@example.com');
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
  });

  it('POST /auth/login returns access and refresh token', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'user2@example.com', password: 'password123' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'user2@example.com', password: 'password123' })
      .expect(200);

    expect(response.body.user.email).toBe('user2@example.com');
    expect(response.body.accessToken).toEqual(expect.any(String));
    expect(response.body.refreshToken).toEqual(expect.any(String));
  });

  it('POST /auth/refresh rotates refresh token', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'refresh@example.com', password: 'password123' })
      .expect(201);

    const refreshResponse = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: registerResponse.body.refreshToken })
      .expect(200);

    expect(refreshResponse.body.accessToken).toEqual(expect.any(String));
    expect(refreshResponse.body.refreshToken).toEqual(expect.any(String));
    expect(refreshResponse.body.refreshToken).not.toBe(registerResponse.body.refreshToken);

    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refreshToken: registerResponse.body.refreshToken })
      .expect(401);
  });

  it('GET /auth/me returns current user', async () => {
    const registerResponse = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'me@example.com', password: 'password123' })
      .expect(201);

    const response = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${registerResponse.body.accessToken}`)
      .expect(200);

    expect(response.body.email).toBe('me@example.com');
    expect(response.body.role).toBe('USER');
  });
});
