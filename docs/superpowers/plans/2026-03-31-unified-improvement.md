# Unified Improvement Plan Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不重写现有架构的前提下，按单一总 plan 分三阶段完成生产化收口、schedule/run 运维化、产品补缺，并补齐 automated tests 与最终 Web 浏览器 e2e 验收。

**Architecture:** 以当前 monorepo 边界为准推进：API 继续沿 `auth`、`chat`、`agent`、`tool`、`schedule` 模块扩展，Web 继续沿 `pages`、`services`、`stores`、`components` 分层补强，`packages/shared` 作为唯一共享契约层。Phase 1 先统一状态/错误/日志/配置与最小可观测性，Phase 2 再把 schedule/run 提升到可诊断可运维，Phase 3 最后补 refresh token、settings 与核心页面体验，并以 Web 层 automated tests + `agent-browser` 最终验收收口。

**Tech Stack:** NestJS、Prisma、PostgreSQL、Redis、BullMQ、React、Vite、TypeScript、Zustand、Vitest + Testing Library、Jest + Supertest、Docker multi-stage build、agent-browser

---

## File Structure

### Phase 1：生产化基础收口
- Modify: `packages/shared/src/chat.ts`
- Modify: `packages/shared/src/tool.ts`
- Modify: `packages/shared/src/schedule.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/api/src/modules/chat/chat.types.ts`
- Modify: `apps/api/src/modules/agent/agent.types.ts`
- Modify: `apps/api/src/modules/tool/tool.types.ts`
- Modify: `apps/api/src/modules/schedule/schedule.types.ts`
- Modify: `apps/api/src/modules/chat/chat.controller.ts`
- Modify: `apps/api/src/modules/chat/chat.service.ts`
- Modify: `apps/api/src/modules/agent/agent.service.ts`
- Modify: `apps/api/src/modules/tool/tool.service.ts`
- Modify: `apps/api/src/modules/schedule/schedule-runner.service.ts`
- Modify: `apps/api/src/modules/schedule/schedule-tick.processor.ts`
- Modify: `apps/api/src/modules/schedule/schedule-tick.bootstrap.service.ts`
- Modify: `apps/api/src/common/config/env.ts`
- Modify: `apps/api/src/common/queue/queue.constants.ts`
- Modify: `apps/api/src/common/queue/queue.module.ts`
- Modify: `apps/api/src/health.controller.ts`
- Modify: `apps/web/src/lib/env.ts`
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/public/runtime-config.js`
- Create or Modify: `apps/api/Dockerfile`
- Create or Modify: `apps/web/Dockerfile`
- Modify: `infra/compose.yaml`
- Test: `apps/api/src/modules/chat/chat.service.spec.ts`
- Test: `apps/api/src/modules/agent/agent.service.spec.ts`
- Test: `apps/api/src/modules/tool/tool.service.spec.ts`
- Test: `apps/api/src/modules/schedule/schedule-runner.service.spec.ts`
- Test: `apps/api/test/schedule.e2e-spec.ts`
- Test: `apps/web/src/__tests__/runs-page.test.tsx`
- Test: `apps/web/src/__tests__/schedules-page.test.tsx`

### Phase 2：schedule / run 运维化
- Modify: `packages/shared/src/schedule.ts`
- Modify: `packages/shared/src/tool.ts`
- Modify: `apps/api/src/modules/schedule/schedule.service.ts`
- Modify: `apps/api/src/modules/schedule/schedule.controller.ts`
- Modify: `apps/api/src/modules/schedule/schedule-runner.service.ts`
- Modify: `apps/api/src/modules/tool/tool.service.ts`
- Modify: `apps/api/src/modules/agent/agent.service.ts`
- Modify: `apps/api/src/modules/schedule/schedule-tick.bootstrap.service.ts`
- Modify: `apps/api/src/modules/schedule/schedule-tick.processor.ts`
- Modify: `apps/web/src/services/schedule.ts`
- Modify: `apps/web/src/pages/runs/RunsPage.tsx`
- Modify: `apps/web/src/pages/schedules/SchedulesPage.tsx`
- Modify: `apps/web/src/components/runs/RunList.tsx`
- Modify: `apps/web/src/components/schedules/ScheduleForm.tsx`
- Create: `apps/web/src/components/runs/RunDiagnosticsCard.tsx`
- Create: `apps/web/src/components/schedules/ScheduleHealthSummary.tsx`
- Test: `apps/api/src/modules/schedule/schedule.service.spec.ts`
- Test: `apps/api/src/modules/schedule/schedule-runner.service.spec.ts`
- Test: `apps/api/test/schedule.e2e-spec.ts`
- Test: `apps/web/src/__tests__/runs-page.test.tsx`
- Test: `apps/web/src/__tests__/schedules-page.test.tsx`

### Phase 3：产品补缺
- Modify: `packages/shared/src/auth.ts`
- Modify: `packages/shared/src/index.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_refresh_tokens/migration.sql`
- Modify: `apps/api/src/common/config/env.ts`
- Modify: `apps/api/src/modules/auth/auth.controller.ts`
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Create: `apps/api/src/modules/auth/dto/refresh-token.dto.ts`
- Modify: `apps/web/src/stores/auth-store.ts`
- Modify: `apps/web/src/services/auth.ts`
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/router/index.tsx`
- Create: `apps/web/src/pages/settings/SettingsPage.tsx`
- Modify: `apps/web/src/components/layout/AppShell.tsx`
- Modify: `apps/web/src/pages/chat/ChatPage.tsx`
- Modify: `apps/web/src/stores/chat-store.ts`
- Modify: `apps/web/src/components/chat/*`
- Modify: `apps/web/src/pages/runs/RunsPage.tsx`
- Modify: `apps/web/src/pages/schedules/SchedulesPage.tsx`
- Test: `apps/api/test/auth.e2e-spec.ts`
- Test: `apps/web/src/__tests__/auth-store.test.ts`
- Test: `apps/web/src/__tests__/chat-page.test.tsx`
- Test: `apps/web/src/__tests__/runs-page.test.tsx`
- Test: `apps/web/src/__tests__/schedules-page.test.tsx`
- Create: `docs/superpowers/plans/2026-03-31-unified-improvement-browser-e2e-matrix.md`

### Final validation artifacts
- Modify: `docs/superpowers/plans/2026-03-31-unified-improvement.md`
- Create: `docs/superpowers/plans/2026-03-31-unified-improvement-report.md`

