# Schedule MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为现有 AI chat 平台增加最小可用的 Schedule MVP，让用户创建未来要执行的 AI 任务，并由系统按 `CRON` 或 `ONE_TIME` 自动触发、记录 run 历史并在 Web 端查看。

**Architecture:** 保持现有 `chat -> agent -> llm/tool` 主链不变，在 API 中新增 `schedule` 模块作为时间触发入口、资源归属校验和 run 持久化边界。调度器仅负责扫描到期 schedule、原子领取并桥接到现有 chat/agent 服务；前端新增 `/schedules` 与 `/runs` 页面，继续沿用当前 `pages + services + stores + components` 分层，不引入实时 run 页面。

**Tech Stack:** NestJS, Prisma, PostgreSQL, React, Vite, Zustand, TypeScript, Jest, Vitest

---

## File Structure Map

### Shared contracts
- Create: `packages/shared/src/schedule.ts` — schedule、run、列表响应、创建/更新请求契约
- Modify: `packages/shared/src/index.ts` — 导出 schedule 契约

### Database
- Modify: `apps/api/prisma/schema.prisma` — 新增 `ScheduleType`、`ScheduleRunStatus`、`Schedule`、`ScheduleRun`
- Create: `apps/api/prisma/migrations/<timestamp>_add_schedule_tables/migration.sql` — schedule 持久化表结构

### API schedule module
- Create: `apps/api/src/modules/schedule/dto/create-schedule.dto.ts` — 创建入参校验
- Create: `apps/api/src/modules/schedule/dto/update-schedule.dto.ts` — 更新入参校验
- Create: `apps/api/src/modules/schedule/schedule.types.ts` — 调度内部类型与筛选参数
- Create: `apps/api/src/modules/schedule/schedule.utils.ts` — `nextRunAt` 计算、字段组合校验、摘要构造
- Create: `apps/api/src/modules/schedule/schedule.service.ts` — schedule CRUD、enable/disable、run 查询、owner 校验
- Create: `apps/api/src/modules/schedule/schedule-runner.service.ts` — 到期 schedule 扫描、run 创建、桥接执行链
- Create: `apps/api/src/modules/schedule/schedule.controller.ts` — `/schedules`、`/runs` 接口
- Create: `apps/api/src/modules/schedule/schedule.module.ts` — 组装依赖并导出服务
- Modify: `apps/api/src/app.module.ts` — 接入 `ScheduleModule`
- Modify: `apps/api/src/modules/chat/chat.service.ts` — 抽出可复用的内部 session/message 创建能力
- Create: `apps/api/src/modules/schedule/schedule.service.spec.ts` — service 单测
- Create: `apps/api/src/modules/schedule/schedule-runner.service.spec.ts` — 调度执行单测
- Create: `apps/api/test/schedule.e2e-spec.ts` — schedule / runs e2e

### Web
- Create: `apps/web/src/services/schedule.ts` — schedule / runs API 调用
- Create: `apps/web/src/pages/schedules/SchedulesPage.tsx` — schedule 列表 + 表单 + enable/disable
- Create: `apps/web/src/pages/runs/RunsPage.tsx` — run 列表 + 筛选 + 跳聊天
- Create: `apps/web/src/components/schedules/ScheduleForm.tsx` — 创建/编辑表单
- Create: `apps/web/src/components/schedules/ScheduleList.tsx` — schedule 列表
- Create: `apps/web/src/components/runs/RunList.tsx` — run 列表
- Modify: `apps/web/src/router/index.tsx` — 挂载 `/schedules` 与 `/runs`
- Modify: `apps/web/src/components/chat/SessionSidebar.tsx` — 增加导航入口
- Create: `apps/web/src/__tests__/schedule-service.test.ts` — schedule service 测试
- Create: `apps/web/src/__tests__/schedules-page.test.tsx` — `/schedules` 页面测试
- Create: `apps/web/src/__tests__/runs-page.test.tsx` — `/runs` 页面测试

---

### Task 1: 定义 shared schedule 契约

**Files:**
- Create: `packages/shared/src/schedule.ts`
- Modify: `packages/shared/src/index.ts`
- Test: `pnpm --filter @ai-chat/shared exec tsc --noEmit`

- [ ] **Step 1: 先写共享类型契约**

