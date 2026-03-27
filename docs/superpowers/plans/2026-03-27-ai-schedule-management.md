# AI Schedule Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让用户能在聊天里通过单一 `manage_schedule` tool 创建、查询、修改、启停、删除 schedule，并与现有 `/schedules` 看板共用同一真相源。

**Architecture:** 继续复用现有 `ScheduleService`、`ScheduleController`、`/schedules` 页面和 shared 契约层，不新增第二套 AI 专属调度系统。新增一个 schema-first 的 `manage_schedule` tool，内部按 `action` 分发到现有 schedule 业务服务；补上缺失的删除 API、前端删除入口、以及 agent 在 schedule 管理对话里的行为约束。

**Tech Stack:** NestJS、Prisma、Zod、LangChainJS、React、Vite、Zustand、Jest、Supertest

---

## File Map

### API
- Modify: `apps/api/src/modules/schedule/schedule.controller.ts`
  - 增加 `DELETE /schedules/:id`
- Modify: `apps/api/src/modules/schedule/schedule.service.ts`
  - 增加 `deleteSchedule(userId, scheduleId)`，继续复用现有 owner 校验模式
- Modify: `apps/api/src/modules/schedule/schedule.service.spec.ts`
  - 补 delete service 单测
- Modify: `apps/api/test/schedule.e2e-spec.ts`
  - 补 delete API 鉴权 / owner / 成功路径测试
- Modify: `apps/api/src/modules/tool/tool.service.ts`
  - 注册 `manage_schedule`
- Modify: `apps/api/src/modules/tool/tool.service.spec.ts`
  - 补 tool 注册 / 执行分发测试
- Create: `apps/api/src/modules/tool/tools/manage-schedule.tool.ts`
  - 单一 schedule 管理 tool，内部按 `action` 分发
- Modify: `apps/api/src/modules/agent/agent.service.ts`
  - 补系统提示词/行为约束，让 agent 在 schedule 管理场景先 list、delete 前确认、信息不足时追问

### Shared
- Modify: `packages/shared/src/schedule.ts`
  - 增加 `DeleteScheduleResponse`
  - 明确复用现有命名：`CRON | ONE_TIME`、`taskPrompt`、`cronExpr`、`runAt`

### Web
- Modify: `apps/web/src/services/schedule.ts`
  - 增加 `deleteSchedule`
- Modify: `apps/web/src/components/schedules/ScheduleForm.tsx`
  - 给 `ScheduleList` 增加删除按钮回调
- Modify: `apps/web/src/pages/schedules/SchedulesPage.tsx`
  - 接入删除确认、删除 API、本地列表同步移除

### Tests / Validation
- Modify: `apps/api/test/schedule.e2e-spec.ts`
- Modify: `apps/api/src/modules/schedule/schedule.service.spec.ts`
- Modify: `apps/api/src/modules/tool/tool.service.spec.ts`
- Optional verify later with browser: `apps/web` 实际页面 + 聊天页 + `/schedules`

## Important Alignment Notes

- 不要把 spec 草案中的 `INTERVAL | ONCE | prompt | cronExpression` 直接落到代码里。
- 当前代码真相源是：
  - `ScheduleType = 'CRON' | 'ONE_TIME'`
  - 文本字段是 `taskPrompt`
  - cron 字段是 `cronExpr`
  - one-time 字段是 `runAt`
- 本次 MVP 不引入 `INTERVAL`；自然语言里像“每10秒”如果当前业务层不支持，应由 agent 追问或先转成用户可接受的现有类型方案，除非实现阶段明确要扩展 shared + Prisma + schedule utils（本计划不做）。
- `manage_schedule` 的 schema 应严格映射现有能力，避免设计文档和当前代码命名漂移。

---

### Task 1: 补齐 shared 删除契约

**Files:**
- Modify: `packages/shared/src/schedule.ts`
- Test: `apps/api/test/schedule.e2e-spec.ts`

- [ ] **Step 1: 先读当前 shared schedule 契约并定位插入点**

确认以下现状仍成立：

```ts
export type ScheduleType = 'CRON' | 'ONE_TIME';

export interface ListSchedulesResponse {
  schedules: ScheduleSummary[];
}
```

- [ ] **Step 2: 为删除接口增加 shared 响应类型**

在 `packages/shared/src/schedule.ts` 增加：