---

## Cross-Phase Rules

- 先改 shared 契约，再改 API，再改 Web。
- 每个新状态/错误字段都必须同时补单测或集成测试。
- 不引入新的平台层、事件总线、workflow engine。
- Docker 仅做适配当前仓库的轻量运行边界，不扩展为复杂部署系统。
- Web 最终 e2e 统一放在所有功能完成后，用 `agent-browser` 按 P0-P5 分级矩阵执行。

---

### Task 1: 统一 Phase 1 状态语义与错误分层

**Files:**
- Modify: `packages/shared/src/chat.ts`
- Modify: `packages/shared/src/tool.ts`
- Modify: `packages/shared/src/schedule.ts`
- Modify: `apps/api/src/modules/chat/chat.types.ts`
- Modify: `apps/api/src/modules/agent/agent.types.ts`
- Modify: `apps/api/src/modules/tool/tool.types.ts`
- Modify: `apps/api/src/modules/schedule/schedule.types.ts`
- Test: `apps/api/src/modules/chat/chat.service.spec.ts`
- Test: `apps/api/src/modules/tool/tool.service.spec.ts`

- [ ] **Step 1: 先写 shared 状态与错误分类测试**

```ts
// apps/api/src/modules/tool/tool.service.spec.ts
it('maps external dependency failures to EXTERNAL_ERROR', async () => {
  await expect(service.completeExecutionWithFailure('tool-exec-1', new Error('provider timeout')))
    .resolves.toMatchObject({
      status: 'FAILED',
      errorCategory: 'EXTERNAL_ERROR'
    });
});
```

```ts
// apps/api/src/modules/chat/chat.service.spec.ts
it('maps invalid chat input to USER_ERROR run failure', async () => {
  await expect(service.validateStreamRequest({ sessionId: '', message: '' } as any)).rejects.toMatchObject({
    code: 'USER_ERROR'
  });
});
```

- [ ] **Step 2: 运行受影响测试确认当前失败**

Run: `pnpm --filter @ai-chat/api test -- chat.service.spec.ts tool.service.spec.ts`
Expected: FAIL，提示缺少统一 `errorCategory` / 状态字段或断言不匹配。

- [ ] **Step 3: 扩展 shared 契约，补统一错误分类与诊断字段**

```ts
// packages/shared/src/schedule.ts
export type ErrorCategory = 'USER_ERROR' | 'EXTERNAL_ERROR' | 'INTERNAL_ERROR';
export type RunStage = 'QUEUED' | 'AGENT' | 'LLM' | 'TOOL' | 'PERSISTENCE' | 'COMPLETED';

interface ScheduleRunSummaryBase {
  id: string;
  scheduleId: string;
  userId: string;
  taskPromptSnapshot: string;
  chatSessionId: string | null;
  createdAt: string;
  schedule: ScheduleReference;
  errorCategory: ErrorCategory | null;
  stage: RunStage;
}
```

```ts
// packages/shared/src/tool.ts
export interface ToolExecutionSummary {
  id: string;
  sessionId: string;
  toolName: ToolName;
  status: ToolExecutionStatus;
  input: string | null;
  output: string | null;
  errorMessage: string | null;
  errorCategory: ErrorCategory | null;
  startedAt: string | null;
  finishedAt: string | null;
}
```

- [ ] **Step 4: 在 API 类型层对齐 shared 语义**

```ts
// apps/api/src/modules/schedule/schedule.types.ts
export type FailureCategory = 'USER_ERROR' | 'EXTERNAL_ERROR' | 'INTERNAL_ERROR';
export type ExecutionStage = 'QUEUED' | 'AGENT' | 'LLM' | 'TOOL' | 'PERSISTENCE' | 'COMPLETED';
```

```ts
// apps/api/src/modules/tool/tool.types.ts
export interface ToolFailureDetails {
  message: string;
  category: FailureCategory;
}
```

- [ ] **Step 5: 实现最小映射逻辑让测试转绿**

```ts
// apps/api/src/modules/tool/tool.service.ts
private classifyToolError(error: unknown): FailureCategory {
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (message.includes('validation') || message.includes('invalid')) {
    return 'USER_ERROR';
  }
  if (message.includes('timeout') || message.includes('provider') || message.includes('fetch')) {
    return 'EXTERNAL_ERROR';
  }
  return 'INTERNAL_ERROR';
}
```

- [ ] **Step 6: 回归测试**

Run: `pnpm --filter @ai-chat/api test -- chat.service.spec.ts tool.service.spec.ts`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add packages/shared/src/chat.ts packages/shared/src/tool.ts packages/shared/src/schedule.ts apps/api/src/modules/chat/chat.types.ts apps/api/src/modules/agent/agent.types.ts apps/api/src/modules/tool/tool.types.ts apps/api/src/modules/schedule/schedule.types.ts apps/api/src/modules/chat/chat.service.spec.ts apps/api/src/modules/tool/tool.service.spec.ts apps/api/src/modules/tool/tool.service.ts
git commit -m "refactor(api): unify failure categories and status semantics"
```

---

### Task 2: 为 chat / tool / schedule 链路补结构化日志与 trace 字段

**Files:**
- Modify: `apps/api/src/modules/chat/chat.controller.ts`
- Modify: `apps/api/src/modules/chat/chat.service.ts`
- Modify: `apps/api/src/modules/agent/agent.service.ts`
- Modify: `apps/api/src/modules/tool/tool.service.ts`
- Modify: `apps/api/src/modules/schedule/schedule-runner.service.ts`
- Modify: `apps/api/src/modules/schedule/schedule-tick.processor.ts`
- Test: `apps/api/src/modules/schedule/schedule-runner.service.spec.ts`

- [ ] **Step 1: 先写 schedule runner 日志上下文测试**

```ts
it('logs run lifecycle with scheduleId runId and userId', async () => {
  await service.processDueSchedules(new Date('2026-03-31T09:00:00.000Z'));

  expect(logger.log).toHaveBeenCalledWith(
    expect.stringContaining('schedule_run_started'),
    expect.objectContaining({
      scheduleId: 'schedule-1',
      runId: 'run-1',
      userId: 'user-1'
    })
  );
});
```

- [ ] **Step 2: 运行 runner 单测确认失败**

Run: `pnpm --filter @ai-chat/api test -- schedule-runner.service.spec.ts`
Expected: FAIL，尚未输出统一上下文字段。

- [ ] **Step 3: 在关键入口补统一日志上下文**

```ts
// apps/api/src/modules/schedule/schedule-runner.service.ts
this.logger.log('schedule_run_started', {
  scheduleId: schedule.id,
  runId: run.id,
  userId: schedule.userId,
  tickInstanceId: this.tickInstanceId,
  stage: 'QUEUED'
});
```

```ts
// apps/api/src/modules/chat/chat.service.ts
this.logger.log('chat_stream_started', {
  userId,
  sessionId,
  runId,
  scheduleId: sourceScheduleId ?? null
});
```

- [ ] **Step 4: 在失败路径补分类日志**

```ts
this.logger.error('schedule_run_failed', {
  scheduleId: schedule.id,
  runId: run.id,
  stage,
  errorCategory,
  errorMessage: error instanceof Error ? error.message : 'Unknown error'
});
```

- [ ] **Step 5: 回归 runner 单测**

Run: `pnpm --filter @ai-chat/api test -- schedule-runner.service.spec.ts`
Expected: PASS。

- [ ] **Step 6: 执行主链路相关测试**

Run: `pnpm --filter @ai-chat/api test -- chat.service.spec.ts agent.service.spec.ts tool.service.spec.ts schedule-runner.service.spec.ts`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add apps/api/src/modules/chat/chat.controller.ts apps/api/src/modules/chat/chat.service.ts apps/api/src/modules/agent/agent.service.ts apps/api/src/modules/tool/tool.service.ts apps/api/src/modules/schedule/schedule-runner.service.ts apps/api/src/modules/schedule/schedule-tick.processor.ts apps/api/src/modules/schedule/schedule-runner.service.spec.ts
git commit -m "feat(api): add structured trace logging for execution chain"
```