```ts
export type ScheduleType = 'CRON' | 'ONE_TIME';
export type ScheduleRunStatus = 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';

export interface ScheduleSummary {
  id: string;
  title: string;
  taskPrompt: string;
  type: ScheduleType;
  cronExpr: string | null;
  runAt: string | null;
  timezone: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleRunSummary {
  id: string;
  scheduleId: string;
  userId: string;
  status: ScheduleRunStatus;
  taskPromptSnapshot: string;
  resultSummary: string | null;
  errorMessage: string | null;
  chatSessionId: string | null;
  startedAt: string;
  finishedAt: string | null;
  createdAt: string;
  schedule: {
    id: string;
    title: string;
    type: ScheduleType;
  };
}
```

- [ ] **Step 2: 补创建/更新/查询响应类型**

```ts
export interface CreateScheduleRequest {
  title: string;
  taskPrompt: string;
  type: ScheduleType;
  cronExpr?: string;
  runAt?: string;
  timezone?: string;
}

export interface UpdateScheduleRequest {
  title?: string;
  taskPrompt?: string;
  type?: ScheduleType;
  cronExpr?: string | null;
  runAt?: string | null;
  timezone?: string;
  enabled?: boolean;
}

export interface ListSchedulesResponse {
  schedules: ScheduleSummary[];
}

export interface ListScheduleRunsResponse {
  runs: ScheduleRunSummary[];
}

export interface GetScheduleRunResponse {
  run: ScheduleRunSummary;
}
```

- [ ] **Step 3: 导出 schedule 契约**

```ts
export * from './auth';
export * from './user';
export * from './chat';
export * from './tool';
export * from './schedule';
```

- [ ] **Step 4: 跑 shared 类型检查**

Run: `pnpm --filter @ai-chat/shared exec tsc --noEmit`
Expected: 命令退出码为 0，无类型错误

- [ ] **Step 5: 提交 shared 契约变更**

```bash
git add packages/shared/src/schedule.ts packages/shared/src/index.ts
git commit -m "feat: add schedule shared contracts"
```

---

### Task 2: 新增 Schedule 与 ScheduleRun 数据模型

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_schedule_tables/migration.sql`
- Test: `pnpm --filter @ai-chat/api db:generate`

- [ ] **Step 1: 在 Prisma schema 中加枚举和关系**

```prisma
enum ScheduleType {
  CRON
  ONE_TIME
}

enum ScheduleRunStatus {
  PENDING
  RUNNING
  SUCCEEDED
  FAILED
}
```

并在 `User` 中增加：

```prisma
schedules    Schedule[]
scheduleRuns ScheduleRun[]
```

- [ ] **Step 2: 定义 Schedule 模型**

```prisma
model Schedule {
  id         String       @id @default(cuid())
  userId     String
  title      String
  taskPrompt String
  type       ScheduleType
  cronExpr   String?
  runAt      DateTime?
  timezone   String       @default("UTC")
  enabled    Boolean      @default(true)
  lastRunAt  DateTime?
  nextRunAt  DateTime?
  createdAt  DateTime     @default(now())
  updatedAt  DateTime     @updatedAt
  user       User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  runs       ScheduleRun[]

  @@index([userId, createdAt])
  @@index([enabled, nextRunAt])
}
```

- [ ] **Step 3: 定义 ScheduleRun 模型**

```prisma
model ScheduleRun {
  id                 String            @id @default(cuid())
  scheduleId         String
  userId             String
  status             ScheduleRunStatus @default(PENDING)
  taskPromptSnapshot String
  resultSummary      String?
  errorMessage       String?
  chatSessionId      String?
  startedAt          DateTime
  finishedAt         DateTime?
  createdAt          DateTime          @default(now())
  schedule           Schedule          @relation(fields: [scheduleId], references: [id], onDelete: Cascade)
  user               User              @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, createdAt])
  @@index([scheduleId, createdAt])
  @@index([status, createdAt])
}
```

- [ ] **Step 4: 生成 migration 并更新 Prisma Client**

Run: `pnpm --filter @ai-chat/api db:migrate --name add_schedule_tables && pnpm --filter @ai-chat/api db:generate`
Expected: 生成 migration 目录，Prisma Client 更新成功

- [ ] **Step 5: 提交数据库模型变更**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/prisma
git commit -m "feat: add schedule persistence models"
```

---

### Task 3: 写 schedule 领域工具函数与 DTO 校验

**Files:**
- Create: `apps/api/src/modules/schedule/dto/create-schedule.dto.ts`
- Create: `apps/api/src/modules/schedule/dto/update-schedule.dto.ts`
- Create: `apps/api/src/modules/schedule/schedule.types.ts`
- Create: `apps/api/src/modules/schedule/schedule.utils.ts`
- Test: `apps/api/src/modules/schedule/schedule.service.spec.ts`

