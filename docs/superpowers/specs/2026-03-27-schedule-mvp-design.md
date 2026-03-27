# Schedule MVP 设计方案

- 日期：2026-03-27
- 项目：ai-chat
- 阶段：任务 4 / Schedule MVP

## 1. 目标

在当前已具备账号体系、基础 RBAC、聊天主链路与 Tool MVP 的基础上，交付一个最小可用的 Schedule MVP。

本阶段目标是完成：
- 用户创建未来要让 AI 执行的任务
- 支持 `CRON` 与 `ONE_TIME` 两种触发方式
- 支持启用与停用 schedule
- 到期后由系统自动触发现有 agent/chat 执行链路
- 记录每次执行的 run 历史
- Web 端提供 `/schedules` 与 `/runs` 两个页面
- 普通用户仅能查看自己的数据，管理员具备后续扩展为全量查看的边界

这里的 schedule 不代表执行固定 prompt，而是保存“用户希望 AI 到时执行的任务内容”。到点后，系统以该用户上下文触发一次 AI 执行。

## 2. 设计原则

- KISS：优先交付最小可用闭环，不预做复杂调度平台
- 复用现有链路：调度只新增入口，底层尽量复用现有 `chat -> agent -> llm/tool`
- 用户隔离优先：所有 schedule 与 run 都必须绑定用户
- 可追溯优先：每次 run 都保留输入快照、状态、错误与聊天关联
- 不过度抽象：本阶段不引入模板系统、工作流编排、复杂失败策略

## 3. 范围与非目标

### 3.1 本阶段范围
- 新增 `Schedule` 数据模型
- 新增 `ScheduleRun` 数据模型
- 支持创建 `CRON` 与 `ONE_TIME` schedule
- 支持 schedule 启用、停用、更新
- 支持后台扫描到期 schedule 并触发执行
- 支持 run 列表与 run 详情查询
- 每次 run 关联独立 `chatSessionId`
- Web 端新增 `/schedules` 与 `/runs`

### 3.2 明确不做
- 重试策略
- 手动立即执行
- 批量启停
- 复杂管理员控制台
- 模板化任务系统
- 工作流编排
- 多步骤调度依赖
- run 的实时流式页面
- settings 页面

## 4. 总体架构

本阶段采用以下执行链：

- 前端：`/schedules` 管理定时任务，`/runs` 查看执行记录
- 后端入口：`schedule` 模块负责 schedule 的创建、更新、启停与查询
- 调度触发：后台调度器周期性扫描到期 schedule
- 执行记录：每次触发创建一条 `ScheduleRun`
- 执行业务：run 内部复用现有 `chat -> agent -> llm/tool` 链路
- 历史承接：每次 run 生成独立 chat session，并记录到 `ScheduleRun.chatSessionId`

本阶段的核心链路为：

`schedule -> schedule-run -> chat -> agent -> llm/tool`

其中 `schedule` 是新的时间入口，真正的 AI 执行仍由现有聊天执行链承担。这样既避免重复建设，又能让 schedule 执行结果天然复用现有消息与 tool execution 持久化能力。

## 5. 后端模块设计

### 5.1 schedule 模块
职责：
- 创建 schedule
- 更新 schedule
- 启用/停用 schedule
- 查询当前用户自己的 schedule
- 查询 run 列表与 run 详情
- 校验 schedule 与 run 的用户归属
- 计算并更新 `nextRunAt`

本模块不直接实现 LLM 或 tool 调用，而是组织调度与状态记录。

### 5.2 调度器
职责：
- 周期性扫描 `enabled = true` 且 `nextRunAt <= now` 的 schedule
- 为符合条件的 schedule 创建 run
- 避免同一 schedule 在同一时点被重复触发

MVP 中调度器可以采用简单后台扫描机制，不要求一开始就把完整 BullMQ 运维能力全部暴露到业务层。但实现时应保留可接 BullMQ/worker 的边界。

### 5.3 执行桥接
职责：
- 以 `schedule.userId` 为执行身份
- 使用 `taskPromptSnapshot` 作为本次实际执行输入
- 创建独立 chat session
- 调用现有 `agent` / `chat` 执行能力
- 将执行结果写回 run

这里不通过前端聊天发送接口触发，而是通过服务层内部复用现有执行链。因为 schedule 属于后台触发，不是浏览器交互式请求。

