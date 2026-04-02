# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概览

这是一个 `pnpm workspace + Turborepo` monorepo，目标是构建以 **agent execution** 为中心的 AI chat platform。

当前仓库的主要 workspace：
- `apps/api`：NestJS API。主线不是单一聊天接口，而是 `auth + chat + schedule` 三条业务线共享同一套 execution spine。
- `apps/web`：React + Vite Web。主应用已接入 `/chat`、`/dashboard`、`/schedules`、`/runs`、`/settings`、`/admin`，聊天页围绕执行态、timeline 和 tool execution 展示。
- `packages/shared`：前后端共享 auth / user / chat / tool / schedule 契约；这里不只是 DTO 层，也是 chat 与 schedule 共用的 execution contract 层。
- `infra/compose.yaml`：本地 PostgreSQL / Redis 依赖。

优先看这些文档：
- `README.md`
- `PROJECT_PLAN.md`
- `docs/superpowers/specs/*.md`
- `docs/superpowers/plans/*.md`

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
pnpm --filter @ai-chat/api db:generate
pnpm --filter @ai-chat/api db:migrate
pnpm --filter @ai-chat/api db:seed

pnpm --filter @ai-chat/web dev
pnpm --filter @ai-chat/web build
pnpm --filter @ai-chat/web lint
pnpm --filter @ai-chat/web test
```

### 运行单个测试
```bash
pnpm --filter @ai-chat/api test -- auth.e2e-spec.ts
pnpm --filter @ai-chat/api test:e2e -- auth.e2e-spec.ts
pnpm --filter @ai-chat/api test -- schedule-tick.processor.spec.ts
pnpm --filter @ai-chat/api test:e2e -- schedule.e2e-spec.ts
pnpm --filter @ai-chat/web test -- auth-store.test.ts
pnpm --filter @ai-chat/web test -- chat-store.test.ts
```

### 数据库与本地依赖
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
- Web 默认端口：`5170`
- 本地基础依赖通过 `infra/compose.yaml` 提供：PostgreSQL 16、Redis 7
- Web 默认请求 `VITE_API_BASE_URL || http://localhost:3000`
- API 会按顺序读取 `.env.local`、`.env`、根目录 `.env.local`、根目录 `.env`，且 `override: false`，先读到的值不会被后面的文件覆盖

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
- 如果你为了联调临时再拉起一套 API/Web（例如 `3100` / `5174`），必须同步确认前端实际指向的 API 地址，而不是默认假设还在 `3000`
- 在验证功能、联调或启动本地服务之前，先检查目标端口和相关进程是否已经有现成服务在运行；如果已有且配置符合当前任务，优先直接复用，不要重复启动第二套服务
- 只有在确认现有服务不符合当前任务（端口、环境变量、目标分支、依赖实例不一致）时，才新启动服务；启动前要先说明将新增哪个端口/进程，避免本地同时存在多套 API/Web 导致混淆

## 当前架构要点

### 1. API 是 auth + chat + schedule 三条主线，但 chat 与 schedule 共用 execution spine
`apps/api/src/app.module.ts` 当前接入：
- `PrismaModule`
- `QueueModule`
- `UsersModule`
- `AuthModule`
- `ChatModule`
- `ScheduleModule`
- `HealthController`

后端现状不只是 auth/chat/schedule 并列模块，而是两条执行型链路：
- 用户触发的 chat run
- schedule 触发的 background run

两者共享 `RunSummary`、stage、failure category、tool execution 等执行态契约。

### 2. Chat 主链路已经是 controller -> service -> agent -> llm/tool -> persistence -> stream
聊天入口仍在 `apps/api/src/modules/chat/chat.controller.ts`：
- `GET /chat/sessions`
- `GET /chat/sessions/:sessionId/messages`
- `POST /chat/stream`

但 `/chat/stream` 已经不只是“回 SSE 文本”：
- controller 先创建 / 复用 session 与 user message
- `AgentService.execute(...)` 产出 run events
- 事件同时写成运行态数据，并桥接到 `ai` data stream parts
- assistant reply、run、tool execution 都会持久化
- 前端最终消费的是同一条 execution stream

关键文件通常是：
- `apps/api/src/modules/chat/chat.controller.ts`
- `apps/api/src/modules/chat/chat.service.ts`
- `apps/api/src/modules/agent/agent.service.ts`
- `apps/api/src/modules/tool/*`
- `apps/api/src/modules/llm/*`
- `packages/shared/src/chat.ts`
- `packages/shared/src/schedule.ts`

### 3. 聊天协议已经升级为 timeline + run events，不只是 message 列表
`packages/shared/src/chat.ts` 里，chat 相关共享契约除了 session/message 外，还包括：
- `ChatTimelineEntry`
- `ChatRunEvent`
- `GetChatTimelineResponse`

其中 `ChatRunEvent` 已覆盖：
- `run_started`
- `run_stage_changed`
- `text_delta`
- `tool_started`
- `tool_progressed`
- `tool_completed`
- `tool_failed`
- `run_repaired`
- `run_completed`
- `run_failed`

因此修改聊天协议时，优先沿主链路直接收敛，不要额外维护长期适配层。

### 4. tool execution 已经是执行主链路的一部分，不只是前端展示
当前 tool 调用不是纯内存事件。后端会记录 tool execution，并通过流式事件把状态推给前端；前端聊天页会显示 tool 的运行中 / 成功 / 失败状态。

