# AI Chat 设计方案

- 日期：2026-03-26
- 项目：ai-chat
- 方案基线：方案 A（标准分层方案）

## 1. 背景与目标

项目目标是构建一个基于 `NestJS + LangChainJS` 的 AI 聊天系统，提供 Web 端界面，并支持以下能力：

- 多用户登录与权限控制
- 多轮聊天与会话管理
- Tool 调用
- 定时任务
- 前后端同仓库开发与部署

本项目采用 monorepo 架构，前后端共用统一的工程化配置与共享类型，优先保证系统能分阶段落地，而不是一开始把所有高级能力一次性做完。

## 2. 设计原则

本方案遵循以下原则：

- KISS：优先简单、直接、易维护的实现
- 分阶段交付：最终目标完整，但每个阶段只做一个清晰闭环
- 多用户优先：从第一版开始考虑用户隔离与权限边界
- 标准分层：按业务边界拆模块，不做过度抽象
- 可复用执行链：聊天与定时任务是两个入口，但尽量复用底层执行能力

## 3. 当前确认的约束

### 用户模型
- 多用户系统
- 角色仅包含：`ADMIN`、`USER`
- 第一版不引入组织、团队、租户模型

### 登录方式
- 本地账号密码登录
- 使用 JWT 进行鉴权
- 第一版不做第三方登录

### 范围目标
最终包含：
- 聊天系统
- Tool 能力
- 定时任务
- Web 管理界面

但实现上拆成多个连续任务，避免大爆炸式开发。

## 4. 总体架构

项目采用：

- `pnpm workspace`
- `Turborepo`
- `NestJS` 作为后端 API
- `React + Vite + TypeScript` 作为 Web 前端
- `PostgreSQL` 负责核心数据持久化
- `Redis + BullMQ` 负责异步任务与调度
- `Prisma` 负责数据库访问
- `SSE` 负责聊天流式输出

### 核心架构判断

- 聊天和定时任务是两个入口
- `llm`、`tool`、`run` 组成复用的底层执行链
- `chat` 负责交互入口
- `schedule` 负责调度入口
- `auth` 与 `users` 负责账号体系与权限边界

这种方式既能保持模块职责清晰，也避免聊天和定时任务演变成两套完全独立系统。

## 5. 模块设计

后端建议拆分为以下模块：

- `auth`：注册、登录、JWT、密码校验、角色守卫
- `users`：用户信息与管理员用户管理
- `chat`：会话、消息、SSE 输出、聊天接口
- `llm`：统一封装模型调用
- `tool`：内置工具注册、工具执行、结构化结果返回
- `schedule`：定时任务定义、启停、cron / one-time 配置
- `run`：执行记录与统一执行上下文占位
- `audit`：关键操作审计日志

### 模块边界说明

- `chat` 不直接承担全部 AI 执行逻辑
- `schedule` 不直接实现聊天能力
- `llm` 与 `tool` 必须独立于 `chat`
- `run` 先保持轻量，但为后续复用执行链预留边界

## 6. 数据流设计

### 6.1 聊天链路
1. 用户登录获取 JWT
2. 前端创建或进入一个 `ChatSession`
3. 用户发送消息
4. `chat` 模块调用 `llm`
5. 如有需要，通过 `tool` 执行内置工具
6. 结果通过 SSE 流式输出到前端
7. 消息与工具执行信息持久化

### 6.2 定时任务链路
1. 用户或管理员创建 `Schedule`
2. `schedule` 模块将任务加入 `BullMQ`
3. worker 在指定时间执行任务
4. worker 复用 `llm/tool/run` 执行能力
5. 结果写入 `ScheduleRun`
6. 前端展示任务状态与执行结果

## 7. 第一版数据模型建议

第一版建议只保留以下核心实体：

### 7.1 User
字段建议：
- `id`
- `email`
- `passwordHash`
- `role`
- `status`
- `createdAt`
- `updatedAt`

### 7.2 ChatSession
字段建议：
- `id`
- `userId`
- `title`
- `model`
- `createdAt`
- `updatedAt`

### 7.3 ChatMessage
字段建议：
- `id`
- `sessionId`
- `role`
- `content`
- `toolCallId`（可空）
- `createdAt`

### 7.4 Schedule
字段建议：
- `id`
- `userId`
- `name`
- `prompt`
- `type`（`CRON` | `ONCE`）
- `cronExpr`（可空）
- `runAt`（可空）
- `enabled`
- `createdAt`
- `updatedAt`

### 7.5 ScheduleRun
字段建议：
- `id`
- `scheduleId`
- `triggeredBy`
- `status`
- `input`
- `output`
- `errorMessage`
- `startedAt`
- `finishedAt`

### 7.6 ToolExecution
字段建议：
- `id`
- `sessionId`（可空）
- `scheduleRunId`（可空）
- `toolName`
- `input`
- `output`
- `status`
- `startedAt`
- `finishedAt`

### 7.7 AuditLog
字段建议：
- `id`
- `userId`（可空）
- `action`
- `targetType`
- `targetId`
- `metadata`
- `createdAt`

