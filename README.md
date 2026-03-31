# AI Chat

一个基于 **NestJS + React + LangChainJS** 构建的企业级 AI 聊天平台，采用 **pnpm workspace + Turborepo** 的 monorepo 架构。

项目当前已形成从 **认证**、**聊天**、**Tool 执行** 到 **定时调度与运行追踪** 的基础闭环，适合作为 AI 应用平台的工程化起点，并在此基础上持续扩展 Agent、Tool、Schedule、权限与运营能力。

## 核心能力

### Auth / User
- 用户注册与登录
- JWT 鉴权
- `ADMIN` / `USER` 基础 RBAC
- 前端登录态持久化
- 受保护路由与管理员路由

### Chat
- 会话列表与历史消息查询
- `POST /chat/stream` 流式聊天接口
- SSE 流式返回执行过程
- Web 端流式消息渲染
- 会话侧栏与当前会话切换

### Tool Execution
- Agent 可调用内置 Tool
- Tool execution 状态后端持久化
- 前端展示 Tool 运行中 / 成功 / 失败状态
- Tool execution 作为完整业务链路的一部分，而非纯前端临时展示

### Schedule / Runs
- Schedule 创建、编辑、启用、停用、删除
- 自动 tick 扫描并执行 due schedules
- `ScheduleRun` 持久化与状态追踪
- `/schedules` 与 `/runs` 页面
- run 与 chat session 关联可见

## 技术栈

### 后端
- NestJS
- LangChainJS
- Prisma
- PostgreSQL
- Redis
- BullMQ
- SSE
- JWT
- Zod

### 前端
- React 19
- Vite 6
- TypeScript
- Zustand
- React Router
- Tailwind CSS 4
- AI SDK React

### 工程化
- pnpm workspace
- Turborepo
- Node.js >= 20
- pnpm 10

## 项目结构

```text
ai-chat/
├─ apps/
│  ├─ api/                 # NestJS 后端 API
│  └─ web/                 # React + Vite 前端
├─ packages/
│  ├─ shared/              # 前后端共享类型与契约
│  ├─ eslint-config/       # 统一 lint 配置
│  └─ tsconfig/            # 统一 tsconfig 配置
├─ infra/
│  └─ compose.yaml         # 本地 PostgreSQL / Redis 依赖
├─ docs/                   # 设计文档与实施计划
├─ openspec/               # OpenSpec 相关资产
├─ PROJECT_PLAN.md         # 项目总览文档
├─ package.json
├─ pnpm-workspace.yaml
└─ turbo.json
```

## 快速开始

### 1. 环境要求
- Node.js `>= 20`
- `pnpm@10`
- Docker / Docker Compose

### 2. 安装依赖

```bash
pnpm install
```

### 3. 启动本地基础依赖

```bash
pnpm db:up
```

这会启动：
- PostgreSQL 16
- Redis 7

### 4. 准备数据库

```bash
pnpm --filter @ai-chat/api db:generate
pnpm --filter @ai-chat/api db:migrate
pnpm --filter @ai-chat/api db:seed
```

### 5. 启动开发环境

```bash
pnpm dev
```

默认情况下：
- API: `http://localhost:3000`
- Web: `http://localhost:5170`

## 环境变量

API 会按以下顺序读取环境变量文件，且后读不会覆盖先读到的值：

1. `apps/api/.env.local`
2. `apps/api/.env`
3. `/.env.local`
4. `/.env`

建议：
- 敏感信息仅保存在本地环境变量文件中
- 不要将 API key、数据库密码等内容提交到仓库

根目录已提供 `.env.example` 可作为参考。

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

### API

```bash
pnpm --filter @ai-chat/api dev
pnpm --filter @ai-chat/api build
pnpm --filter @ai-chat/api lint
pnpm --filter @ai-chat/api test
pnpm --filter @ai-chat/api test:e2e
pnpm --filter @ai-chat/api db:generate
pnpm --filter @ai-chat/api db:migrate
pnpm --filter @ai-chat/api db:seed
```

### Web

```bash
pnpm --filter @ai-chat/web dev
pnpm --filter @ai-chat/web build
pnpm --filter @ai-chat/web lint
pnpm --filter @ai-chat/web test
```

## 架构概览

### 后端主线
当前 API 主要由三条业务主线组成：
- Auth
- Chat
- Schedule

后端真实执行链路可以概括为：

```text
chat -> agent -> llm/tool
```