```ts
export interface DeleteScheduleResponse {
  deletedScheduleId: string;
}
```

并保持该文件继续从 `packages/shared/src/index.ts` 间接导出。

- [ ] **Step 3: 运行受影响类型检查或 build 验证 shared 契约未破坏**

Run:

```bash
pnpm --filter @ai-chat/shared build
```

Expected: build 成功；若该 workspace 没有独立 build 脚本，则在后续 API / Web build 中覆盖验证。

- [ ] **Step 4: 提交这一小步**

```bash
git add packages/shared/src/schedule.ts
git commit -m "feat: add schedule delete response contract"
```

---

### Task 2: 为 ScheduleService 增加 delete 能力

**Files:**
- Modify: `apps/api/src/modules/schedule/schedule.service.ts`
- Modify: `apps/api/src/modules/schedule/schedule.service.spec.ts`

- [ ] **Step 1: 先写 failing test，约束删除成功路径**

在 `apps/api/src/modules/schedule/schedule.service.spec.ts` 增加类似测试：

```ts
it('deletes an owned schedule', async () => {
  const schedule = createScheduleRecord();
  const findFirst = jest.fn().mockResolvedValue(schedule);
  const deleteFn = jest.fn().mockResolvedValue(schedule);
  const prisma = {
    schedule: {
      findFirst,
      delete: deleteFn
    }
  };

  const service = new ScheduleService(prisma as never);

  await service.deleteSchedule(userId, schedule.id);

  expect(findFirst).toHaveBeenCalledWith({
    where: { id: schedule.id, userId }
  });
  expect(deleteFn).toHaveBeenCalledWith({
    where: { id: schedule.id }
  });
});
```

- [ ] **Step 2: 再写 failing test，约束 owner / not found 行为**

继续增加：

```ts
it('throws NotFoundException when deleting a missing schedule', async () => {
  const prisma = {
    schedule: {
      findFirst: jest.fn().mockResolvedValue(null)
    }
  };

  const service = new ScheduleService(prisma as never);

  await expect(service.deleteSchedule(userId, 'missing')).rejects.toBeInstanceOf(NotFoundException);
});
```

- [ ] **Step 3: 先跑单测，确认当前失败**

Run:

```bash
pnpm --filter @ai-chat/api test -- schedule.service.spec.ts
```

Expected: FAIL，提示 `deleteSchedule` 不存在或断言未满足。

- [ ] **Step 4: 在 service 中实现最小删除逻辑**

在 `apps/api/src/modules/schedule/schedule.service.ts` 增加：

```ts
async deleteSchedule(userId: string, scheduleId: string) {
  await this.getScheduleOrThrow(userId, scheduleId);

  await this.prisma.schedule.delete({
    where: { id: scheduleId }
  });
}
```

要求：
- 继续复用 `getScheduleOrThrow` 做存在性与 owner 校验
- 不增加多余返回值，控制器层返回 `{ deletedScheduleId }`

- [ ] **Step 5: 再跑 service 单测，确认通过**

Run:

```bash
pnpm --filter @ai-chat/api test -- schedule.service.spec.ts
```

Expected: PASS

- [ ] **Step 6: 提交这一小步**

```bash
git add apps/api/src/modules/schedule/schedule.service.ts apps/api/src/modules/schedule/schedule.service.spec.ts
git commit -m "feat: add schedule deletion service"
```

---

### Task 3: 暴露 DELETE /schedules/:id API

**Files:**
- Modify: `apps/api/src/modules/schedule/schedule.controller.ts`
- Modify: `apps/api/test/schedule.e2e-spec.ts`
- Modify: `packages/shared/src/schedule.ts`

- [ ] **Step 1: 先写 failing e2e，约束未认证访问被拒绝**

在 `apps/api/test/schedule.e2e-spec.ts` 的 auth 覆盖中补：

```ts
await request(app.getHttpServer()).delete('/schedules/any-id').expect(401);
```

- [ ] **Step 2: 再写 failing e2e，约束删除自己的 schedule 成功**

加入类似测试：