### 数据建模原则
- 所有核心资源都应可追溯到用户
- 第一版不引入组织/团队/租户表
- `ScheduleRun` 与 `ToolExecution` 职责分离
- 聊天执行追踪先轻量，不提前引入复杂统一运行时模型

## 8. 分阶段实施方案

### 任务 1：平台骨架与鉴权
包含：
- monorepo 初始化
- `apps/api` / `apps/web`
- `packages/shared` / `packages/tsconfig` / `packages/eslint-config`
- Prisma + PostgreSQL
- Redis 接入
- 用户注册/登录
- JWT 鉴权
- `ADMIN` / `USER` 角色校验
- 前端登录页与基础路由守卫

验收标准：
- 前后端本地可启动
- 用户可登录
- 受保护接口与页面可访问
- 管理员和普通用户权限已区分

### 任务 2：聊天 MVP
包含：
- 创建会话
- 会话列表
- 发送消息
- 保存历史消息
- 调用 LLM
- SSE 流式返回
- Web 聊天页
- 用户隔离

验收标准：
- 用户能完成多轮聊天
- 消息与会话持久化
- 刷新后历史可恢复
- 流式输出正常

### 任务 3：Tool MVP
包含：
- 内置 Tool 注册表
- Tool 调用协议
- ToolExecution 记录
- Tool 结果回写聊天流
- 前端展示 Tool 状态

验收标准：
- 至少支持 1~2 个内置 Tool
- Tool 调用状态可见
- Tool 结果能回写聊天消息流

### 任务 4：Schedule MVP
包含：
- 创建 cron / one-time 任务
- 任务启停
- BullMQ worker 执行
- 任务执行记录
- Web 任务列表与执行记录页
- Admin 全局查看，User 查看自己的

验收标准：
- 任务可创建并执行
- 结果和错误可查看
- 权限隔离正确

## 9. 第一阶段 MVP 边界

第一阶段建议只落地：
- 任务 1：平台骨架与鉴权
- 任务 2：聊天 MVP

### 第一阶段明确包含
- 本地账号密码
- JWT
- 单一 LLM provider
- 文本聊天
- 基础会话管理
- SSE 流式输出
- Admin / User 两角色

### 第一阶段明确不包含
- OAuth
- 多租户
- 插件市场
- 用户自定义工具
- 工作流编排引擎
- 多模态
- 复杂权限矩阵
- 多模型动态路由
- 可视化流程设计器

## 10. 推荐目录结构

```txt
ai-chat/
├─ apps/
│  ├─ api/
│  │  ├─ src/
│  │  │  ├─ modules/
│  │  │  │  ├─ auth/
│  │  │  │  ├─ users/
│  │  │  │  ├─ chat/
│  │  │  │  ├─ llm/
│  │  │  │  ├─ tool/
│  │  │  │  ├─ schedule/
│  │  │  │  ├─ run/
│  │  │  │  └─ audit/
│  │  │  ├─ common/
│  │  │  ├─ prisma/
│  │  │  └─ main.ts
│  │  └─ package.json
│  └─ web/
│     ├─ src/
│     │  ├─ pages/
│     │  │  ├─ login/
│     │  │  ├─ chat/
│     │  │  ├─ schedules/
│     │  │  ├─ runs/
│     │  │  ├─ settings/
│     │  │  └─ admin/
│     │  ├─ components/
│     │  ├─ stores/
│     │  ├─ hooks/
│     │  ├─ services/
│     │  ├─ lib/
│     │  └─ router/
│     └─ package.json
├─ packages/
│  ├─ shared/
│  ├─ tsconfig/
│  └─ eslint-config/
├─ infra/
│  └─ compose.yaml
├─ openspec/
├─ package.json
├─ pnpm-workspace.yaml
└─ turbo.json
```

### 目录建议说明
- `packages/ui` 第一阶段不建立，避免过早抽象
- `llm` 与 `tool` 必须独立
- `common` 仅放横切能力
- `run` 模块先轻量保留，便于后续接入 schedule

## 11. 风险与控制策略

### 风险 1：范围失控
控制策略：
- 严格按任务推进
- 当前只实现任务 1 与任务 2
- Tool 与 Schedule 先设计占位，不提前做深

### 风险 2：聊天与调度做成两套系统
控制策略：
- 保持 `llm/tool/run` 可复用
- 不把所有执行逻辑塞进 `chat`

### 风险 3：权限与用户隔离后补成本高
控制策略：
- 从第一版开始在核心资源中引入 `userId/ownerId`
- 接口层通过 JWT + Role Guard + 资源归属检查控制访问

## 12. 下一步建议

建议下一步不要直接开始写所有功能，而是：

1. 先为任务 1 编写 implementation plan
2. 只执行任务 1：平台骨架与鉴权
3. 任务 1 完成并验证后，再开始任务 2：聊天 MVP

## 13. 非目标

本设计明确不覆盖以下内容：

- 多组织/多租户协作模型
- 第三方 OAuth 登录
- 动态插件市场
- 用户上传自定义 Tool
- 通用工作流编排引擎
- 高级可观测平台
- 多 provider 智能路由
- 多模态能力

以上内容可在后续版本中按新 spec 单独扩展。