涉及 tool 改动时，通常要同时检查：
- agent 层是否发出正确事件
- tool service 是否正确落库
- shared 类型是否同步更新
- web store 与聊天页是否正确消费 execution 事件

### 5. Schedule 主链路仍以 DB 为真相源，BullMQ 只负责 tick 与唤醒
Schedule 的核心业务仍在数据库：
- `ScheduleService` 负责 CRUD、enable / disable、`nextRunAt` 维护
- `ScheduleRunnerService.processDueSchedules(now)` 负责扫描 due schedules、claim、创建 `ScheduleRun`、调用 chat/agent 执行，并在 one-time 场景下回写 `enabled=false`
- `QueueModule` 只注册 Redis/BullMQ 连接与全局 `schedule-tick` queue
- `ScheduleTickBootstrapService` 只负责确保存在唯一 repeatable tick job
- `ScheduleTickProcessor` 只负责周期性唤醒 `processDueSchedules(new Date())`

不要把 BullMQ 当作每个 schedule 的独立真相源，也不要在 processor 里复制业务调度逻辑。

### 6. Run / diagnostics 已经是 schedule 与 chat 之间的共享执行语言
`packages/shared/src/schedule.ts` 不只描述 schedule CRUD，还定义了：
- `RunSummary`
- `RunDiagnosticsSummary`
- `RunStage`
- `FailureCategory`
- `RunTriggerSource`
- `ScheduleRunSummary`

这意味着：
- chat run 与 schedule run 已经共享状态模型
- 排查问题时要优先看 run 的 stage / failure category，而不是只看最终成功失败
- 新增执行能力时，优先扩展共享 run 契约，而不是在某个模块单独发明一套状态字段

### 7. Web 聊天页的状态中心是 execution state，不是组件局部 state
前端聊天主页面在 `apps/web/src/pages/chat/ChatPage.tsx`，核心状态集中在 `apps/web/src/stores/chat-store.ts`。

现在 store 不只管理消息列表，还管理：
- `sessions`
- `currentSessionId`
- `messages`
- `currentRun`
- `toolExecutions`
- `runtime.status`
- `streamUiState`
- `streamErrorMessage`

关键边界：
- `ChatPage` 负责订阅和桥接流式执行过程
- store 负责归并 timeline / run / tool execution / streaming 状态
- 展示组件只负责渲染，不承担执行态拼装

如果你修改聊天行为，优先检查：
- `apps/web/src/pages/chat/ChatPage.tsx`
- `apps/web/src/stores/chat-store.ts`
- `apps/web/src/services/chat.ts`
- `apps/web/src/components/chat/*`

### 8. 认证链路仍是前后端基础设施，设置页已并入主应用路由
后端认证入口在 `apps/api/src/modules/auth/auth.controller.ts`：
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

前端认证状态在 `apps/web/src/stores/auth-store.ts`，使用 Zustand `persist` 持久化。

`apps/web/src/router/index.tsx` 当前结构是：
- `/login`：登录页
- `/chat`：登录后默认主入口
- `/dashboard`：登录态页面
- `/schedules`：登录态页面
- `/runs`：登录态页面
- `/settings`：登录态页面
- `/admin`：额外要求 `ADMIN` 角色

权限相关改动通常会同时影响：
- 后端 JWT / roles guard
- 前端 `ProtectedRoute` / `RoleRoute`
- `packages/shared` 里的角色定义
- 登录后跳转与主应用导航

### 9. shared package 是前后端契约层，也是 execution contract 层
`packages/shared/src/index.ts` 当前统一导出：
- `auth`
- `user`
- `chat`
- `tool`
- `schedule`

凡是前后端都要消费的 DTO、timeline、run summary、tool execution、schedule / run 类型，应优先放到 `packages/shared`，避免两端各自维护重复定义。

### 10. 文档里的目标边界可以参考，但以当前代码为准
设计文档已经明确未来方向，但当前真实运行状态仍以代码实现为准。

回答“现在系统怎么工作”时：以代码为准。
规划“下一步该怎么扩展”时：再参考 `docs/superpowers/specs` 和 `docs/superpowers/plans`。

## 开发时的具体注意点

### API
- 当前数据访问主入口是 Prisma
- 聊天与 schedule 的执行态已经共用 run 模型；不要在局部链路再发明一套状态命名
- 涉及持久化时优先沿 Prisma 层扩展
- 如果要验证 tool execution 是否真实成功，优先检查接口流事件和数据库记录，而不只看前端文案
- 如果要验证 schedule 真正执行在哪个实例上，除了看 `/runs` 页面，还要同时看 API 日志和存活端口

### Web
- 当前是纯客户端应用，认证态是客户端持久化状态
- 新增页面时优先沿现有 `pages/ + router/ + services/ + stores/ + components/` 分层
- 聊天页不要把 message、run、tool execution、runtime status 混成一种状态
- Schedule / Runs 联调时，先确认 `VITE_API_BASE_URL`，不要默认认为页面一定连到 `3000`

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
- schedule 创建、自动触发、runs 结果验证
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
- 优先沿现有模块边界扩展，而不是重新搭一层平台抽象
- 聊天协议升级时直接收敛主链路，避免长期维护协议映射层
- tool 参数校验优先依赖 schema，而不是重复手写一套参数校验
- 不要把 README 风格的通用说明堆进代码注释
- 涉及 GitHub 操作时，优先使用 `gh`
- 涉及敏感信息时，仅使用本地环境变量，不要写入仓库