- [ ] **Step 1: 先写工具函数测试，固定字段组合规则**

```ts
it('accepts one-time with runAt only', () => {
  expect(() => validateScheduleInput({ type: 'ONE_TIME', runAt: new Date().toISOString() })).not.toThrow();
});

it('rejects cron without cronExpr', () => {
  expect(() => validateScheduleInput({ type: 'CRON' })).toThrow('cronExpr is required for CRON schedules');
});
```

- [ ] **Step 2: 写最小工具函数实现**

```ts
export function validateScheduleInput(input: {
  type: 'CRON' | 'ONE_TIME';
  cronExpr?: string | null;
  runAt?: string | null;
}) {
  if (input.type === 'ONE_TIME') {
    if (!input.runAt) {
      throw new BadRequestException('runAt is required for ONE_TIME schedules');
    }
    if (input.cronExpr) {
      throw new BadRequestException('cronExpr is not allowed for ONE_TIME schedules');
    }
  }

  if (input.type === 'CRON') {
    if (!input.cronExpr) {
      throw new BadRequestException('cronExpr is required for CRON schedules');
    }
    if (input.runAt) {
      throw new BadRequestException('runAt is not allowed for CRON schedules');
    }
  }
}
```

- [ ] **Step 3: 写 nextRunAt 计算边界**

```ts
export function computeNextRunAt(input: {
  type: 'CRON' | 'ONE_TIME';
  cronExpr?: string | null;
  runAt?: string | null;
  timezone: string;
  now?: Date;
}) {
  if (input.type === 'ONE_TIME') {
    return input.runAt ? new Date(input.runAt) : null;
  }

  const interval = cronParser.parseExpression(input.cronExpr!, {
    currentDate: input.now ?? new Date(),
    tz: input.timezone
  });

  return interval.next().toDate();
}
```

- [ ] **Step 4: 定义 DTO 和筛选类型**

```ts
export class CreateScheduleDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  taskPrompt!: string;

  @IsEnum(['CRON', 'ONE_TIME'])
  type!: 'CRON' | 'ONE_TIME';

  @IsOptional()
  @IsString()
  cronExpr?: string;

  @IsOptional()
  @IsISO8601()
  runAt?: string;

  @IsOptional()
  @IsString()
  timezone?: string;
}
```

- [ ] **Step 5: 跑单测验证工具函数与 DTO**

Run: `pnpm --filter @ai-chat/api test -- schedule.service.spec.ts`
Expected: schedule 工具函数相关测试通过

- [ ] **Step 6: 提交领域校验与工具函数**

```bash
git add apps/api/src/modules/schedule/dto apps/api/src/modules/schedule/schedule.types.ts apps/api/src/modules/schedule/schedule.utils.ts apps/api/src/modules/schedule/schedule.service.spec.ts
git commit -m "feat: add schedule validation helpers"
```

---

### Task 4: 实现 schedule service 的 CRUD 与 owner 隔离

**Files:**
- Create: `apps/api/src/modules/schedule/schedule.service.ts`
- Create: `apps/api/src/modules/schedule/schedule.service.spec.ts`
- Test: `pnpm --filter @ai-chat/api test -- schedule.service.spec.ts`

- [ ] **Step 1: 写创建 schedule 的失败测试**

```ts
it('creates a one-time schedule with computed nextRunAt', async () => {
  prisma.schedule.create.mockResolvedValue({
    id: 'schedule-1',
    title: 'Morning summary',
    taskPrompt: 'Summarize unread issues',
    type: 'ONE_TIME',
    cronExpr: null,
    runAt: new Date('2026-03-28T09:00:00.000Z'),
    timezone: 'UTC',
    enabled: true,
    lastRunAt: null,
    nextRunAt: new Date('2026-03-28T09:00:00.000Z'),
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const result = await service.createSchedule('user-1', {
    title: 'Morning summary',
    taskPrompt: 'Summarize unread issues',
    type: 'ONE_TIME',
    runAt: '2026-03-28T09:00:00.000Z'
  });

  expect(result.nextRunAt).toBe('2026-03-28T09:00:00.000Z');
});
```

- [ ] **Step 2: 写最小 create/list/update 实现**

