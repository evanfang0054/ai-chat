import { Test } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AuthController (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaClient;

  beforeAll(async () => {
    process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ai_chat';
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'change-me';
    prisma = new PrismaClient();

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule]
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('POST /auth/register creates a user', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'user1@example.com', password: 'password123' })
      .expect(201);

    expect(response.body.user.email).toBe('user1@example.com');
    expect(response.body.accessToken).toEqual(expect.any(String));
  });

  it('POST /auth/login returns access token', async () => {
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
