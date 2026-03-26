# ai-chat 项目方案汇总

## 1. 项目目标

构建一个基于 **NestJS + LangChainJS** 的 AI 聊天项目，要求：

- 支持多轮聊天
- 支持接入 Tool
- 支持定时任务
- 支持 Web 端
- 前后端同仓库，采用 **Monorepo** 架构
- 使用 **pnpm** 管理工作区
- Node 版本要求 **>= 20**

---

## 2. 最终选型

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
- shadcn/ui（建议）

### 工程化
- pnpm workspace
- Turborepo
- Node >= 20

---

## 3. 总体方案

最终采用：

**pnpm monorepo + NestJS API + React Web + LangChainJS + PostgreSQL + Redis + BullMQ + SSE**

这是一个兼顾：
- 可快速开发
- 可正式上线
- 易扩展
- 易维护

的标准生产版架构。

---

## 4. 为什么选方案 B

方案 B 是标准生产版，相比简单方案更适合正式项目，因为它具备：

- 多会话聊天能力
- Tool Calling 能力
- 定时任务 / 延迟任务能力
- 任务状态跟踪
- 审计日志
- 失败重试
- 多实例部署扩展能力

核心优势：
- 比方案 A 更适合生产
- 比方案 C 更不容易过度设计

---

## 5. Monorepo 架构设计

推荐目录：

```txt
ai-chat/
├─ apps/
│  ├─ api/                 # NestJS 后端
│  └─ web/                 # React + Vite 前端
├─ packages/
│  ├─ shared/              # 前后端共享类型/schema/常量
│  ├─ ui/                  # 可复用 UI 组件（可选）
│  ├─ eslint-config/       # 统一 lint 配置
│  └─ tsconfig/            # 统一 tsconfig 配置
├─ infra/
│  ├─ docker/
│  └─ compose.yaml         # postgres / redis 等本地依赖
├─ package.json
├─ pnpm-workspace.yaml
├─ turbo.json
└─ README.md
```

---

## 6. apps 说明

### apps/api
NestJS 后端应用，负责：

- 聊天接口
- 会话管理
- Tool 调度
- LLM 调用
- 定时任务管理
- BullMQ Worker
- SSE 流式输出
- 审计日志

推荐模块：

```txt
apps/api/src/modules/
├─ auth/
├─ users/
├─ chat/
├─ agent/
├─ tool/
├─ llm/
├─ schedule/
├─ task/
├─ memory/
└─ audit/
```

### apps/web
React 前端应用，负责：

- 登录/鉴权
- 聊天页面
- Tool 调用可视化
- 定时任务管理
- 执行记录展示
- 基础配置页面

推荐目录：

```txt
apps/web/src/
├─ pages/
│  ├─ login/
│  ├─ chat/
│  ├─ schedules/
│  ├─ runs/
│  └─ settings/
├─ components/
│  ├─ chat/
│  ├─ schedule/
│  ├─ common/
│  └─ layout/
├─ stores/
├─ hooks/
├─ services/
├─ lib/
└─ router/
```

---

## 7. packages 说明

### packages/shared
放前后端共用内容：

- DTO 类型
- zod schema
- API 响应类型
- 枚举
- Tool 输入输出类型
- Schedule payload 类型

推荐结构：

```txt
packages/shared/src/
├─ api.ts
├─ chat.ts
├─ schedule.ts
├─ tool.ts
└─ index.ts
```

### packages/ui
可选，用于后期抽通用组件：

- Button
- Input
- ChatMessage
- ToolBadge
- LoadingDots

MVP 阶段可以先不拆。

---

## 8. 前端架构建议

### 状态管理

#### Zustand 负责
- 登录态
- 当前会话 ID
- 聊天输入草稿
- 流式输出中的临时状态
- 纯前端 UI 状态

#### TanStack Query 负责
- 会话列表
- 历史消息
- 定时任务列表
- 任务执行记录
- 系统配置

原则：
- 服务端数据：TanStack Query
- 本地交互状态：Zustand

### 前端核心页面