---

### Task 3: 定义 timeout 语义与关键失败处理

**Files:**
- Modify: `apps/api/src/common/config/env.ts`
- Modify: `apps/api/src/modules/chat/chat.service.ts`
- Modify: `apps/api/src/modules/agent/agent.service.ts`
- Modify: `apps/api/src/modules/tool/tool.service.ts`
- Modify: `apps/api/src/modules/schedule/schedule-runner.service.ts`
- Test: `apps/api/src/modules/agent/agent.service.spec.ts`
- Test: `apps/api/src/modules/schedule/schedule-runner.service.spec.ts`

- [ ] **Step 1: 写 tool timeout 与 schedule timeout 失败测试**

```ts
it('marks run as FAILED with EXTERNAL_ERROR when schedule execution times out', async () => {
  jest.spyOn(service as any, 'executeRun').mockRejectedValue(new Error('schedule timeout'));

  await service.processDueSchedules(new Date('2026-03-31T09:00:00.000Z'));

  expect(prisma.scheduleRun.update).toHaveBeenCalledWith(
    expect.objectContaining({
      data: expect.objectContaining({
        status: 'FAILED',
        errorCategory: 'EXTERNAL_ERROR'
      })
    })
  );
});
```

- [ ] **Step 2: 运行超时相关单测**

Run: `pnpm --filter @ai-chat/api test -- agent.service.spec.ts schedule-runner.service.spec.ts`
Expected: FAIL。

- [ ] **Step 3: 在 env 中加入统一 timeout 配置**

```ts
export const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  JWT_SECRET: z.string().min(1),
  API_PORT: z.coerce.number().default(3000),
  SCHEDULE_TICK_EVERY_MS: z.coerce.number().int().positive().default(30000),
  CHAT_STREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(120000),
  TOOL_EXECUTION_TIMEOUT_MS: z.coerce.number().int().positive().default(60000),
  SCHEDULE_RUN_TIMEOUT_MS: z.coerce.number().int().positive().default(180000),
  DEEPSEEK_API_KEY: z.string().min(1),
  DEEPSEEK_BASE_URL: z.string().url().optional(),
  DEEPSEEK_MODEL: z.string().min(1).default('deepseek-chat')
});
```

- [ ] **Step 4: 以最小包装实现 timeout 语义**

```ts
private async withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return await Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`${label} timeout`)), timeoutMs))
  ]);
}
```

- [ ] **Step 5: 在失败回写中保留部分结果边界**

```ts
await this.prisma.scheduleRun.update({
  where: { id: run.id },
  data: {
    status: 'FAILED',
    errorMessage: error.message,
    errorCategory: this.classifyFailure(error),
    resultSummary: partialText ?? null,
    finishedAt: new Date()
  }
});
```

- [ ] **Step 6: 回归超时测试**

Run: `pnpm --filter @ai-chat/api test -- agent.service.spec.ts schedule-runner.service.spec.ts`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add apps/api/src/common/config/env.ts apps/api/src/modules/chat/chat.service.ts apps/api/src/modules/agent/agent.service.ts apps/api/src/modules/tool/tool.service.ts apps/api/src/modules/schedule/schedule-runner.service.ts apps/api/src/modules/agent/agent.service.spec.ts apps/api/src/modules/schedule/schedule-runner.service.spec.ts
git commit -m "feat(api): define timeout behavior for chat tool and schedule runs"
```

---

### Task 4: 补 health/readiness 与 queue/tick 最小可观测性

**Files:**
- Modify: `apps/api/src/health.controller.ts`
- Modify: `apps/api/src/common/queue/queue.constants.ts`
- Modify: `apps/api/src/common/queue/queue.module.ts`
- Modify: `apps/api/src/modules/schedule/schedule-tick.bootstrap.service.ts`
- Modify: `apps/api/src/modules/schedule/schedule-tick.processor.ts`
- Test: `apps/api/test/schedule.e2e-spec.ts`

- [ ] **Step 1: 写 health 响应包含 db redis tick 字段的 e2e 测试**

```ts
it('GET /health reports db redis and tick status', async () => {
  const response = await request(app.getHttpServer()).get('/health').expect(200);

  expect(response.body).toMatchObject({
    ok: true,
    checks: expect.objectContaining({
      database: 'up',
      redis: 'up',
      scheduleTick: expect.any(String)
    })
  });
});
```

- [ ] **Step 2: 运行 schedule e2e 基线**

Run: `pnpm --filter @ai-chat/api test:e2e -- schedule.e2e-spec.ts`
Expected: FAIL，当前 `/health` 未返回完整运行判断信息。

- [ ] **Step 3: 在 health controller 暴露最小状态**

```ts
@Get('health')
async getHealth() {
  return {
    ok: true,
    checks: {
      database: await this.prismaHealth.check(),
      redis: await this.queueHealth.check(),
      scheduleTick: this.tickMonitor.isActive() ? 'running' : 'idle'
    }
  };
}
```

- [ ] **Step 4: 在 queue/tick 模块记录实例信息**

```ts
export const SCHEDULE_TICK_INSTANCE = `schedule-tick:${process.pid}`;
```

```ts
this.logger.log('schedule_tick_bootstrap_ready', {
  instanceId: SCHEDULE_TICK_INSTANCE,
  queueName: SCHEDULE_TICK_QUEUE
});
```

- [ ] **Step 5: 回归 e2e**

Run: `pnpm --filter @ai-chat/api test:e2e -- schedule.e2e-spec.ts`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add apps/api/src/health.controller.ts apps/api/src/common/queue/queue.constants.ts apps/api/src/common/queue/queue.module.ts apps/api/src/modules/schedule/schedule-tick.bootstrap.service.ts apps/api/src/modules/schedule/schedule-tick.processor.ts apps/api/test/schedule.e2e-spec.ts
git commit -m "feat(api): expose minimal health and tick observability"
```