```ts
async createSchedule(userId: string, input: CreateScheduleDto) {
  validateScheduleInput(input);
  const timezone = input.timezone ?? 'UTC';
  const nextRunAt = computeNextRunAt({ ...input, timezone });

  const schedule = await this.prisma.schedule.create({
    data: {
      userId,
      title: input.title,
      taskPrompt: input.taskPrompt,
      type: input.type,
      cronExpr: input.cronExpr ?? null,
      runAt: input.runAt ? new Date(input.runAt) : null,
      timezone,
      enabled: true,
      nextRunAt
    }
  });

  return this.toScheduleSummary(schedule);
}
```

- [ ] **Step 3: 写 owner 校验与更新逻辑**

```ts
async getScheduleOrThrow(userId: string, scheduleId: string) {
  const schedule = await this.prisma.schedule.findFirst({ where: { id: scheduleId, userId } });
  if (!schedule) {
    throw new NotFoundException('Schedule not found');
  }
  return schedule;
}

async updateSchedule(userId: string, scheduleId: string, input: UpdateScheduleDto) {
  const existing = await this.getScheduleOrThrow(userId, scheduleId);
  const nextInput = {
    title: input.title ?? existing.title,
    taskPrompt: input.taskPrompt ?? existing.taskPrompt,
    type: input.type ?? existing.type,
    cronExpr: input.cronExpr ?? existing.cronExpr,
    runAt: input.runAt ?? existing.runAt?.toISOString() ?? null,
    timezone: input.timezone ?? existing.timezone
  };

  validateScheduleInput(nextInput);
  const nextRunAt = input.enabled === false ? existing.nextRunAt : computeNextRunAt(nextInput);

  const schedule = await this.prisma.schedule.update({
    where: { id: scheduleId },
    data: {
      ...input,
      cronExpr: nextInput.cronExpr,
      runAt: nextInput.runAt ? new Date(nextInput.runAt) : null,
      nextRunAt,
      enabled: input.enabled ?? existing.enabled
    }
  });

  return this.toScheduleSummary(schedule);
}
```

- [ ] **Step 4: 写 enable/disable 与 run 查询接口**

```ts
async enableSchedule(userId: string, scheduleId: string) {
  const existing = await this.getScheduleOrThrow(userId, scheduleId);
  const nextRunAt = computeNextRunAt({
    type: existing.type,
    cronExpr: existing.cronExpr,
    runAt: existing.runAt?.toISOString() ?? null,
    timezone: existing.timezone
  });

  const schedule = await this.prisma.schedule.update({
    where: { id: existing.id },
    data: { enabled: true, nextRunAt }
  });

  return this.toScheduleSummary(schedule);
}
```

- [ ] **Step 5: 跑 service 单测**

Run: `pnpm --filter @ai-chat/api test -- schedule.service.spec.ts`
Expected: schedule create/update/enable/disable/owner 校验测试通过

- [ ] **Step 6: 提交 schedule service**

```bash
git add apps/api/src/modules/schedule/schedule.service.ts apps/api/src/modules/schedule/schedule.service.spec.ts
git commit -m "feat: add schedule service"
```

---

### Task 5: 实现 schedule runner 与执行桥接

**Files:**
- Create: `apps/api/src/modules/schedule/schedule-runner.service.ts`
- Modify: `apps/api/src/modules/chat/chat.service.ts`
- Create: `apps/api/src/modules/schedule/schedule-runner.service.spec.ts`
- Test: `pnpm --filter @ai-chat/api test -- schedule-runner.service.spec.ts`

- [ ] **Step 1: 先写 runner 成功路径测试**

```ts
it('creates a run and marks it succeeded after chat execution', async () => {
  prisma.schedule.findMany.mockResolvedValue([dueSchedule]);
  prisma.scheduleRun.create.mockResolvedValue(createdRun);
  chatService.createSessionWithFirstMessage.mockResolvedValue({
    session: { id: 'session-1', title: 'Task', model: 'deepseek-chat', createdAt: new Date(), updatedAt: new Date() },
    userMessage: { id: 'msg-1', sessionId: 'session-1', role: 'USER', content: dueSchedule.taskPrompt, createdAt: new Date() }
  });
  agentService.streamChatReply.mockReturnValue(makeAgentStream(['done']));

  await service.processDueSchedules();

  expect(prisma.scheduleRun.update).toHaveBeenCalledWith(expect.objectContaining({
    data: expect.objectContaining({ status: 'SUCCEEDED', chatSessionId: 'session-1' })
  }));
});
```

- [ ] **Step 2: 写最小到期扫描与 run 创建逻辑**