#### 1. 聊天页 `/chat`
- 会话列表
- 消息流
- 输入框
- 模型切换
- Tool 调用状态展示

#### 2. 定时任务页 `/schedules`
- 创建任务
- cron 表达式输入
- 一次性任务创建
- 任务启停
- 下次执行时间展示

#### 3. 执行记录页 `/runs`
- 每次任务运行状态
- 输入参数
- 输出结果
- 错误日志

#### 4. 设置页 `/settings`
- 默认模型
- 温度
- 最大步数
- 默认 system prompt
- Tool 开关

### 聊天页面组件建议

```txt
ChatPage
├─ SessionSidebar
├─ ChatHeader
├─ MessageList
│  ├─ UserMessage
│  ├─ AssistantMessage
│  ├─ ToolCallCard
│  └─ ToolResultCard
├─ Composer
└─ ModelSelector
```

---

## 9. 后端架构建议

### LLM 层
建议封装统一 provider 抽象：

```ts
interface ChatModelProvider {
  invoke(input: ModelInput): Promise<ModelOutput>;
  stream(input: ModelInput): AsyncIterable<ModelChunk>;
}
```

实现类可包括：
- OpenAIProvider
- AnthropicProvider
- OpenAICompatibleProvider

这样后续切换模型厂商更方便。

### Agent 层
负责：
- 构造 system prompt
- 拉取聊天历史
- 注入 tools
- 调用 LangChainJS
- 处理 tool calling
- 控制最大 steps
- 返回最终结果

建议拆成：
- PromptBuilderService
- ToolExecutorService
- AgentRunnerService

### Tool 层
推荐建立 ToolRegistry：

```ts
ToolRegistry
- getAllTools()
- getTool(name)
- getToolsForUser(userId)
```

每个 Tool 独立一个文件，避免集中堆积。

推荐示例：

```txt
tool/tools/
├─ get-current-time.tool.ts
├─ search-knowledge.tool.ts
├─ create-schedule-task.tool.ts
├─ query-task-runs.tool.ts
└─ send-notification.tool.ts
```

---

## 10. 定时任务方案

既然选择方案 B，推荐直接使用：

- **BullMQ + Redis**

不建议只依赖 `@nestjs/schedule`，因为后期会遇到：
- 多实例重复执行
- 重试不足
- 任务状态难管理
- 延迟任务支持弱
- 幂等控制不足

### 模块职责拆分

#### schedule 模块
负责：
- 创建 cron 规则
- 校验表达式
- 更新/暂停/删除任务
- 管理 repeatable jobs

#### task 模块
负责：
- 执行 AI 任务
- 记录运行日志
- 失败重试
- 结果通知

### 队列建议

```txt
queues/
├─ chat.queue.ts
├─ ai-task.queue.ts
├─ notification.queue.ts
└─ cleanup.queue.ts
```

---

## 11. AI + 定时任务结合方式

### 1）到点主动执行 AI 任务
例如：
- 每天总结昨天工单
- 每小时巡检日志并生成摘要
- 每周自动生成周报

执行链路：

```txt
Cron/BullMQ -> Task Worker -> AgentService -> Tool调用 -> 结果存库/通知用户
```

### 2）聊天中创建定时任务
例如用户输入：
- 每天 9 点提醒我看销售数据
- 每周一帮我总结上周报错

此时 AI 可调用 `create_schedule_task` tool。

### 3）条件触发后的延迟任务
例如：
- 提交后 30 分钟自动跟进
- 某事件发生 10 分钟后自动分析

这种场景非常适合 BullMQ delayed job。

---

## 12. 数据库表建议

建议至少包含以下表：

### 用户与聊天
- `users`
- `chat_sessions`
- `chat_messages`

### 工具审计
- `tool_call_logs`

### 定时任务
- `scheduled_jobs`
- `task_runs`

### 可选扩展
- `model_configs`
- `knowledge_bases`
- `attachments`

---

## 13. API 设计建议

### 聊天接口
- `POST /api/chat/sessions`
- `GET /api/chat/sessions`
- `GET /api/chat/sessions/:id/messages`
- `POST /api/chat/sessions/:id/messages`
- `GET /api/chat/sessions/:id/stream`