```ts
it('deletes an owned schedule', async () => {
  const user = await registerUser('schedule-delete@example.com');

  await prisma.schedule.create({
    data: {
      id: 'delete-me',
      userId: user.userId,
      title: 'Delete me',
      taskPrompt: 'Delete me',
      type: 'ONE_TIME',
      cronExpr: null,
      runAt: new Date('2026-03-28T09:00:00.000Z'),
      timezone: 'UTC',
      enabled: true,
      nextRunAt: new Date('2026-03-28T09:00:00.000Z')
    }
  });

  await request(app.getHttpServer())
    .delete('/schedules/delete-me')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .expect(200)
    .expect({ deletedScheduleId: 'delete-me' });

  await expect(
    prisma.schedule.findUniqueOrThrow({ where: { id: 'delete-me' } })
  ).rejects.toThrow();
});
```

- [ ] **Step 3: 再写 failing e2e，约束不能删除别人的 schedule**

加入类似测试：

```ts
it('does not delete another users schedule', async () => {
  const user = await registerUser('schedule-owner@example.com');
  const otherUser = await registerUser('schedule-other@example.com');

  await prisma.schedule.create({
    data: {
      id: 'others-schedule',
      userId: otherUser.userId,
      title: 'Other',
      taskPrompt: 'Other',
      type: 'ONE_TIME',
      cronExpr: null,
      runAt: new Date('2026-03-28T09:00:00.000Z'),
      timezone: 'UTC',
      enabled: true,
      nextRunAt: new Date('2026-03-28T09:00:00.000Z')
    }
  });

  await request(app.getHttpServer())
    .delete('/schedules/others-schedule')
    .set('Authorization', `Bearer ${user.accessToken}`)
    .expect(404);
});
```

- [ ] **Step 4: 先跑 e2e，确认当前失败**

Run:

```bash
pnpm --filter @ai-chat/api test:e2e -- schedule.e2e-spec.ts
```

Expected: FAIL，提示 DELETE 路由不存在。

- [ ] **Step 5: 在 controller 增加删除路由**

把 import 改成包含 `Delete`：

```ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
```

并新增：

```ts
@Delete('schedules/:id')
async deleteSchedule(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
  await this.scheduleService.deleteSchedule(user.userId, id);
  return { deletedScheduleId: id };
}
```

- [ ] **Step 6: 再跑 e2e，确认删除 API 通过**

Run:

```bash
pnpm --filter @ai-chat/api test:e2e -- schedule.e2e-spec.ts
```

Expected: PASS

- [ ] **Step 7: 提交这一小步**

```bash
git add apps/api/src/modules/schedule/schedule.controller.ts apps/api/test/schedule.e2e-spec.ts packages/shared/src/schedule.ts
git commit -m "feat: add schedule delete api"
```

---

### Task 4: 新增 manage_schedule tool 的 schema 与执行分发

**Files:**
- Create: `apps/api/src/modules/tool/tools/manage-schedule.tool.ts`
- Modify: `apps/api/src/modules/tool/tool.service.ts`
- Modify: `apps/api/src/modules/tool/tool.service.spec.ts`
- Modify: `apps/api/src/modules/tool/tool.types.ts`（仅当需要更精准类型辅助时）
- Modify: `packages/shared/src/schedule.ts`（如果 tool 输出需要复用现有 summary / delete response）

- [ ] **Step 1: 先写 failing test，约束 tool 被注册**

在 `apps/api/src/modules/tool/tool.service.spec.ts` 增加：

```ts
it('registers manage_schedule definition', async () => {
  const prisma = {
    toolExecution: {
      create: jest.fn(),
      update: jest.fn()
    }
  };

  const { ToolService } = await import('./tool.service');
  const service = new ToolService(prisma as never);

  expect(service.getDefinition('manage_schedule')).toBeTruthy();
});
```

- [ ] **Step 2: 再写 failing test，约束 list action 会走 ScheduleService.listSchedules**

新增一个对新 tool 文件的测试，或继续在 `tool.service.spec.ts` 中用真实 tool execute 测：

