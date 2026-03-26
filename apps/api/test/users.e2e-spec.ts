import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';

describe('UsersController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let adminToken = '';
  let userToken = '';

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

    await prisma.user.deleteMany();

    adminToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'admin@example.com', password: 'password123' })
        .expect(201)
    ).body.accessToken;

    await prisma.user.update({
      where: { email: 'admin@example.com' },
      data: { role: 'ADMIN' }
    });

    adminToken = (
      await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: 'admin@example.com', password: 'password123' })
        .expect(200)
    ).body.accessToken;

    userToken = (
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: 'user@example.com', password: 'password123' })
        .expect(201)
    ).body.accessToken;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('GET /users requires auth', async () => {
    await request(app.getHttpServer()).get('/users').expect(401);
  });

  it('GET /users forbids regular user', async () => {
    await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${userToken}`)
      .expect(403);
  });

  it('GET /users allows admin', async () => {
    const response = await request(app.getHttpServer())
      .get('/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);

    expect(response.body).toEqual(expect.any(Array));
    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ email: 'admin@example.com', role: 'ADMIN' }),
        expect.objectContaining({ email: 'user@example.com', role: 'USER' })
      ])
    );
  });
});