## 6. 数据模型设计

### 6.1 Schedule
建议字段：
- `id`
- `userId`
- `title`
- `taskPrompt`
- `type`（`CRON` | `ONE_TIME`）
- `cronExpr`（可空）
- `runAt`（可空）
- `timezone`
- `enabled`
- `lastRunAt`（可空）
- `nextRunAt`（可空）
- `createdAt`
- `updatedAt`

约束：
- 每条 schedule 必须归属于一个用户
- `ONE_TIME` 必须有 `runAt`，且不能有 `cronExpr`
- `CRON` 必须有 `cronExpr`，且不能有 `runAt`
- `nextRunAt` 用于后台调度扫描
- 用户可修改标题和任务内容，但不影响历史 run 快照

### 6.2 ScheduleRun
建议字段：
- `id`
- `scheduleId`
- `userId`
- `status`（`PENDING` | `RUNNING` | `SUCCEEDED` | `FAILED`）
- `taskPromptSnapshot`
- `resultSummary`（可空）
- `errorMessage`（可空）
- `chatSessionId`（可空，但建议保留）
- `startedAt`
- `finishedAt`（可空）
- `createdAt`

约束：
- 每次实际触发都要生成独立 run
- `taskPromptSnapshot` 必须保存当次执行输入快照
- 执行成功写 `resultSummary`
- 执行失败写 `errorMessage`
- `chatSessionId` 用于后续跳转查看执行过程

### 6.3 与现有聊天模型的关系
- `Schedule` 不复用 `ChatSession`
- 每次 `ScheduleRun` 在执行时创建新的 `ChatSession`
- run 通过 `chatSessionId` 关联到聊天历史
- tool execution 继续沿现有聊天会话体系记录，不额外新增第二套 tool 追踪模型

这样可以避免 schedule 直接混入日常聊天会话，同时保留完整可追溯性。

## 7. 后端接口与数据流

### 7.1 创建 schedule
`POST /schedules`

输入：
- `title`
- `taskPrompt`
- `type`
- `cronExpr?`
- `runAt?`
- `timezone?`

行为：
1. 校验当前用户身份
2. 校验 `CRON` / `ONE_TIME` 字段组合是否合法
3. 计算 `nextRunAt`
4. 保存 schedule

### 7.2 查询 schedule 列表
`GET /schedules`

行为：
- 返回当前用户自己的 schedule 列表
- 默认按 `createdAt desc` 或 `nextRunAt asc` 返回，具体实现可选择一种稳定规则

MVP 建议优先按“最近需要处理/最近创建”之一返回，不做复杂排序配置。

### 7.3 更新 schedule
`PATCH /schedules/:id`

允许更新：
- `title`
- `taskPrompt`
- `type`
- `cronExpr`
- `runAt`
- `timezone`
- `enabled`

行为：
- 仅允许修改自己的 schedule
- 更新后重新计算 `nextRunAt`
- 不改写历史 run

### 7.4 启用 / 停用 schedule
- `POST /schedules/:id/enable`
- `POST /schedules/:id/disable`

行为：
- 仅允许操作自己的 schedule
- 启用时重新计算 `nextRunAt`
- 停用时保留历史 run，不删除 schedule

### 7.5 查询 run 列表
`GET /runs`

支持最基础筛选：
- `scheduleId?`
- `status?`

行为：
- 返回当前用户自己的 run 列表
- 管理员的全局查询能力留作后续扩展，不在本阶段前端展开

### 7.6 查询 run 详情
`GET /runs/:id`

返回：
- run 基本信息
- `resultSummary`
- `errorMessage`
- `chatSessionId`
- 所属 schedule 基本信息

### 7.7 调度触发数据流
调度器触发时的后端行为：
1. 扫描到期 schedule
2. 为每条待执行 schedule 创建 `ScheduleRun`
3. 保存 `taskPromptSnapshot`
4. 创建独立 `ChatSession`
5. 以 `schedule.userId` 身份调用现有执行链
6. 执行成功则写入 `resultSummary`
7. 执行失败则写入 `errorMessage`
8. 更新 run `status`、`finishedAt`
9. 更新 schedule 的 `lastRunAt` 与 `nextRunAt`
10. 若为 `ONE_TIME`，执行后自动停用

## 8. 前端页面设计

### 8.1 页面路由
本阶段新增：
- `/schedules`
- `/runs`