```ts
it('runs manage_schedule list action', async () => {
  const createdExecution = {
    id: 'tool-execution-3',
    sessionId: 'session-1',
    toolName: 'manage_schedule',
    status: 'RUNNING',
    input: { action: 'list' },
    output: null,
    errorMessage: null,
    startedAt: new Date('2026-03-27T10:00:00.000Z'),
    finishedAt: null
  };
  const updatedExecution = {
    ...createdExecution,
    status: 'SUCCEEDED',
    output: JSON.stringify({ schedules: [] }),
    finishedAt: new Date('2026-03-27T10:00:01.000Z')
  };
  const prisma = {
    toolExecution: {
      create: jest.fn().mockResolvedValue(createdExecution),
      update: jest.fn().mockResolvedValue(updatedExecution)
    }
  };

  const { ToolService } = await import('./tool.service');
  const service = new ToolService(prisma as never);
  const started = await service.startToolExecution('manage_schedule', { action: 'list' }, {
    sessionId: 'session-1',
    userId: 'user-1'
  });

  await expect(started.run()).resolves.toMatchObject({
    execution: updatedExecution,
    outputText: JSON.stringify({ schedules: [] })
  });
});
```

> 如果当前 `ToolService` 构造方式无法直接注入 `ScheduleService`，这里就是一个信号：先小范围重构 `ToolService` 的构造注入，但只做到能注册新 tool，不做更大抽象。

- [ ] **Step 3: 先跑 tool 测试，确认当前失败**

Run:

```bash
pnpm --filter @ai-chat/api test -- tool.service.spec.ts
```

Expected: FAIL，提示没有 `manage_schedule`。

- [ ] **Step 4: 创建 manage-schedule.tool.ts，严格映射现有 schedule 能力**

在 `apps/api/src/modules/tool/tools/manage-schedule.tool.ts` 中实现类似结构：

```ts
import { z } from 'zod';
import type { DeleteScheduleResponse, ListSchedulesResponse, ScheduleSummary, UpdateScheduleRequest } from '@ai-chat/shared';
import { ScheduleService } from '../../schedule/schedule.service';
import type { ToolDefinition, ToolExecutionContext } from '../tool.types';

const manageScheduleSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    title: z.string().min(1),
    taskPrompt: z.string().min(1),
    type: z.enum(['CRON', 'ONE_TIME']),
    cronExpr: z.string().min(1).optional(),
    runAt: z.string().datetime().optional(),
    timezone: z.string().min(1).optional()
  }),
  z.object({
    action: z.literal('list'),
    enabled: z.boolean().optional(),
    type: z.enum(['CRON', 'ONE_TIME']).optional()
  }),
  z.object({
    action: z.literal('update'),
    scheduleId: z.string().min(1),
    title: z.string().min(1).optional(),
    taskPrompt: z.string().min(1).optional(),
    type: z.enum(['CRON', 'ONE_TIME']).optional(),
    cronExpr: z.string().min(1).optional(),
    runAt: z.string().datetime().optional(),
    timezone: z.string().min(1).optional(),
    enabled: z.boolean().optional()
  }),
  z.object({
    action: z.literal('delete'),
    scheduleId: z.string().min(1)
  }),
  z.object({
    action: z.literal('enable'),
    scheduleId: z.string().min(1)
  }),
  z.object({
    action: z.literal('disable'),
    scheduleId: z.string().min(1)
  })
]);
```

并导出工厂函数而不是裸对象，避免全局单例里硬编码 service：

```ts
export function createManageScheduleTool(scheduleService: ScheduleService): ToolDefinition {
  return {
    name: 'manage_schedule',
    description: 'Create, list, update, enable, disable, or delete schedules for the current user.',
    schema: manageScheduleSchema,
    async execute(input, context) {
      switch (input.action) {
        case 'create':
          return { schedule: await scheduleService.createSchedule(context.userId, input) };
        case 'list': {
          const result = await scheduleService.listSchedules(context.userId, {
            enabled: input.enabled,
            type: input.type
          });
          return { schedules: result.schedules };
        }
        case 'update': {
          const { scheduleId, ...payload } = input;
          return { schedule: await scheduleService.updateSchedule(context.userId, scheduleId, payload as UpdateScheduleRequest) };
        }
        case 'delete':
          await scheduleService.deleteSchedule(context.userId, input.scheduleId);
          return { deletedScheduleId: input.scheduleId };
        case 'enable':
          return { schedule: await scheduleService.enableSchedule(context.userId, input.scheduleId) };
        case 'disable':
          return { schedule: await scheduleService.disableSchedule(context.userId, input.scheduleId) };
      }
    }
  };
}
```

约束：
- 只支持现有 `CRON | ONE_TIME`
- 只复用现有 `taskPrompt / cronExpr / runAt`
- 不在 tool 层重复 owner / existence 手写校验，交给 `ScheduleService`

