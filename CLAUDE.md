# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

这是一个 `pnpm workspace + Turborepo` 的 monorepo，目标是构建 AI 聊天平台。

当前代码已经不只是“auth 骨架”。仓库现状是：
- `apps/api`：NestJS API，已实现健康检查、用户注册/登录、JWT 鉴权、基础 RBAC、聊天会话/消息查询、`/chat/stream` 流式聊天接口、tool execution 持久化
- `apps/web`：React + Vite Web，已实现登录页、认证状态持久化、受保护路由、管理员路由、聊天页、会话侧栏、流式消息渲染、工具执行状态展示
- `packages/shared`：前后端共享 auth / user / chat / tool 类型
- `infra/compose.yaml`：本地 PostgreSQL / Redis 依赖

设计与实施文档在：
- `PROJECT_PLAN.md`
- `docs/superpowers/specs/2026-03-26-ai-chat-design.md`
- `docs/superpowers/plans/2026-03-26-platform-bootstrap-auth.md`
- `docs/superpowers/plans/2026-03-26-tool-mvp.md`

## 常用命令

### 根目录
```bash
pnpm install
pnpm dev
pnpm build
pnpm lint
pnpm test
pnpm format
pnpm db:up
pnpm db:down
```

### 按 workspace 运行
```bash
pnpm --filter @ai-chat/api dev
pnpm --filter @ai-chat/api build
pnpm --filter @ai-chat/api lint
pnpm --filter @ai-chat/api test
pnpm --filter @ai-chat/api test:e2e

pnpm --filter @ai-chat/web dev
pnpm --filter @ai-chat/web build
pnpm --filter @ai-chat/web lint
pnpm --filter @ai-chat/web test
```

### 运行单个测试
```bash
pnpm --filter @ai-chat/api test -- auth.e2e-spec.ts
pnpm --filter @ai-chat/api test:e2e -- auth.e2e-spec.ts
pnpm --filter @ai-chat/web test -- auth-store.test.ts
pnpm --filter @ai-chat/web test -- chat-store.test.ts
```

### 数据库相关
```bash
pnpm db:up
pnpm db:down
pnpm --filter @ai-chat/api db:generate
pnpm --filter @ai-chat/api db:migrate
pnpm --filter @ai-chat/api db:seed
```

## 环境与本地运行

- Node 版本目标：`>= 20`
- 包管理器：`pnpm@10`
- API 默认端口：`3000`
- Web 默认端口：`5173`
- 本地基础依赖通过 `infra/compose.yaml` 提供：PostgreSQL 16、Redis 7

典型本地启动顺序：
1. 准备本地环境变量
2. `pnpm db:up`
3. `pnpm install`
4. `pnpm --filter @ai-chat/api db:generate`
5. `pnpm --filter @ai-chat/api db:migrate`
6. `pnpm --filter @ai-chat/api db:seed`
7. `pnpm dev`

如果 `pnpm dev` 时端口已被占用：
- Web 端 Vite 会自动尝试下一个端口
- API 默认仍监听 `3000`，联调前先确认是否已有本地服务在占用该端口，不要直接粗暴杀进程

## 仓库结构

```txt
apps/
  api/     NestJS 后端
  web/     React + Vite 前端
packages/
  shared/         前后端共享类型
  tsconfig/       共享 TS 配置
  eslint-config/  共享 ESLint 配置
infra/
  compose.yaml    本地 PostgreSQL / Redis
docs/superpowers/
  specs/          设计文档
  plans/          实施计划文档
```

## 当前架构要点

### 1. API 已进入 chat + auth 双主线
`apps/api/src/app.module.ts` 当前接入：
- `PrismaModule`
- `UsersModule`
- `AuthModule`
- `ChatModule`
- `HealthController`

因此后端现状不是只有账号体系，还包含聊天链路。新增能力时优先沿现有模块边界扩展，而不是重新搭一层大而全的抽象。

### 2. 聊天主链路是 chat -> agent -> llm/tool
后端的聊天入口在 `apps/api/src/modules/chat/chat.controller.ts`：
- `GET /chat/sessions`
- `GET /chat/sessions/:sessionId/messages`
- `POST /chat/stream`

其中 `/chat/stream` 会把 agent 执行过程转成 SSE 事件返回前端，包括：
- `run_started`
- `tool_started`
- `tool_completed`
- `tool_failed`
- `text_delta`
- `run_completed`
- `run_failed`

继续追链路时，关键文件通常是：
- `apps/api/src/modules/chat/chat.controller.ts`
- `apps/api/src/modules/chat/chat.service.ts`
- `apps/api/src/modules/agent/agent.service.ts`
- `apps/api/src/modules/tool/*`
- `apps/api/src/modules/llm/*`

### 3. tool execution 已经落库，不只是前端展示
当前 tool 调用不是纯内存事件。后端会记录 tool execution，并通过 SSE 把状态回推给前端；前端聊天页会显示 tool 的运行中 / 成功 / 失败状态。