---

### Task 5: 收敛配置边界并补轻量 Docker 运行约束

**Files:**
- Modify: `apps/api/src/common/config/env.ts`
- Modify: `apps/web/src/lib/env.ts`
- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/public/runtime-config.js`
- Create or Modify: `apps/api/Dockerfile`
- Create or Modify: `apps/web/Dockerfile`
- Modify: `infra/compose.yaml`
- Test: `apps/web/src/__tests__/runs-page.test.tsx`

- [ ] **Step 1: 写 web runtime config 读取测试**

```ts
it('prefers runtime config api base url over build-time fallback', async () => {
  (window as any).__AI_CHAT_RUNTIME_CONFIG__ = { apiBaseUrl: 'http://localhost:3100' };
  const { getApiBaseUrl } = await import('../lib/env');
  expect(getApiBaseUrl()).toBe('http://localhost:3100');
});
```

- [ ] **Step 2: 运行 web 相关测试确认失败**

Run: `pnpm --filter @ai-chat/web test -- runs-page.test.tsx`
Expected: FAIL，当前没有 runtime config 优先级。

- [ ] **Step 3: 在 Web 侧实现运行时配置边界**

```ts
// apps/web/src/lib/env.ts
export function getApiBaseUrl() {
  const runtimeConfig = (window as typeof window & {
    __AI_CHAT_RUNTIME_CONFIG__?: { apiBaseUrl?: string };
  }).__AI_CHAT_RUNTIME_CONFIG__;

  return runtimeConfig?.apiBaseUrl || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
}
```

```js
// apps/web/public/runtime-config.js
window.__AI_CHAT_RUNTIME_CONFIG__ = window.__AI_CHAT_RUNTIME_CONFIG__ || {};
```

- [ ] **Step 4: 为 API / Web 编写最小 multi-stage Dockerfile**

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @ai-chat/api build

FROM node:20-alpine AS production
WORKDIR /app
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/package.json ./package.json
CMD ["node", "dist/main.js"]
```

```dockerfile
# apps/web/Dockerfile
FROM node:20-alpine AS build
WORKDIR /app
COPY . .
RUN corepack enable && pnpm install --frozen-lockfile && pnpm --filter @ai-chat/web build

FROM nginx:alpine AS production
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
COPY apps/web/public/runtime-config.js /usr/share/nginx/html/runtime-config.js
```

- [ ] **Step 5: 调整 compose 注释或服务定义，明确只承担本地依赖**

```yaml
# infra/compose.yaml
services:
  postgres:
    image: postgres:16
  redis:
    image: redis:7
# 仅提供本地 Postgres / Redis，不承担 API / Web 部署职责。
```

- [ ] **Step 6: 回归测试与构建**

Run: `pnpm --filter @ai-chat/web test -- runs-page.test.tsx && pnpm --filter @ai-chat/web build && pnpm --filter @ai-chat/api build`
Expected: 全部 PASS。

- [ ] **Step 7: 提交**

```bash
git add apps/api/src/common/config/env.ts apps/web/src/lib/env.ts apps/web/src/lib/api.ts apps/web/public/runtime-config.js apps/api/Dockerfile apps/web/Dockerfile infra/compose.yaml apps/web/src/__tests__/runs-page.test.tsx
git commit -m "build: tighten runtime config and lightweight docker boundaries"
```

---

### Task 6: 扩展 run 诊断字段与失败原因语义

**Files:**
- Modify: `packages/shared/src/schedule.ts`
- Modify: `apps/api/src/modules/schedule/schedule.service.ts`
- Modify: `apps/api/src/modules/schedule/schedule-runner.service.ts`
- Test: `apps/api/src/modules/schedule/schedule.service.spec.ts`
- Test: `apps/api/test/schedule.e2e-spec.ts`

- [ ] **Step 1: 先写 run 详情诊断字段测试**

```ts
it('returns stage errorCategory triggerSource and durationMs in run details', async () => {
  const run = await service.getRunOrThrow('run-1', 'user-1');

  expect(run).toMatchObject({
    stage: 'TOOL',
    errorCategory: 'EXTERNAL_ERROR',
    triggerSource: 'SCHEDULE',
    durationMs: 5000
  });
});
```

- [ ] **Step 2: 运行 schedule service 测试确认失败**

Run: `pnpm --filter @ai-chat/api test -- schedule.service.spec.ts`
Expected: FAIL。

- [ ] **Step 3: 扩展 shared 与 service summary 映射**

```ts
export interface RunDiagnosticsSummary {
  stage: RunStage;
  errorCategory: ErrorCategory | null;
  triggerSource: 'SCHEDULE' | 'MANUAL_RETRY';
  durationMs: number | null;
  toolExecutionCount: number;
}
```

```ts
private toRunSummary(run: ScheduleRunRecord): ScheduleRunSummary {
  return {
    ...base,
    stage: run.stage,
    errorCategory: run.errorCategory,
    triggerSource: run.triggerSource,
    durationMs: run.startedAt && run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null,
    toolExecutionCount: run.toolExecutions.length
  };
}
```

- [ ] **Step 4: 在 runner 更新阶段字段**