### 定时任务接口
- `POST /api/schedules`
- `GET /api/schedules`
- `PATCH /api/schedules/:id`
- `DELETE /api/schedules/:id`
- `POST /api/schedules/:id/pause`
- `POST /api/schedules/:id/resume`
- `GET /api/schedules/:id/runs`

### 工具接口
- `GET /api/tools`
- `GET /api/tool-call-logs`

---

## 14. 前后端通信方式建议

### 普通请求
- REST API

### 流式聊天
- SSE

原因：
- 实现简单
- 与 LLM 流式响应适配度高
- 前端接入成本低
- 非常适合“服务端持续输出文本”的聊天场景

如果未来需要：
- 多人协作
- Presence
- 高频双向事件

再升级到 WebSocket。

---

## 15. UI 与样式层建议

前端建议使用：

- Tailwind CSS
- shadcn/ui

原因：
- 主流
- 开发速度快
- 适合聊天页、配置页、管理页
- 可控性高

常用组件会包括：
- Dialog
- Drawer
- Tabs
- Select
- Tooltip
- Toast
- Table
- Badge

---

## 16. 鉴权建议

MVP 建议：
- JWT access token
- refresh token

如果偏正式后台系统，建议：
- access token 放内存
- refresh token 使用 httpOnly cookie

这样安全性更好。

---

## 17. 部署建议

### 开发环境
使用 Docker Compose 启动：
- PostgreSQL
- Redis

### 生产环境建议拆分
- `web`：静态资源部署
- `api`：NestJS 服务
- `worker`：BullMQ worker 单独进程
- PostgreSQL / Redis：独立服务

说明：
- API 负责处理请求
- Worker 负责执行耗时 AI 任务

这样更利于稳定性和扩展。

---

## 18. 工程规范建议

- Node >= 20
- pnpm >= 9
- pnpm workspace
- Turborepo
- ESLint
- Prettier
- Husky
- lint-staged
- Conventional Commits

---

## 19. 推荐 MVP 范围

### 后端
- 登录
- 创建会话
- 发送消息
- 流式回复
- 3 个 Tool
  - `get_current_time`
  - `search_knowledge`
  - `create_schedule_task`
- 定时任务 CRUD
- 任务执行日志

### 前端
- 登录页
- 聊天页
- 定时任务管理页
- 执行记录页

---

## 20. 推荐实施顺序

### 第 1 步
搭建 monorepo 基础：
- pnpm workspace
- turbo
- apps/api
- apps/web
- packages/shared

### 第 2 步
完成后端基础设施：
- NestJS
- Prisma
- PostgreSQL
- Redis
- BullMQ
- 鉴权

### 第 3 步
完成聊天主链路：
- 会话
- 消息
- SSE 流式输出
- LLM 接入

### 第 4 步
完成 Tool 体系：
- Tool 注册中心
- 基础 Tool
- Tool 调用审计

### 第 5 步
完成定时任务：
- Schedule CRUD
- BullMQ repeat/delay
- Worker 执行 AI 任务

### 第 6 步
完成前端页面：
- 登录
- 聊天
- 定时任务管理
- 运行记录展示

### 第 7 步
补充工程化与观测：
- 日志
- 错误追踪
- 限流
- 超时控制
- 权限控制

---

## 21. 最终推荐结论

当前项目建议采用：

### 后端
- NestJS
- LangChainJS
- Prisma
- PostgreSQL
- Redis
- BullMQ
- SSE

### 前端
- Vite
- React
- TypeScript
- Tailwind CSS
- Zustand
- TanStack Query
- React Router
- shadcn/ui

### 工程化
- pnpm workspace
- Turborepo
- Node >= 20

这是当前最适合该项目的平衡方案。

---

## 22. 当前阶段说明

当前目录仅创建项目文件夹，并写入本方案汇总文档，方便先审阅。

下一步可选方向：

1. 初始化 monorepo 骨架
2. 输出数据库设计文档
3. 输出 API 详细设计
4. 直接开始搭建 apps/api 与 apps/web