- [ ] **Step 5: 在 ToolService 注册新 tool**

把 `ToolService` 从只注册 `get_current_time` 改成同时注册 `manage_schedule`。推荐结构：

```ts
@Injectable()
export class ToolService {
  private readonly tools = new Map<string, ToolDefinition>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly scheduleService: ScheduleService
  ) {
    const definitions = [
      getCurrentTimeTool,
      createManageScheduleTool(this.scheduleService)
    ];

    for (const definition of definitions) {
      this.tools.set(definition.name, definition);
    }
  }
}
```

如因此需要调整 module 注入，也只做最小修改，确保 `ToolModule` 能拿到 `ScheduleService` 或 `ScheduleModule` 导出的 provider。

- [ ] **Step 6: 再跑 tool 单测，确认通过**

Run:

```bash
pnpm --filter @ai-chat/api test -- tool.service.spec.ts
```

Expected: PASS

- [ ] **Step 7: 提交这一小步**

```bash
git add apps/api/src/modules/tool/tool.service.ts apps/api/src/modules/tool/tool.service.spec.ts apps/api/src/modules/tool/tools/manage-schedule.tool.ts
git commit -m "feat: add manage schedule tool"
```

---

### Task 5: 让 agent 在 schedule 管理对话中遵循安全行为规则

**Files:**
- Modify: `apps/api/src/modules/agent/agent.service.ts`
- Optionally inspect: `apps/api/src/modules/llm/*`
- Test: 先以受影响单测/构建验证为主

- [ ] **Step 1: 先定位当前系统提示词或 agent instruction 拼接点**

先在 `apps/api/src/modules/agent/agent.service.ts` 中找到给模型的固定指令文本。如果没有明确 system message，就在最小影响位置补一段固定 instruction。

- [ ] **Step 2: 写最小指令，约束 schedule 管理行为**

加入类似规则：

```ts
const scheduleManagementRules = [
  'When managing schedules, use the manage_schedule tool.',
  'If the user asks to list or inspect schedules, call manage_schedule with action=list.',
  'Before update, enable, disable, or delete, list schedules first when the target is ambiguous.',
  'If multiple schedules could match, ask a clarifying question instead of guessing.',
  'Before deleting a schedule, ask for confirmation after identifying the exact schedule.',
  'If required scheduling details are missing, ask a follow-up question instead of inventing values.'
].join('\n');
```

要求：
- 只补 schedule 管理相关行为，不要重写整个 agent prompt 系统
- delete 前确认必须明确
- update/delete/enable/disable 在目标模糊时先 list

- [ ] **Step 3: 跑受影响测试或 build，确认没有破坏 agent wiring**

Run:

```bash
pnpm --filter @ai-chat/api build
```

Expected: PASS

- [ ] **Step 4: 提交这一小步**

```bash
git add apps/api/src/modules/agent/agent.service.ts
git commit -m "feat: guide agent schedule management behavior"
```

---

### Task 6: Web 补 deleteSchedule service 与列表删除入口

**Files:**
- Modify: `apps/web/src/services/schedule.ts`
- Modify: `apps/web/src/components/schedules/ScheduleForm.tsx`
- Modify: `apps/web/src/pages/schedules/SchedulesPage.tsx`

- [ ] **Step 1: 先写前端最小行为变更，明确删除 service 接口**

在 `apps/web/src/services/schedule.ts` 增加：

```ts
import type { DeleteScheduleResponse } from '@ai-chat/shared';

export function deleteSchedule(accessToken: string, id: string) {
  return apiFetch<DeleteScheduleResponse>(`/schedules/${id}`, {
    method: 'DELETE',
    accessToken
  });
}
```

- [ ] **Step 2: 给 ScheduleList 增加删除回调参数**

在 `apps/web/src/components/schedules/ScheduleForm.tsx` 的 `ScheduleList` props 中新增：

```tsx
export function ScheduleList(props: {
  schedules: ScheduleSummary[];
  onToggle: (schedule: ScheduleSummary) => Promise<void>;
  onEdit: (schedule: ScheduleSummary) => void;
  onDelete: (schedule: ScheduleSummary) => Promise<void>;
}) {
```

并在每个条目里增加按钮：

