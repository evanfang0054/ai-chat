# ai-chat 项目总览

## 1. 项目定位

`ai-chat` 是一个基于 **NestJS + React + LangChainJS** 的 AI 聊天平台，采用 **pnpm workspace + Turborepo** 的 monorepo 架构。

项目目标是构建一个可持续扩展的 AI 应用基础平台，当前核心围绕三条主线展开：

- 聊天：支持多轮会话、流式响应、Tool 调用与执行状态展示
- 调度：支持定时任务创建、自动触发、执行记录与结果追踪
- 权限：支持本地账号体系、JWT 鉴权与基础 RBAC

该文档的角色是**仓库顶层总览文档**：

- 说明项目目标与核心选型
- 总结当前已实现能力
- 描述当前真实架构与关键链路
- 给出当前阶段的后续方向
- 作为详细设计与实施文档的入口

当本文档与代码实现不一致时，**以当前代码为准**。

---

## 2. 技术选型

### 后端
- NestJS
- LangChainJS
- Prisma
- PostgreSQL
- Redis
- BullMQ
- SSE
- JWT

### 前端
- Vite
- React
- TypeScript
- Tailwind CSS
- Zustand
- TanStack Query
- React Router
- shadcn/ui 风格组件体系

### 工程化
- pnpm workspace
- Turborepo
- Node >= 20

---

## 3. 为什么采用这套方案

本项目采用：

**pnpm monorepo + NestJS API + React Web + LangChainJS + PostgreSQL + Redis + BullMQ + SSE**

这样选择的原因是：

- 既能支撑聊天、Tool、Schedule 这类 AI 产品核心链路
- 又能保持模块边界清晰，不必过早引入复杂平台化抽象
- 前后端同仓库开发，便于共享类型、统一脚本与联调
- PostgreSQL 适合作为核心业务数据真相源，Redis/BullMQ 适合作为异步触发与队列基础设施
- SSE 足够支撑当前聊天流式输出场景，接入成本低，链路清晰

相对更轻的方案，这套架构更适合持续演进；相对更重的平台化方案，它又能避免当前阶段的过度设计。

---

## 4. 当前项目现状

当前仓库已经不处于“项目初始化”阶段，而是进入了**基础闭环已完成、持续演进与收口并行**的阶段。

当前已具备的主能力包括：

### 4.1 Auth / User
- 用户注册与登录
- `JWT` 鉴权
- `ADMIN` / `USER` 基础角色控制
- 前端登录态持久化
- 受保护路由与管理员路由

### 4.2 Chat
- 聊天会话列表查询
- 历史消息查询
- `POST /chat/stream` 流式聊天接口
- 服务端 SSE 流式返回执行过程
- 聊天页流式消息渲染
- 会话侧栏与当前会话切换

### 4.3 Tool Execution
- Agent 可调用内置 Tool
- Tool execution 状态会在后端持久化
- 前端聊天页可展示 Tool 的运行中 / 成功 / 失败状态
- Tool execution 不只是前端临时展示，而是完整链路的一部分

### 4.4 Schedule / Runs
- Schedule 的创建、编辑、启用、停用、删除
- 自动 tick 扫描与执行 due schedules
- `ScheduleRun` 持久化与状态追踪
- `/schedules` 与 `/runs` 页面
- run 与 chat session 的关联可见

### 4.5 Web 端
- 登录页
- Chat 页面
- Dashboard 页面
- Schedules 页面
- Runs 页面
- Admin 页面
- 统一 app shell 与最近一轮 Web UX 刷新

### 4.6 Shared Contracts
- `packages/shared` 已作为前后端契约层
- 统一导出 `auth`、`user`、`chat`、`tool`、`schedule` 等共享类型

---

## 5. 当前目录结构与职责

```txt
ai-chat/
├─ apps/
│  ├─ api/                 # NestJS 后端 API
│  └─ web/                 # React + Vite 前端
├─ packages/
│  ├─ shared/              # 前后端共享类型/契约
│  ├─ eslint-config/       # 统一 lint 配置
│  └─ tsconfig/            # 统一 tsconfig 配置
├─ infra/
│  └─ compose.yaml         # 本地 PostgreSQL / Redis 依赖
├─ docs/                   # 设计文档与实施计划
├─ PROJECT_PLAN.md         # 仓库顶层总览
├─ package.json
├─ pnpm-workspace.yaml
└─ turbo.json
```