其中：
- `chat` 负责 API 入口与消息/会话组织
- `agent` 负责执行编排
- `llm` 负责模型调用
- `tool` 负责工具注册、执行与结果回传

### Tool Execution
Tool 调用不是纯内存事件，而是完整链路的一部分：
- Agent 触发 Tool
- Tool execution 记录持久化
- SSE 将状态推送到前端
- 前端聊天页展示执行过程

### Schedule / Runs
Schedule 的业务真相源是数据库，而不是 BullMQ：
- `ScheduleService` 负责 CRUD 与 `nextRunAt` 维护
- `ScheduleRunnerService` 负责扫描 due schedules、claim、创建 run 并执行
- `QueueModule` 提供 BullMQ / Redis 基础设施
- `ScheduleTickProcessor` 周期性唤醒调度逻辑

这意味着 BullMQ 在当前架构中承担的是触发与唤醒职责，而不是每个 schedule 的独立真相源。

## Web 端能力

当前 Web 端已具备：
- 登录页
- Chat 页面
- Dashboard 页面
- Schedules 页面
- Runs 页面
- Admin 页面

聊天相关状态主要集中在 Zustand store 中，页面层负责订阅 SSE 并分发事件，展示组件专注于渲染。

## 开发约定

- 遵循 KISS，优先简单直接的实现
- 优先沿现有模块边界扩展，而不是提前做大抽象
- 共享 DTO / 类型优先放在 `packages/shared`
- 涉及敏感信息仅使用本地环境变量
- 涉及 GitHub 操作优先使用 `gh`

## 本地联调注意事项

### 启动前先确认是否已有服务
在验证功能或联调前，先检查目标端口和相关进程是否已有可复用服务，避免本地同时跑多套 API / Web 导致混淆。

### Schedule 多实例注意事项
如果本地同时运行多套 API，且它们共享同一个 Redis：
- 任意实例都可能抢到同一个 schedule 的执行权
- 可能出现创建请求打到新实例，但 run 实际在旧实例执行的情况

联调 schedule / runs / LLM 相关能力时，建议优先确认：
1. Web 实际命中的 API 地址
2. 当前存活的 API 端口
3. 哪些实例启用了 tick
4. 是否共享同一个 Redis

## 测试与验收

常规小改动建议优先执行受影响 workspace 的命令：

```bash
pnpm --filter @ai-chat/api lint
pnpm --filter @ai-chat/api test
pnpm --filter @ai-chat/web lint
pnpm --filter @ai-chat/web test
```

需要全量验收时再执行：

```bash
pnpm lint
pnpm test
pnpm build
```

## 文档索引

### 顶层文档
- `PROJECT_PLAN.md`：项目总览与当前实现状态

### 设计文档
- `docs/superpowers/specs/2026-03-26-ai-chat-design.md`
- `docs/superpowers/specs/2026-03-26-chat-mvp-design.md`
- `docs/superpowers/specs/2026-03-27-schedule-mvp-design.md`
- `docs/superpowers/specs/2026-03-27-ai-schedule-management-design.md`
- `docs/superpowers/specs/2026-03-28-web-tailwind-migration-design.md`
- `docs/superpowers/specs/2026-03-30-gap-analysis-next-backlog-design.md`
- `docs/superpowers/specs/2026-03-30-web-ux-refresh-design.md`

### 实施计划
- `docs/superpowers/plans/2026-03-26-platform-bootstrap-auth.md`
- `docs/superpowers/plans/2026-03-26-chat-mvp.md`
- `docs/superpowers/plans/2026-03-26-tool-mvp.md`
- `docs/superpowers/plans/2026-03-27-schedule-mvp.md`
- `docs/superpowers/plans/2026-03-27-ai-schedule-management.md`
- `docs/superpowers/plans/2026-03-30-gap-closure.md`
- `docs/superpowers/plans/2026-03-30-gap-closure-report.md`
- `docs/superpowers/plans/2026-03-30-chat-protocol-upgrade.md`
- `docs/superpowers/plans/2026-03-30-web-ux-refresh-implementation.md`

## 当前状态

当前仓库已不是初始化骨架，而是一个已经具备基础业务闭环的 AI 聊天平台：
- 认证链路已打通
- Chat 流式链路已打通
- Tool execution 已接入持久化与前端展示
- Schedule / Runs 已形成从创建到执行追踪的完整基础链路

如果你准备继续扩展这个平台，建议优先围绕现有模块边界演进，而不是重新搭建新的平台层。