```tsx
<button onClick={() => props.onDelete(schedule)}>Delete</button>
```

- [ ] **Step 3: 在 SchedulesPage 接入删除确认与本地状态同步**

在 `apps/web/src/pages/schedules/SchedulesPage.tsx` 中：

```tsx
import {
  createSchedule,
  deleteSchedule,
  disableSchedule,
  enableSchedule,
  listSchedules,
  updateSchedule
} from '../../services/schedule';
```

新增处理函数：

```tsx
async function handleDelete(schedule: ScheduleSummary) {
  if (!accessToken) {
    return;
  }

  const confirmed = window.confirm(`Delete schedule "${schedule.title}"?`);
  if (!confirmed) {
    return;
  }

  await deleteSchedule(accessToken, schedule.id);
  setSchedules((current) => current.filter((item) => item.id !== schedule.id));
  if (editingSchedule?.id === schedule.id) {
    setEditingSchedule(null);
  }
}
```

并传给列表：

```tsx
<ScheduleList
  schedules={schedules}
  onToggle={handleToggle}
  onEdit={setEditingSchedule}
  onDelete={handleDelete}
/>
```

- [ ] **Step 4: 跑 web 测试或 build，确认前端通过**

Run:

```bash
pnpm --filter @ai-chat/web build
```

Expected: PASS

- [ ] **Step 5: 提交这一小步**

```bash
git add apps/web/src/services/schedule.ts apps/web/src/components/schedules/ScheduleForm.tsx apps/web/src/pages/schedules/SchedulesPage.tsx
git commit -m "feat: add schedule deletion to web board"
```

---

### Task 7: 补完整回归测试并做最终验证

**Files:**
- Modify: `apps/api/src/modules/schedule/schedule.service.spec.ts`
- Modify: `apps/api/src/modules/tool/tool.service.spec.ts`
- Modify: `apps/api/test/schedule.e2e-spec.ts`

- [ ] **Step 1: 跑 API 相关测试**

Run:

```bash
pnpm --filter @ai-chat/api test -- schedule.service.spec.ts
pnpm --filter @ai-chat/api test -- tool.service.spec.ts
pnpm --filter @ai-chat/api test:e2e -- schedule.e2e-spec.ts
```

Expected: 全部 PASS

- [ ] **Step 2: 跑受影响 workspace build**

Run:

```bash
pnpm --filter @ai-chat/api build
pnpm --filter @ai-chat/web build
```

Expected: 全部 PASS

- [ ] **Step 3: 用真实浏览器做最终验收**

按用户偏好，优先用 `agent-browser` 验证以下流程：

1. 登录 Web
2. 在聊天页输入与 schedule 管理相关的明确请求
3. 验证 agent 是否调用 `manage_schedule`
4. 打开 `/schedules` 页面确认新任务出现
5. 在 `/schedules` 页面执行删除，确认列表移除

如果当前 agent 还不能稳定从“每10秒”映射到现有 `CRON | ONE_TIME` 能力，浏览器验收时改用一个现有能力明确支持的请求，例如：
- “帮我创建一个明天上午 9 点执行一次的任务，标题为 Morning summary，内容是 Summarize unread issues”
- “列出我当前的定时任务”

- [ ] **Step 4: 记录验证结果后提交最终功能**

```bash
git add apps/api/src/modules/schedule/schedule.service.spec.ts apps/api/src/modules/tool/tool.service.spec.ts apps/api/test/schedule.e2e-spec.ts
git commit -m "test: cover ai schedule management flow"
```

---

## Final Verification Checklist

- [ ] `DELETE /schedules/:id` 已存在且受 JWT 保护
- [ ] `ScheduleService.deleteSchedule(userId, scheduleId)` 只允许删除自己的任务
- [ ] `manage_schedule` 已注册到 `ToolService`
- [ ] `manage_schedule` schema 使用 Zod `discriminatedUnion('action', ...)`
- [ ] tool 字段名与当前代码真实契约一致：`taskPrompt / cronExpr / runAt / CRON / ONE_TIME`
- [ ] agent 对 schedule 管理遵守：信息不足追问、目标模糊先 list、delete 前确认
- [ ] `/schedules` 页面可以删除任务，并同步更新本地状态
- [ ] API tests / e2e / builds 通过
- [ ] 浏览器联调通过至少一条 create + list + delete 主路径