### apps/api
负责：
- 用户与认证
- 聊天与消息查询
- SSE 流式聊天
- Agent / LLM / Tool 调用
- Schedule 与 Run 管理
- tick 调度触发

### apps/web
负责：
- 登录与鉴权态
- 聊天工作台
- Tool execution 可视化
- Schedules 管理
- Runs 查看
- Dashboard / Admin 等页面

### packages/shared
负责：
- 前后端共享 DTO / 响应类型 / 业务枚举
- 统一契约导出，避免两端重复维护

### infra
负责：
- 本地开发依赖：PostgreSQL 16、Redis 7

---

## 6. 当前真实架构

## 6.1 API 由 auth + chat + schedule 三条主线组成
当前后端不是单一 auth 骨架，而是已经接入：

- `PrismaModule`
- `QueueModule`
- `UsersModule`
- `AuthModule`
- `ChatModule`
- `ScheduleModule`
- `HealthController`

因此新增能力时，优先沿现有模块边界扩展，而不是重新搭一层大而全的抽象。

## 6.2 Chat 主链路是 `chat -> agent -> llm/tool`
当前聊天入口在 `chat` 模块，核心职责是：

- 查询 session 列表
- 查询某个 session 的消息
- 接收聊天输入并返回流式响应

继续向下的真实执行链路是：

`chat -> agent -> llm/tool`

也就是说：
- `chat` 负责 API 入口与持久化组织
- `agent` 负责执行编排
- `llm` 负责模型调用
- `tool` 负责工具注册、执行与结果回传

## 6.3 Tool execution 已经落库
当前 Tool 调用不是纯内存事件。

真实链路包括：
- Agent 触发 Tool
- Tool execution 记录持久化
- SSE 把执行状态回推前端
- 前端聊天页展示工具执行过程

因此涉及 Tool 改动时，需要同时关注：
- agent 事件
- tool service
- shared 类型
- web 聊天消费逻辑

## 6.4 Schedule 的真相源是数据库，不是 BullMQ
这是当前项目中非常关键的架构边界。

当前 schedule 业务核心在数据库：

- `ScheduleService` 负责 CRUD、enable / disable、`nextRunAt` 维护
- `ScheduleRunnerService.processDueSchedules(now)` 负责扫描 due schedules、claim、创建 run、调用现有 chat/agent 执行链路
- `QueueModule` 负责 Redis / BullMQ 连接与全局 `schedule-tick` queue
- `ScheduleTickBootstrapService` 负责确保存在唯一 repeatable tick job
- `ScheduleTickProcessor` 只负责周期性唤醒 `processDueSchedules(new Date())`

因此：
- BullMQ 不是每个 schedule 的独立真相源
- processor 也不应复制业务调度逻辑

## 6.5 Web 聊天状态当前以 Zustand 为中心
当前聊天主页面在 `apps/web/src/pages/chat/ChatPage.tsx`，聊天状态中心在 `apps/web/src/stores/chat-store.ts`。

当前职责分工是：
- 会话列表、当前会话、消息、toolExecutions、streaming 状态集中在 store
- `ChatPage` 负责订阅 SSE 并分发事件
- 展示组件只负责渲染，不负责拼装流式状态

如果后续聊天协议升级，这一层可能继续调整；但当前真实实现仍以现有 store + SSE 分发链路为准。

## 6.6 Shared package 是契约层
凡是前后端都要消费的 DTO、响应结构、聊天/工具/调度类型，优先放在 `packages/shared`。

这一层的目标是：
- 保持 API 与 Web 契约一致
- 避免两端重复定义
- 降低联调时的结构漂移

---

## 7. 关键链路说明

## 7.1 认证链路
后端认证入口：
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

前端认证状态在 Zustand store 中持久化，并通过受保护路由与角色路由控制页面访问。

## 7.2 聊天链路
核心接口：
- `GET /chat/sessions`
- `GET /chat/sessions/:sessionId/messages`
- `POST /chat/stream`

当前 SSE 事件会覆盖运行开始、Tool 执行、文本增量、运行完成/失败等阶段。