```ts
async processDueSchedules(now = new Date()) {
  const schedules = await this.prisma.schedule.findMany({
    where: {
      enabled: true,
      nextRunAt: { lte: now }
    },
    orderBy: { nextRunAt: 'asc' },
    take: 20
  });

  for (const schedule of schedules) {
    await this.processSchedule(schedule, now);
  }
}
```

- [ ] **Step 3: 写单条 schedule 的领取与执行逻辑**

```ts
private async processSchedule(schedule: ScheduleRecord, now: Date) {
  const claimed = await this.prisma.schedule.updateMany({
    where: {
      id: schedule.id,
      enabled: true,
      nextRunAt: schedule.nextRunAt
    },
    data: {
      lastRunAt: now,
      nextRunAt: schedule.type === 'ONE_TIME' ? null : computeNextRunAt({
        type: schedule.type,
        cronExpr: schedule.cronExpr,
        runAt: schedule.runAt?.toISOString() ?? null,
        timezone: schedule.timezone,
        now
      })
    }
  });

  if (claimed.count === 0) {
    return;
  }

  const run = await this.prisma.scheduleRun.create({
    data: {
      scheduleId: schedule.id,
      userId: schedule.userId,
      status: 'RUNNING',
      taskPromptSnapshot: schedule.taskPrompt,
      startedAt: now
    }
  });

  await this.executeRun(schedule, run, now);
}
```

- [ ] **Step 4: 桥接到现有 chat / agent 链路**

```ts
private async executeRun(schedule: ScheduleRecord, run: ScheduleRunRecord, now: Date) {
  const { session } = await this.chatService.createSessionWithFirstMessage(schedule.userId, schedule.taskPrompt);
  let assistantText = '';

  try {
    for await (const event of this.agentService.streamChatReply({
      userId: schedule.userId,
      sessionId: session.id,
      history: [],
      prompt: schedule.taskPrompt
    })) {
      if (event.type === 'text_delta') {
        assistantText += event.delta;
      }
    }

    await this.chatService.saveAssistantMessage(session.id, assistantText);
    await this.prisma.scheduleRun.update({
      where: { id: run.id },
      data: {
        status: 'SUCCEEDED',
        resultSummary: assistantText.slice(0, 280),
        chatSessionId: session.id,
        finishedAt: new Date()
      }
    });
  } catch (error) {
    await this.prisma.scheduleRun.update({
      where: { id: run.id },
      data: {
        status: 'FAILED',
        errorMessage: error instanceof Error ? error.message : 'Schedule run failed',
        chatSessionId: session.id,
        finishedAt: new Date()
      }
    });
  }
}
```

- [ ] **Step 5: 处理 ONE_TIME 自动停用**

```ts
if (schedule.type === 'ONE_TIME') {
  await this.prisma.schedule.update({
    where: { id: schedule.id },
    data: { enabled: false, nextRunAt: null, lastRunAt: now }
  });
}
```

- [ ] **Step 6: 跑 runner 单测**

Run: `pnpm --filter @ai-chat/api test -- schedule-runner.service.spec.ts`
Expected: 到期触发、避免重复领取、成功失败更新、ONE_TIME 停用测试通过

- [ ] **Step 7: 提交 runner 与 chat 复用改动**

```bash
git add apps/api/src/modules/schedule/schedule-runner.service.ts apps/api/src/modules/schedule/schedule-runner.service.spec.ts apps/api/src/modules/chat/chat.service.ts
git commit -m "feat: add schedule runner"
```

---

### Task 6: 暴露 schedule / runs HTTP 接口并接入模块

**Files:**
- Create: `apps/api/src/modules/schedule/schedule.controller.ts`
- Create: `apps/api/src/modules/schedule/schedule.module.ts`
- Modify: `apps/api/src/app.module.ts`
- Create: `apps/api/test/schedule.e2e-spec.ts`
- Test: `pnpm --filter @ai-chat/api test:e2e -- schedule.e2e-spec.ts`

- [ ] **Step 1: 先写 e2e 测试覆盖接口边界**

```ts
it('creates and lists schedules for current user only', async () => {
  const token = await loginAsUser(app, 'user@example.com');

  await request(app.getHttpServer())
    .post('/schedules')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Morning summary',
      taskPrompt: 'Summarize my inbox',
      type: 'ONE_TIME',
      runAt: '2026-03-28T09:00:00.000Z'
    })
    .expect(201);

  const response = await request(app.getHttpServer())
    .get('/schedules')
    .set('Authorization', `Bearer ${token}`)
    .expect(200);

  expect(response.body.schedules).toHaveLength(1);
});
```