并纳入现有 `ProtectedRoute`。

### 8.2 `/schedules` 页面
职责：
- 展示当前用户自己的 schedule 列表
- 创建 schedule
- 编辑 schedule
- 启用/停用 schedule
- 跳转查看该 schedule 的 runs

列表项建议展示：
- 标题
- 任务内容摘要
- 类型（`CRON` / `ONE_TIME`）
- 下一次执行时间
- 最近执行时间
- 当前状态（enabled / disabled）
- 操作：编辑 / 启用 / 停用 / 查看 runs

创建与编辑采用同页表单或 modal，不额外引入复杂子路由。

### 8.3 `/runs` 页面
职责：
- 展示当前用户自己的 run 列表
- 支持按 `status` / `scheduleId` 做轻量筛选
- 提供跳转聊天记录入口

列表项建议展示：
- 对应 schedule 标题
- run 状态
- 开始时间
- 结束时间
- 结果摘要或错误摘要
- 跳转聊天记录按钮

MVP 不做复杂 run 时间线页面。如果用户需要看完整执行过程，直接跳到 `chatSessionId` 对应的聊天记录。

### 8.4 导航入口
在现有受保护区域中增加：
- `Schedules`
- `Runs`

本阶段不新增 `Settings`。

## 9. 错误处理与边界规则

### 9.1 字段校验
- `ONE_TIME`：必须有 `runAt`，不能有 `cronExpr`
- `CRON`：必须有 `cronExpr`，不能有 `runAt`
- 创建与更新时都要执行同样规则

### 9.2 权限隔离
- 普通用户只能读写自己的 schedule
- 普通用户只能查看自己的 run
- 非所属资源访问返回 404 或无权限错误
- 管理员全局视图留作后续扩展，不在本阶段做复杂 UI

### 9.3 幂等与重复触发
后台扫描时必须避免同一 schedule 在同一时点被重复触发。

MVP 不要求引入完整分布式锁体系，但设计上必须保证：
- 同一到期 schedule 只生成一条有效 run
- 领取与更新状态应尽量在同一事务或受控更新流程中完成

### 9.4 执行失败
- run 失败时标记 `FAILED`
- 写入 `errorMessage`
- `CRON` schedule 继续计算下一次执行
- `ONE_TIME` 执行后结束并停用，不因失败自动重试

### 9.5 历史快照
每次 run 必须保存 `taskPromptSnapshot`，保证历史执行与后续 schedule 编辑相互独立。

## 10. 测试策略

### 10.1 后端测试
优先验证后端闭环。

建议覆盖：
- 创建 `ONE_TIME` schedule
- 创建 `CRON` schedule
- 非法字段组合校验
- 仅能读写自己的 schedule
- enable / disable 生效
- 到期 schedule 会生成 run
- 未到期 schedule 不会触发
- run 成功时状态与摘要正确
- run 失败时错误信息正确
- `ONE_TIME` 执行后停用
- `CRON` 执行后更新新的 `nextRunAt`
- run 列表支持 `status` / `scheduleId` 筛选

### 10.2 前端测试
只做必要测试。

建议覆盖：
- `/schedules` 列表渲染
- 创建/编辑 schedule 表单提交流程
- 启用/停用操作
- `/runs` 列表渲染
- run 状态展示
- 结果摘要 / 错误摘要展示
- 跳转聊天记录入口

### 10.3 最终验收
功能实现完成后，建议做一次真实浏览器联调，重点验证：
- 创建 schedule
- schedule 到期后出现 run
- run 成功/失败展示正常
- 能跳转到对应聊天记录

## 11. 设计结论

本次 Schedule MVP 定义为：

让用户创建一条“未来要让 AI 执行的任务”，由系统在指定时间自动触发现有 agent/chat 链路执行，并记录执行历史。

本阶段包含：
- `Schedule`
- `ScheduleRun`
- `CRON / ONE_TIME`
- enable / disable
- 后台扫描触发
- run 状态记录
- 聊天会话关联
- `/schedules`
- `/runs`

本阶段不包含：
- 重试策略
- 手动立即执行
- 复杂管理员控制台
- 工作流编排
- 模板任务系统

这个范围能在当前仓库已具备的 auth、chat、agent、tool 基础上，以最小增量补齐“时间触发 AI 任务”闭环，并为后续扩展到更完整的任务系统保留自然演进空间。