## 7.3 调度链路
Schedule 主链路是：

`schedule -> schedule-run -> chat -> agent -> llm/tool`

也就是说，schedule 是“时间触发入口”，真正的 AI 执行仍复用现有聊天执行链。

## 7.4 路由保护
当前前端路由分为两层：
- 登录态保护：`/chat`、`/dashboard`、`/schedules`、`/runs`
- 角色保护：`/admin` 需要 `ADMIN`

---

## 8. 本地开发与联调约定

## 8.1 常用命令
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

## 8.2 本地环境
- Node 版本目标：`>= 20`
- 包管理器：`pnpm@10`
- API 默认端口：`3000`
- Web 默认端口：`5170`
- 本地依赖由 `infra/compose.yaml` 提供：PostgreSQL、Redis

典型启动顺序：
1. 准备环境变量
2. `pnpm db:up`
3. `pnpm install`
4. `pnpm --filter @ai-chat/api db:generate`
5. `pnpm --filter @ai-chat/api db:migrate`
6. `pnpm --filter @ai-chat/api db:seed`
7. `pnpm dev`

## 8.3 联调注意点
- 在启动新服务前，先确认目标端口和相关进程是否已有可复用服务
- 如果本地同时跑多套 API，且共用同一个 Redis，则 schedule tick 可能被任意实例消费
- 排查 schedule / runs / LLM 配置异常时，优先确认：
  1. Web 实际命中的 API 地址
  2. 当前有哪些 API 端口仍存活
  3. 哪些实例连接了同一个 Redis 并启用了 tick
- 回答“现在系统如何工作”时，以代码为准；规划“下一步怎么扩展”时，再参考 docs

---

## 9. 当前阶段的缺口与后续方向

当前仓库主闭环已经具备，但仍有一批明确缺口与下一阶段演进方向。

### 9.1 已识别缺口
- `settings` 页面尚未实现
- `audit log` 模块与持久化尚未实现
- `refresh token` 机制尚未实现
- 部分早期文档仍停留在初始化或 MVP 阶段，需要继续同步

### 9.2 已进入或值得优先推进的方向
- 聊天协议与前端聊天体验继续升级
- agent-driven 执行层与 Tool 体系补强
- schedule / runs 的产品可用性继续打磨
- 错误追踪、限流、timeout、结构化日志等生产化能力补齐
- API / worker 拆分等部署形态增强

这一部分应视为**方向性 backlog**，而不是固定不变的线性实施步骤。

---

## 10. 相关设计与实施文档

设计与实施文档位于 `docs/superpowers/`，当前重点包括：

### 核心设计
- `docs/superpowers/specs/2026-03-26-ai-chat-design.md`
- `docs/superpowers/specs/2026-03-27-schedule-mvp-design.md`
- `docs/superpowers/specs/2026-03-27-ai-schedule-management-design.md`
- `docs/superpowers/specs/2026-03-30-gap-analysis-next-backlog-design.md`
- `docs/superpowers/specs/2026-03-30-web-ux-refresh-design.md`

### 实施计划 / 结果
- `docs/superpowers/plans/2026-03-26-platform-bootstrap-auth.md`
- `docs/superpowers/plans/2026-03-26-chat-mvp.md`
- `docs/superpowers/plans/2026-03-26-tool-mvp.md`
- `docs/superpowers/plans/2026-03-27-schedule-mvp.md`
- `docs/superpowers/plans/2026-03-27-ai-schedule-management.md`
- `docs/superpowers/plans/2026-03-30-gap-closure.md`
- `docs/superpowers/plans/2026-03-30-gap-closure-report.md`
- `docs/superpowers/plans/2026-03-30-chat-protocol-upgrade.md`
- `docs/superpowers/plans/2026-03-30-web-ux-refresh-implementation.md`

---

## 11. 维护原则

- 遵循 KISS，优先简单直接的实现
- 以当前代码实现为准，不把未来目标写成现状
- `PROJECT_PLAN.md` 负责全局总览，不承担详细 spec / plan 的职责
- 详细设计与实施过程进入 `docs/superpowers/`
- 当系统真实边界发生变化时，应同步更新本文件，避免其退化为历史立项文档