因此涉及 tool 改动时，通常要同时检查：
- agent 层是否发出正确事件
- tool service 是否正确落库
- shared 类型是否同步更新
- web store 与聊天页是否正确消费事件

### 4. Web 聊天页的状态中心在 Zustand，不在组件局部 state
前端聊天主页面在 `apps/web/src/pages/chat/ChatPage.tsx`，聊天流状态集中在 `apps/web/src/stores/chat-store.ts`。

关键点：
- 会话列表、当前会话、消息、toolExecutions、streaming 状态都在 store
- `ChatPage` 负责订阅 SSE 并把事件分发给 store
- `MessageList` / `ToolExecutionList` 只负责展示，不承担流式状态拼装

如果你修改聊天行为，优先检查：
- `apps/web/src/pages/chat/ChatPage.tsx`
- `apps/web/src/stores/chat-store.ts`
- `apps/web/src/services/chat.ts`
- `apps/web/src/components/chat/*`

### 5. 认证链路仍是前后端基础设施
后端认证入口在 `apps/api/src/modules/auth/auth.controller.ts`：
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

前端认证状态在 `apps/web/src/stores/auth-store.ts`，使用 Zustand `persist` 持久化。

如果你修改登录流程，需要同时检查：
- API 返回结构是否与 `packages/shared` 一致
- 前端 auth store 是否同步更新
- 路由守卫是否仍成立
- 登录页和后续页面跳转是否受影响

### 6. 路由保护分为登录态与角色两层
`apps/web/src/router/index.tsx` 当前结构是：
- `/login`：登录页
- `/chat`：登录后默认主入口
- `/dashboard`：登录态页面
- `/admin`：额外要求 `ADMIN` 角色

权限相关改动通常会同时影响：
- 后端 JWT / roles guard
- 前端 `ProtectedRoute` / `RoleRoute`
- `packages/shared` 里的角色定义

### 7. shared package 是前后端契约层
`packages/shared/src/index.ts` 当前统一导出：
- `auth`
- `user`
- `chat`
- `tool`

凡是前后端都要消费的 DTO、会话/消息摘要、tool execution 类型，应优先放到 `packages/shared`，避免两端各自维护重复定义。

### 8. 文档里的目标边界可以参考，但以当前代码为准
设计文档已经明确未来方向，如 `schedule`、`run`、`audit` 等模块。但当前真实运行状态仍以代码实现为准。

回答“现在系统怎么工作”时：以代码为准。
规划“下一步该怎么扩展”时：再参考 `docs/superpowers/specs` 和 `docs/superpowers/plans`。

## 开发时的具体注意点

### API
- 当前数据访问主入口是 Prisma
- 涉及持久化时优先沿 Prisma 层扩展
- 聊天联调通常需要先确认数据库已 migrate/seed
- 如果要验证 tool execution 是否真实成功，优先检查接口流事件和数据库记录，而不只看前端文案

### Web
- 当前是纯客户端应用，认证态是客户端持久化状态
- 新增页面时优先沿现有 `pages/ + router/ + services/ + stores/ + components/` 分层
- 聊天页空态、流式 assistant 文本、tool execution 展示是三套不同 UI 状态，改动时不要混淆

### Monorepo / Turbo
- 根脚本通过 `turbo run` 驱动各 workspace
- 优先用 `pnpm --filter <workspace>` 跑局部命令，避免每次全仓库执行
- 修改 shared 配置或类型时，要同时关注 API 与 Web 两端是否被影响

## 测试与验收约定

### 常规验证
- 小改动优先跑受影响 workspace 的 `lint` / `test` / `build`
- 需要全量验收时再跑根级：
  - `pnpm lint`
  - `pnpm test`
  - `pnpm build`

### 浏览器联调
当任务已经完成、需要最终验收，或者任务本身涉及手动打开浏览器测试时，优先使用 `agent-browser` skill 做真实浏览器验证。

典型场景：
- 登录流程验证
- 聊天页真实发送消息
- 流式输出是否渲染正常
- tool execution 卡片是否正确显示
- 页面跳转、受保护路由、管理员路由验证

如果只是本地静态代码修改，不要过早使用浏览器；但到“功能完成后的最终验证”阶段，应优先考虑 `agent-browser`。

## 文档优先级

当代码与文档不一致时：
1. **当前代码实现** 代表真实运行状态
2. `docs/superpowers/plans/...` 代表最近一次明确实施方案
3. `docs/superpowers/specs/...` 与 `PROJECT_PLAN.md` 代表总体目标与边界

不要把尚未实现的目标架构写成“当前已存在”。

## 本仓库协作原则

- 遵循 KISS，优先简单直接的实现
- 不要为了未来假设提前做复杂抽象
- 不要把 README 风格的通用说明堆进代码注释
- 涉及 GitHub 操作时，优先使用 `gh`
- 涉及敏感信息时，仅使用本地环境变量，不要写入仓库