- [ ] **Step 2: 写 controller 的最小路由**

```ts
@Controller()
@UseGuards(JwtAuthGuard)
export class ScheduleController {
  constructor(private readonly scheduleService: ScheduleService) {}

  @Post('schedules')
  createSchedule(@CurrentUser() user: CurrentUserPayload, @Body() dto: CreateScheduleDto) {
    return this.scheduleService.createSchedule(user.userId, dto);
  }

  @Get('schedules')
  listSchedules(@CurrentUser() user: CurrentUserPayload) {
    return this.scheduleService.listSchedules(user.userId);
  }
}
```

- [ ] **Step 3: 补 update、enable、disable、runs 查询接口**

```ts
@Patch('schedules/:id')
updateSchedule(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string, @Body() dto: UpdateScheduleDto) {
  return this.scheduleService.updateSchedule(user.userId, id, dto);
}

@Post('schedules/:id/enable')
enableSchedule(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
  return this.scheduleService.enableSchedule(user.userId, id);
}

@Post('schedules/:id/disable')
disableSchedule(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
  return this.scheduleService.disableSchedule(user.userId, id);
}
```

- [ ] **Step 4: 组装 module 并接入 AppModule**

```ts
@Module({
  imports: [ChatModule, AgentModule],
  controllers: [ScheduleController],
  providers: [ScheduleService, ScheduleRunnerService]
})
export class ScheduleModule {}
```

并在 `apps/api/src/app.module.ts` 中改成：

```ts
imports: [PrismaModule, UsersModule, AuthModule, ChatModule, ScheduleModule]
```

- [ ] **Step 5: 跑 e2e 测试**

Run: `pnpm --filter @ai-chat/api test:e2e -- schedule.e2e-spec.ts`
Expected: schedule 创建、更新、启停、runs 查询与 owner 隔离通过

- [ ] **Step 6: 提交 API 接口层**

```bash
git add apps/api/src/modules/schedule apps/api/src/app.module.ts apps/api/test/schedule.e2e-spec.ts
git commit -m "feat: add schedule api endpoints"
```

---

### Task 7: 新增前端 schedule service 与页面路由

**Files:**
- Create: `apps/web/src/services/schedule.ts`
- Modify: `apps/web/src/router/index.tsx`
- Modify: `apps/web/src/components/chat/SessionSidebar.tsx`
- Create: `apps/web/src/__tests__/schedule-service.test.ts`
- Test: `pnpm --filter @ai-chat/web test -- schedule-service.test.ts`

- [ ] **Step 1: 先写 schedule service 测试**

```ts
it('calls list schedules endpoint', async () => {
  server.use(
    http.get('http://localhost:3000/schedules', () => HttpResponse.json({ schedules: [] }))
  );

  await expect(listSchedules('token')).resolves.toEqual({ schedules: [] });
});
```

- [ ] **Step 2: 写前端 service**

```ts
export function listSchedules(accessToken: string) {
  return apiFetch<ListSchedulesResponse>('/schedules', { accessToken });
}

export function createSchedule(accessToken: string, payload: CreateScheduleRequest) {
  return apiFetch<ScheduleSummary>('/schedules', {
    method: 'POST',
    accessToken,
    body: JSON.stringify(payload)
  });
}

export function listRuns(accessToken: string, searchParams?: URLSearchParams) {
  const query = searchParams?.toString();
  return apiFetch<ListScheduleRunsResponse>(query ? `/runs?${query}` : '/runs', { accessToken });
}
```

- [ ] **Step 3: 挂载页面路由**

```tsx
{ path: 'schedules', element: <SchedulesPage /> },
{ path: 'runs', element: <RunsPage /> }
```

- [ ] **Step 4: 在侧栏加入口**

```tsx
<nav>
  <button onClick={props.onNewChat}>New Chat</button>
  <Link to="/chat">Chat</Link>
  <Link to="/schedules">Schedules</Link>
  <Link to="/runs">Runs</Link>
</nav>
```

- [ ] **Step 5: 跑前端 service 测试**

Run: `pnpm --filter @ai-chat/web test -- schedule-service.test.ts`
Expected: schedule / runs API 封装测试通过

- [ ] **Step 6: 提交前端 service 与导航改动**