```ts
await this.prisma.scheduleRun.update({
  where: { id: run.id },
  data: { stage: 'AGENT', startedAt: new Date(), status: 'RUNNING' }
});
```

- [ ] **Step 5: 回归 unit + e2e**

Run: `pnpm --filter @ai-chat/api test -- schedule.service.spec.ts schedule-runner.service.spec.ts && pnpm --filter @ai-chat/api test:e2e -- schedule.e2e-spec.ts`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add packages/shared/src/schedule.ts apps/api/src/modules/schedule/schedule.service.ts apps/api/src/modules/schedule/schedule-runner.service.ts apps/api/src/modules/schedule/schedule.service.spec.ts apps/api/test/schedule.e2e-spec.ts
git commit -m "feat(schedule): add run diagnostics fields and failure reasons"
```

---

### Task 7: 扩展 schedule 列表与详情的运维上下文

**Files:**
- Modify: `packages/shared/src/schedule.ts`
- Modify: `apps/api/src/modules/schedule/schedule.controller.ts`
- Modify: `apps/api/src/modules/schedule/schedule.service.ts`
- Modify: `apps/web/src/services/schedule.ts`
- Modify: `apps/web/src/pages/schedules/SchedulesPage.tsx`
- Create: `apps/web/src/components/schedules/ScheduleHealthSummary.tsx`
- Test: `apps/web/src/__tests__/schedules-page.test.tsx`

- [ ] **Step 1: 写 schedules 页面显示 next run / last failure / last result 测试**

```tsx
it('shows schedule health summary with next run and latest failure', async () => {
  render(<SchedulesPage />);
  expect(await screen.findByText(/next run/i)).toBeInTheDocument();
  expect(await screen.findByText(/latest failure/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行页面测试确认失败**

Run: `pnpm --filter @ai-chat/web test -- schedules-page.test.tsx`
Expected: FAIL。

- [ ] **Step 3: 扩展 schedule summary 契约**

```ts
interface ScheduleSummaryBase {
  id: string;
  title: string;
  taskPrompt: string;
  timezone: string;
  enabled: boolean;
  lastRunAt: string | null;
  nextRunAt: string | null;
  latestRunStatus: ScheduleRunStatus | null;
  latestFailureMessage: string | null;
  latestResultSummary: string | null;
  createdAt: string;
  updatedAt: string;
}
```

- [ ] **Step 4: 在 service 聚合最近执行结果**

```ts
const latestRun = schedule.runs[0] ?? null;
return {
  ...base,
  latestRunStatus: latestRun?.status ?? null,
  latestFailureMessage: latestRun?.errorMessage ?? null,
  latestResultSummary: latestRun?.resultSummary ?? null
};
```

- [ ] **Step 5: 在页面拆出轻量健康摘要卡片**

```tsx
export function ScheduleHealthSummary({ schedule }: { schedule: ScheduleSummary }) {
  return (
    <div className="space-y-1 text-sm">
      <div>Next Run: {schedule.nextRunAt ?? '—'}</div>
      <div>Latest Status: {schedule.latestRunStatus ?? '—'}</div>
      <div>Latest Failure: {schedule.latestFailureMessage ?? '—'}</div>
    </div>
  );
}
```

- [ ] **Step 6: 回归页面测试**

Run: `pnpm --filter @ai-chat/web test -- schedules-page.test.tsx`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add packages/shared/src/schedule.ts apps/api/src/modules/schedule/schedule.controller.ts apps/api/src/modules/schedule/schedule.service.ts apps/web/src/services/schedule.ts apps/web/src/pages/schedules/SchedulesPage.tsx apps/web/src/components/schedules/ScheduleHealthSummary.tsx apps/web/src/__tests__/schedules-page.test.tsx
git commit -m "feat(web): surface schedule operational health context"
```

---

### Task 8: 扩展 runs 页面诊断视图与 tool 关联信息

**Files:**
- Modify: `packages/shared/src/schedule.ts`
- Modify: `packages/shared/src/tool.ts`
- Modify: `apps/api/src/modules/tool/tool.service.ts`
- Modify: `apps/api/src/modules/agent/agent.service.ts`
- Modify: `apps/web/src/pages/runs/RunsPage.tsx`
- Modify: `apps/web/src/components/runs/RunList.tsx`
- Create: `apps/web/src/components/runs/RunDiagnosticsCard.tsx`
- Test: `apps/web/src/__tests__/runs-page.test.tsx`

- [ ] **Step 1: 写 runs 页面显示 stage / errorCategory / tool summary 测试**

```tsx
it('shows run diagnostics card with stage error category and tool summary', async () => {
  render(<RunsPage />);
  expect(await screen.findByText(/stage: tool/i)).toBeInTheDocument();
  expect(await screen.findByText(/error category: external_error/i)).toBeInTheDocument();
  expect(await screen.findByText(/tool calls: 2/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行页面测试确认失败**

Run: `pnpm --filter @ai-chat/web test -- runs-page.test.tsx`
Expected: FAIL。

- [ ] **Step 3: 在 shared 契约补 tool 诊断摘要**

```ts
export interface ToolExecutionDigest {
  id: string;
  toolName: ToolName;
  status: ToolExecutionStatus;
  errorCategory: ErrorCategory | null;
}
```

- [ ] **Step 4: API run 详情返回 tool execution 摘要**

```ts
return {
  ...summary,
  toolExecutions: run.toolExecutions.map((item) => ({
    id: item.id,
    toolName: item.toolName,
    status: item.status,
    errorCategory: item.errorCategory
  }))
};
```

- [ ] **Step 5: 新增轻量 RunDiagnosticsCard 并接入详情面板**

```tsx
export function RunDiagnosticsCard({ run }: { run: ScheduleRunSummary }) {
  return (
    <div className="space-y-2 text-sm">
      <div>Stage: {run.stage}</div>
      <div>Error Category: {run.errorCategory ?? '—'}</div>
      <div>Tool Calls: {run.toolExecutions?.length ?? 0}</div>
    </div>
  );
}
```

- [ ] **Step 6: 回归页面测试**

Run: `pnpm --filter @ai-chat/web test -- runs-page.test.tsx`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add packages/shared/src/schedule.ts packages/shared/src/tool.ts apps/api/src/modules/tool/tool.service.ts apps/api/src/modules/agent/agent.service.ts apps/web/src/pages/runs/RunsPage.tsx apps/web/src/components/runs/RunList.tsx apps/web/src/components/runs/RunDiagnosticsCard.tsx apps/web/src/__tests__/runs-page.test.tsx
git commit -m "feat(web): add run diagnostics and tool linkage visibility"
```

---

### Task 9: 暴露多实例 tick 风险与最小 retry/rerun 语义

**Files:**
- Modify: `packages/shared/src/schedule.ts`
- Modify: `apps/api/src/modules/schedule/schedule.controller.ts`
- Modify: `apps/api/src/modules/schedule/schedule.service.ts`
- Modify: `apps/api/src/modules/schedule/schedule-tick.bootstrap.service.ts`
- Modify: `apps/api/src/modules/schedule/schedule-tick.processor.ts`
- Modify: `apps/web/src/pages/runs/RunsPage.tsx`
- Test: `apps/api/src/modules/schedule/schedule.service.spec.ts`
- Test: `apps/web/src/__tests__/runs-page.test.tsx`

- [ ] **Step 1: 写 retry 语义测试，要求显式返回 MANUAL_RETRY triggerSource**

```ts
it('creates rerun with MANUAL_RETRY triggerSource', async () => {
  const rerun = await service.retryRun('run-1', 'user-1');
  expect(rerun).toMatchObject({ triggerSource: 'MANUAL_RETRY' });
});
```

- [ ] **Step 2: 运行 service 测试确认失败**

Run: `pnpm --filter @ai-chat/api test -- schedule.service.spec.ts`
Expected: FAIL。

- [ ] **Step 3: 在 shared 与 API 中明确定义 rerun 语义**

```ts
export interface RetryScheduleRunResponse {
  run: ScheduleRunSummary;
}
```

```ts
@Post('runs/:id/retry')
retryRun(@Req() req, @Param('id') id: string) {
  return this.scheduleService.retryRun(id, req.user.userId);
}
```

- [ ] **Step 4: 在 tick/health 输出当前实例消费提示**

```ts
latestConsumerInstanceId: this.tickMonitor.getLatestInstanceId()
```

- [ ] **Step 5: 在 runs 页面仅增加一个最小 retry 按钮与风险提示文案**

```tsx
<Button disabled={selectedRun?.status === 'RUNNING'} onClick={() => retryRun(selectedRun!.id)}>
  Retry Run
</Button>
<p className="text-xs text-[rgb(var(--foreground-secondary))]">
  Tick may be consumed by another API instance if Redis is shared.
</p>
```

- [ ] **Step 6: 回归 unit + web test**

Run: `pnpm --filter @ai-chat/api test -- schedule.service.spec.ts && pnpm --filter @ai-chat/web test -- runs-page.test.tsx`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add packages/shared/src/schedule.ts apps/api/src/modules/schedule/schedule.controller.ts apps/api/src/modules/schedule/schedule.service.ts apps/api/src/modules/schedule/schedule-tick.bootstrap.service.ts apps/api/src/modules/schedule/schedule-tick.processor.ts apps/web/src/pages/runs/RunsPage.tsx apps/api/src/modules/schedule/schedule.service.spec.ts apps/web/src/__tests__/runs-page.test.tsx
git commit -m "feat(schedule): expose tick instance visibility and manual rerun"
```

---

### Task 10: 实现 refresh token 契约、持久化与续期接口

**Files:**
- Modify: `packages/shared/src/auth.ts`
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/<timestamp>_add_refresh_tokens/migration.sql`
- Modify: `apps/api/src/common/config/env.ts`
- Modify: `apps/api/src/modules/auth/auth.controller.ts`
- Modify: `apps/api/src/modules/auth/auth.service.ts`
- Create: `apps/api/src/modules/auth/dto/refresh-token.dto.ts`
- Test: `apps/api/test/auth.e2e-spec.ts`

- [ ] **Step 1: 先写 auth e2e 测试覆盖 refresh**

```ts
it('POST /auth/refresh returns a new access token for a valid refresh token', async () => {
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
});
```

- [ ] **Step 2: 运行 auth e2e 确认失败**

Run: `pnpm --filter @ai-chat/api test:e2e -- auth.e2e-spec.ts`
Expected: FAIL，缺少 `refreshToken` 字段和 `/auth/refresh` 路由。

- [ ] **Step 3: 扩展 Prisma 与 shared 契约**

```prisma
model RefreshToken {
  id        String   @id @default(cuid())
  tokenHash String   @unique
  userId    String
  expiresAt DateTime
  createdAt DateTime @default(now())
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

```ts
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: UserSummary;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}
```

- [ ] **Step 4: 增加 refresh DTO 与 service 逻辑**

```ts
@Post('refresh')
@HttpCode(200)
refresh(@Body() dto: RefreshTokenDto) {
  return this.authService.refresh(dto.refreshToken);
}
```

```ts
async refresh(refreshToken: string) {
  const tokenRecord = await this.findValidRefreshToken(refreshToken);
  return this.issueTokens(tokenRecord.user);
}
```

- [ ] **Step 5: 在登录/注册响应里一起发 refresh token**

```ts
private async issueTokens(user: UserRecord) {
  const accessToken = this.jwtService.sign({ sub: user.id, email: user.email, role: user.role });
  const refreshToken = randomUUID();
  await this.persistRefreshToken(user.id, refreshToken);
  return { accessToken, refreshToken, user: this.toUserSummary(user) };
}
```

- [ ] **Step 6: 回归 auth e2e**

Run: `pnpm --filter @ai-chat/api db:generate && pnpm --filter @ai-chat/api test:e2e -- auth.e2e-spec.ts`
Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add packages/shared/src/auth.ts apps/api/prisma/schema.prisma apps/api/prisma/migrations apps/api/src/common/config/env.ts apps/api/src/modules/auth/auth.controller.ts apps/api/src/modules/auth/auth.service.ts apps/api/src/modules/auth/dto/refresh-token.dto.ts apps/api/test/auth.e2e-spec.ts
git commit -m "feat(auth): add refresh token flow"
```

---

### Task 11: Web 端接入 refresh token 与 API 续期

**Files:**
- Modify: `apps/web/src/stores/auth-store.ts`
- Modify: `apps/web/src/services/auth.ts`
- Modify: `apps/web/src/lib/api.ts`
- Test: `apps/web/src/__tests__/auth-store.test.ts`

- [ ] **Step 1: 写 auth store 自动续期测试**

```ts
it('stores refresh token and replaces access token after refresh', async () => {
  useAuthStore.getState().setAuth({
    accessToken: 'old-access',
    refreshToken: 'refresh-1',
    user
  });

  await useAuthStore.getState().refreshAuth();

  expect(useAuthStore.getState().accessToken).toBe('new-access');
});
```

- [ ] **Step 2: 运行 store 测试确认失败**

Run: `pnpm --filter @ai-chat/web test -- auth-store.test.ts`
Expected: FAIL。

- [ ] **Step 3: 扩展 auth store 状态与 actions**

```ts
type AuthState = {
  accessToken: string | null;
  refreshToken: string | null;
  user: UserSummary | null;
  setAuth: (payload: { accessToken: string; refreshToken: string; user: UserSummary }) => void;
  refreshAuth: () => Promise<void>;
  clearAuth: () => void;
};
```

- [ ] **Step 4: 在 auth service 与 apiFetch 中接入 refresh**

```ts
export function refreshAuthToken(refreshToken: string) {
  return apiFetch<AuthResponse>('/auth/refresh', {
    method: 'POST',
    body: JSON.stringify({ refreshToken })
  });
}
```

```ts
if (response.status === 401 && authStore.refreshToken) {
  await authStore.refreshAuth();
}
```

- [ ] **Step 5: 回归 auth-store 测试**

Run: `pnpm --filter @ai-chat/web test -- auth-store.test.ts`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/stores/auth-store.ts apps/web/src/services/auth.ts apps/web/src/lib/api.ts apps/web/src/__tests__/auth-store.test.ts
git commit -m "feat(web): wire refresh token auth renewal"
```

---

### Task 12: 新增 settings 页面并接入导航

**Files:**
- Modify: `apps/web/src/router/index.tsx`
- Create: `apps/web/src/pages/settings/SettingsPage.tsx`
- Modify: `apps/web/src/components/layout/AppShell.tsx`
- Test: `apps/web/src/__tests__/runs-page.test.tsx`

- [ ] **Step 1: 写 settings 路由与导航测试**

```tsx
it('shows settings link for authenticated users', async () => {
  render(<AppShell><div>Body</div></AppShell>);
  expect(screen.getByRole('link', { name: 'Settings' })).toHaveAttribute('href', '/settings');
});
```

- [ ] **Step 2: 运行相关 web 测试确认失败**

Run: `pnpm --filter @ai-chat/web test -- runs-page.test.tsx`
Expected: FAIL 或缺少路由。

- [ ] **Step 3: 新增明确边界的 settings 页面**

```tsx
export function SettingsPage() {
  return (
    <AppShell>
      <Card className="p-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="mt-1 text-sm text-[rgb(var(--foreground-secondary))]">
          仅放用户会话与界面相关设置，不承载 schedule 或 admin 杂项。
        </p>
      </Card>
    </AppShell>
  );
}
```

- [ ] **Step 4: 在 router 与 AppShell 中接入**

```tsx
{ path: 'settings', element: <SettingsPage /> }
```

```tsx
{ label: 'Settings', to: '/settings' }
```

- [ ] **Step 5: 回归测试**

Run: `pnpm --filter @ai-chat/web test -- runs-page.test.tsx schedules-page.test.tsx`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/router/index.tsx apps/web/src/pages/settings/SettingsPage.tsx apps/web/src/components/layout/AppShell.tsx apps/web/src/__tests__/runs-page.test.tsx
git commit -m "feat(web): add scoped settings page"
```

---

### Task 13: 补聊天页异常态、恢复态、空态与 tool 展示关系

**Files:**
- Modify: `apps/web/src/pages/chat/ChatPage.tsx`
- Modify: `apps/web/src/stores/chat-store.ts`
- Modify: `apps/web/src/components/chat/*`
- Test: `apps/web/src/__tests__/chat-page.test.tsx`

- [ ] **Step 1: 写 chat 页面空态/失败态/恢复态测试**

```tsx
it('shows empty state before first message and recovery action after failed stream', async () => {
  render(<ChatPage />);
  expect(await screen.findByText(/start a conversation/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /retry last message/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行 chat 页面测试确认失败**

Run: `pnpm --filter @ai-chat/web test -- chat-page.test.tsx`
Expected: FAIL。

- [ ] **Step 3: 在 chat store 中显式建模 UI 状态**

```ts
type StreamUiState = 'IDLE' | 'STREAMING' | 'FAILED';
```

```ts
setStreamFailed(errorMessage: string) {
  set({ streamUiState: 'FAILED', streamErrorMessage: errorMessage });
}
```

- [ ] **Step 4: 在 ChatPage 与展示组件中接入轻量恢复交互**

```tsx
{streamUiState === 'IDLE' && messages.length === 0 ? <EmptyState /> : null}
{streamUiState === 'FAILED' ? <RetryBanner onRetry={retryLastMessage} /> : null}
```

- [ ] **Step 5: 回归 chat 页面测试**

Run: `pnpm --filter @ai-chat/web test -- chat-page.test.tsx`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/pages/chat/ChatPage.tsx apps/web/src/stores/chat-store.ts apps/web/src/components/chat apps/web/src/__tests__/chat-page.test.tsx
git commit -m "feat(chat): improve empty failed and recovery states"
```

---

### Task 14: 优化 runs / schedules 页面可读性与关键文案

**Files:**
- Modify: `apps/web/src/pages/runs/RunsPage.tsx`
- Modify: `apps/web/src/pages/schedules/SchedulesPage.tsx`
- Modify: `apps/web/src/components/runs/RunList.tsx`
- Modify: `apps/web/src/components/schedules/ScheduleForm.tsx`
- Test: `apps/web/src/__tests__/runs-page.test.tsx`
- Test: `apps/web/src/__tests__/schedules-page.test.tsx`

- [ ] **Step 1: 写状态标签与错误摘要可读性测试**

```tsx
it('renders human-readable status labels for runs and schedules', async () => {
  render(<RunsPage />);
  expect(await screen.findByText(/Succeeded/i)).toBeInTheDocument();
  expect(await screen.findByText(/Failed/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行页面测试确认失败或文案不匹配**

Run: `pnpm --filter @ai-chat/web test -- runs-page.test.tsx schedules-page.test.tsx`
Expected: FAIL 或断言不匹配。

- [ ] **Step 3: 抽最小状态文案映射，不做额外抽象层**

```ts
const runStatusLabel: Record<ScheduleRunStatus, string> = {
  PENDING: 'Pending',
  RUNNING: 'Running',
  SUCCEEDED: 'Succeeded',
  FAILED: 'Failed'
};
```

- [ ] **Step 4: 在详情面板与列表中统一使用映射文案**

```tsx
<div>Status: {runStatusLabel[selectedRun.status]}</div>
<div>Latest Status: {schedule.latestRunStatus ? runStatusLabel[schedule.latestRunStatus] : '—'}</div>
```

- [ ] **Step 5: 回归页面测试**

Run: `pnpm --filter @ai-chat/web test -- runs-page.test.tsx schedules-page.test.tsx`
Expected: PASS。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/pages/runs/RunsPage.tsx apps/web/src/pages/schedules/SchedulesPage.tsx apps/web/src/components/runs/RunList.tsx apps/web/src/components/schedules/ScheduleForm.tsx apps/web/src/__tests__/runs-page.test.tsx apps/web/src/__tests__/schedules-page.test.tsx
git commit -m "feat(web): improve run and schedule readability"
```

---

### Task 15: 补 P0-P5 Web automated tests 矩阵与最终浏览器验收脚本

**Files:**
- Create: `docs/superpowers/plans/2026-03-31-unified-improvement-browser-e2e-matrix.md`
- Modify: `apps/web/src/__tests__/auth-store.test.ts`
- Modify: `apps/web/src/__tests__/chat-page.test.tsx`
- Modify: `apps/web/src/__tests__/runs-page.test.tsx`
- Modify: `apps/web/src/__tests__/schedules-page.test.tsx`

- [ ] **Step 1: 先写 P0-P5 用例矩阵文档**

```md
# Browser E2E Matrix

- P0: 登录成功并进入 `/chat`
- P1: 聊天发送消息并看到流式结果 / tool 卡片
- P2: 创建 schedule、启用、查看 next run 和最新结果
- P3: runs 页查看失败原因、stage、tool summary，并执行 retry
- P4: access token 过期后通过 refresh token 自动恢复请求
- P5: 空态、失败态、恢复态、受保护路由、权限边界
```

- [ ] **Step 2: 把对应 automated tests 补到现有 web 测试文件**

```tsx
it('redirects protected routes when auth is missing', async () => {
  await router.navigate('/runs');
  render(<RouterProvider router={router} />);
  expect(await screen.findByText(/Welcome to AI Chat/i)).toBeInTheDocument();
});
```

- [ ] **Step 3: 运行 web 全量测试**

Run: `pnpm --filter @ai-chat/web test`
Expected: PASS。

- [ ] **Step 4: 执行 web build 作为浏览器验收前置**

Run: `pnpm --filter @ai-chat/web build`
Expected: PASS。

- [ ] **Step 5: 提交**

```bash
git add docs/superpowers/plans/2026-03-31-unified-improvement-browser-e2e-matrix.md apps/web/src/__tests__/auth-store.test.ts apps/web/src/__tests__/chat-page.test.tsx apps/web/src/__tests__/runs-page.test.tsx apps/web/src/__tests__/schedules-page.test.tsx
git commit -m "test(web): add p0-p5 browser validation matrix"
```

---

### Task 16: 执行全量验证、环境清理并产出最终验收报告

**Files:**
- Modify: `docs/superpowers/plans/2026-03-31-unified-improvement.md`
- Create: `docs/superpowers/plans/2026-03-31-unified-improvement-report.md`

- [x] **Step 1: 运行 API 自动化回归**

Run: `pnpm --filter @ai-chat/api test && pnpm --filter @ai-chat/api test:e2e -- auth.e2e-spec.ts && pnpm --filter @ai-chat/api test:e2e -- schedule.e2e-spec.ts`
Expected: PASS。

- [x] **Step 2: 运行 Web 自动化回归**

Run: `pnpm --filter @ai-chat/web test && pnpm --filter @ai-chat/web build`
Expected: PASS。

- [x] **Step 3: 用 agent-browser 执行最终 Web 浏览器验收（P0-P5）**

```md
Use agent-browser to execute:
1. P0 登录并验证 `/chat` 默认入口。
2. P1 发送聊天消息，验证流式文本与 tool execution 展示。
3. P2 创建 schedule，查看启用状态、next run、最近结果。
4. P3 打开 runs，验证失败原因、stage、tool summary，并尝试 retry。
5. P4 模拟 access token 失效后的自动 refresh。
6. P5 验证 settings、空态、失败态、恢复态、受保护路由与 admin 边界。
```

- [x] **Step 4: 清理测试数据并关闭相关服务**

```bash
pnpm db:down
```

```md
同时执行以下收尾动作：
- 删除或回滚本轮浏览器验收与自动化测试创建的测试 schedule / run / chat session / refresh token 等测试数据。
- 关闭本轮为联调或验收额外启动的 API、Web、本地容器或其他相关服务。
- 确认本地不再残留多实例 API/Web 进程，避免后续继续误消费同一个 Redis tick。
```

- [x] **Step 5: 写最终报告**

```md
# Unified Improvement Report

## Automated Validation
- `pnpm --filter @ai-chat/api test`
- `pnpm --filter @ai-chat/api test:e2e -- auth.e2e-spec.ts`
- `pnpm --filter @ai-chat/api test:e2e -- schedule.e2e-spec.ts`
- `pnpm --filter @ai-chat/web test`
- `pnpm --filter @ai-chat/web build`

## Browser Validation
- P0: PASS
- P1: PASS
- P2: PASS
- P3: PASS
- P4: PASS
- P5: PASS

## Cleanup
- Test data: CLEARED
- Extra services/processes: STOPPED
```

- [ ] **Step 6: 提交**

```bash
git add docs/superpowers/plans/2026-03-31-unified-improvement.md docs/superpowers/plans/2026-03-31-unified-improvement-report.md
git commit -m "docs: add unified improvement validation report"
```

---

## Self-Review Checklist

- Spec coverage: Phase 1/2/3、automated tests、Web `agent-browser` e2e、P0-P5 覆盖、Docker 运行边界都已落到独立任务。
- Placeholder scan: 未保留 TBD/TODO/fill later；所有任务都给了明确文件、测试、命令、最小代码示例。
- Type consistency: `ErrorCategory`、`RunStage`、`triggerSource`、`refreshToken`、`latestRunStatus` 在 shared / API / Web 任务中保持同名。