```bash
git add apps/web/src/services/schedule.ts apps/web/src/router/index.tsx apps/web/src/components/chat/SessionSidebar.tsx apps/web/src/__tests__/schedule-service.test.ts
git commit -m "feat: add schedule web services and routes"
```

---

### Task 8: 实现 `/schedules` 页面与表单交互

**Files:**
- Create: `apps/web/src/pages/schedules/SchedulesPage.tsx`
- Create: `apps/web/src/components/schedules/ScheduleForm.tsx`
- Create: `apps/web/src/components/schedules/ScheduleList.tsx`
- Create: `apps/web/src/__tests__/schedules-page.test.tsx`
- Test: `pnpm --filter @ai-chat/web test -- schedules-page.test.tsx`

- [ ] **Step 1: 先写页面测试，固定最小交互**

```tsx
it('renders schedules and submits create form', async () => {
  render(<SchedulesPage />);

  expect(await screen.findByText('Morning summary')).toBeInTheDocument();
  await user.type(screen.getByLabelText('Title'), 'Daily digest');
  await user.type(screen.getByLabelText('Task prompt'), 'Summarize my issues');
  await user.click(screen.getByLabelText('One time'));
  await user.type(screen.getByLabelText('Run at'), '2026-03-28T09:00');
  await user.click(screen.getByRole('button', { name: 'Create schedule' }));

  expect(await screen.findByText('Daily digest')).toBeInTheDocument();
});
```

- [ ] **Step 2: 写最小页面状态流**

```tsx
export function SchedulesPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [schedules, setSchedules] = useState<ScheduleSummary[]>([]);

  useEffect(() => {
    if (!accessToken) return;
    listSchedules(accessToken).then(({ schedules }) => setSchedules(schedules));
  }, [accessToken]);

  if (!accessToken) {
    return null;
  }

  return (
    <main>
      <h1>Schedules</h1>
      <ScheduleForm accessToken={accessToken} onCreated={(schedule) => setSchedules((current) => [schedule, ...current])} />
      <ScheduleList schedules={schedules} />
    </main>
  );
}
```

- [ ] **Step 3: 写表单组件，保持最小字段集**

```tsx
export function ScheduleForm(props: { accessToken: string; onCreated: (schedule: ScheduleSummary) => void }) {
  const [title, setTitle] = useState('');
  const [taskPrompt, setTaskPrompt] = useState('');
  const [type, setType] = useState<'CRON' | 'ONE_TIME'>('ONE_TIME');
  const [runAt, setRunAt] = useState('');
  const [cronExpr, setCronExpr] = useState('');

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const schedule = await createSchedule(props.accessToken, {
      title,
      taskPrompt,
      type,
      runAt: type === 'ONE_TIME' ? new Date(runAt).toISOString() : undefined,
      cronExpr: type === 'CRON' ? cronExpr : undefined,
      timezone: 'UTC'
    });
    props.onCreated(schedule);
  }

  return <form onSubmit={handleSubmit}>{/* minimal fields */}</form>;
}
```

- [ ] **Step 4: 列表中补 enable/disable 与查看 runs**

```tsx
<button onClick={() => onToggle(schedule)}>{schedule.enabled ? 'Disable' : 'Enable'}</button>
<Link to={`/runs?scheduleId=${schedule.id}`}>View runs</Link>
```

- [ ] **Step 5: 跑页面测试**

Run: `pnpm --filter @ai-chat/web test -- schedules-page.test.tsx`
Expected: `/schedules` 的列表渲染、创建、启停交互测试通过

- [ ] **Step 6: 提交 `/schedules` 页面**

```bash
git add apps/web/src/pages/schedules apps/web/src/components/schedules apps/web/src/__tests__/schedules-page.test.tsx
git commit -m "feat: add schedules page"
```

---

### Task 9: 实现 `/runs` 页面与聊天跳转

**Files:**
- Create: `apps/web/src/pages/runs/RunsPage.tsx`
- Create: `apps/web/src/components/runs/RunList.tsx`
- Create: `apps/web/src/__tests__/runs-page.test.tsx`
- Test: `pnpm --filter @ai-chat/web test -- runs-page.test.tsx`

- [ ] **Step 1: 先写 runs 页面测试**

```tsx
it('renders runs and filters by status', async () => {
  render(<RunsPage />);

  expect(await screen.findByText('Morning summary')).toBeInTheDocument();
  await user.selectOptions(screen.getByLabelText('Status'), 'FAILED');
  expect(await screen.findByText('Network error')).toBeInTheDocument();
});
```

- [ ] **Step 2: 写最小页面加载逻辑**

```tsx
export function RunsPage() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [runs, setRuns] = useState<ScheduleRunSummary[]>([]);
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (!accessToken) return;
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    listRuns(accessToken, params).then(({ runs }) => setRuns(runs));
  }, [accessToken, status]);

  return <RunList runs={runs} status={status} onStatusChange={setStatus} />;
}
```

- [ ] **Step 3: 列表中渲染摘要与聊天入口**

```tsx
{run.chatSessionId ? <Link to={`/chat?sessionId=${run.chatSessionId}`}>Open chat</Link> : null}
```

- [ ] **Step 4: 在 ChatPage 中支持 `sessionId` 查询参数初始化**

```tsx
const [searchParams] = useSearchParams();
const sessionIdFromUrl = searchParams.get('sessionId');

useEffect(() => {
  if (sessionIdFromUrl) {
    setCurrentSession(sessionIdFromUrl);
  }
}, [sessionIdFromUrl, setCurrentSession]);
```

- [ ] **Step 5: 跑 runs 页面测试**

Run: `pnpm --filter @ai-chat/web test -- runs-page.test.tsx`
Expected: `/runs` 的列表、筛选、跳聊天入口测试通过

- [ ] **Step 6: 提交 `/runs` 页面与聊天跳转**

```bash
git add apps/web/src/pages/runs apps/web/src/components/runs apps/web/src/__tests__/runs-page.test.tsx apps/web/src/pages/chat/ChatPage.tsx
git commit -m "feat: add runs page"
```

---

### Task 10: 做分层验收并清理剩余问题

**Files:**
- Modify: 仅修正前面任务暴露的问题文件
- Test: `pnpm --filter @ai-chat/api test -- schedule.service.spec.ts`
- Test: `pnpm --filter @ai-chat/api test -- schedule-runner.service.spec.ts`
- Test: `pnpm --filter @ai-chat/api test:e2e -- schedule.e2e-spec.ts`
- Test: `pnpm --filter @ai-chat/web test -- schedules-page.test.tsx`
- Test: `pnpm --filter @ai-chat/web test -- runs-page.test.tsx`
- Test: `pnpm --filter @ai-chat/web build`
- Test: `pnpm --filter @ai-chat/api build`

- [ ] **Step 1: 跑 API 相关测试**

Run: `pnpm --filter @ai-chat/api test -- schedule.service.spec.ts && pnpm --filter @ai-chat/api test -- schedule-runner.service.spec.ts && pnpm --filter @ai-chat/api test:e2e -- schedule.e2e-spec.ts`
Expected: API schedule 测试全部通过

- [ ] **Step 2: 跑 Web 相关测试**

Run: `pnpm --filter @ai-chat/web test -- schedules-page.test.tsx && pnpm --filter @ai-chat/web test -- runs-page.test.tsx`
Expected: Web schedule/runs 页面测试全部通过

- [ ] **Step 3: 跑受影响 workspace build**

Run: `pnpm --filter @ai-chat/api build && pnpm --filter @ai-chat/web build`
Expected: API 与 Web 构建成功

- [ ] **Step 4: 做真实浏览器联调验收**

Run: 使用 `agent-browser` 验证以下流程：
- 登录后进入 `/schedules`
- 创建一个 `ONE_TIME` schedule
- 创建一个 `CRON` schedule
- 查看 enable / disable 操作
- 等待或手动制造到期数据后在 `/runs` 看到记录
- 点击 `Open chat` 跳回对应聊天记录

Expected: 关键用户路径可用，无明显 UI/权限错误

- [ ] **Step 5: 提交最终验收修复**

```bash
git add <modified-files>
git commit -m "feat: complete schedule mvp"
```

---

## Self-Review

- Spec coverage：已覆盖 `Schedule` / `ScheduleRun`、`CRON / ONE_TIME`、enable/disable、后台扫描触发、run 查询、`chatSessionId` 关联、`/schedules`、`/runs`、权限隔离、最小测试闭环。
- Placeholder scan：没有保留 `TBD`、`TODO`、`implement later` 之类占位；migration 时间戳仍按仓库实际生成，这是唯一必须运行命令才能确定的部分。
- Type consistency：全篇统一使用 `ScheduleSummary`、`ScheduleRunSummary`、`taskPrompt`、`taskPromptSnapshot`、`chatSessionId`、`nextRunAt` 命名，与 spec 一致。
