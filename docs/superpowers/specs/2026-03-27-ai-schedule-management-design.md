# AI Schedule Management 设计方案

- 日期：2026-03-27
- 项目：ai-chat
- 阶段：AI 创建并管理定时器任务

## 1. 目标

在当前已经具备 `Schedule` 数据模型、`/schedules` 与 `/runs` 页面、后台自动 tick 执行、聊天主链路与 Tool MVP 的基础上，补齐“AI 直接创建并管理定时器任务”的能力。

本阶段目标是完成：
- 用户在聊天中通过自然语言创建 schedule
- 用户在聊天中查询当前有哪些 schedule
- 用户在聊天中修改已有 schedule
- 用户在聊天中启用 / 停用已有 schedule
- 用户在聊天中删除已有 schedule
- AI 创建的 schedule 与手工创建的 schedule 进入同一个 `/schedules` 看板
- 用户可继续在 `/schedules` 看板中编辑、启停、删除 AI 创建的任务

这里的关键不是新增第二套“AI 专属定时器系统”，而是让 agent 通过 tool 调用现有 schedule 真相源，从而把聊天交互与当前 schedule 管理闭环接起来。

## 2. 设计原则

- KISS：优先复用现有 `ScheduleService` 与 `/schedules` 看板，不引入第二套任务系统
- agent-driven：继续以 agent + tool 作为能力入口，而不是前端解析自然语言后直接拼 API
- 单一真相源：数据库中的 schedule 仍是唯一真相源，AI 与手工创建都写入同一套数据
- schema-first：tool 输入优先依赖 Zod / LangChain tool schema 校验，不再复制一套平行的手写字段校验
- 用户隔离优先：所有 tool 调用必须基于当前 `userId` 操作自己的 schedule
- 最小可用闭环：MVP 只覆盖 create / list / update / delete / enable / disable，不预做批量操作与复杂时间解析器

## 3. 范围与非目标

### 3.1 本阶段范围
- 新增 agent tool：`manage_schedule`
- 通过单一 tool 支持：`create | list | update | delete | enable | disable`
- 后端新增删除 schedule API
- Web `/schedules` 页面补删除入口
- 聊天创建的 schedule 可在 `/schedules` 页面看到
- 聊天修改/删除/启停的结果可在 `/schedules` 页面反映
- agent 在管理类对话中可先 list 再做目标消歧

### 3.2 明确不做
- 批量删除 / 批量启停
- 复杂管理员全局调度台
- AI/手工创建来源标识
- 高级自然语言时间解析引擎
- 复杂多轮 UI 消歧组件
- 新的 schedule 数据模型或第二套调度真相源

## 4. 总体架构

整体边界保持不变，只在 agent/tool 层补 schedule 管理能力：

- `ChatController` / `ChatService`
  - 继续负责聊天消息、SSE 事件、会话落库
- `AgentService`
  - 继续负责根据用户自然语言决定是否调用 tool
- `ToolService`
  - 新增 `manage_schedule` 注册
- `ScheduleService`
  - 继续作为 schedule 业务真相源，负责 create/list/update/delete/enable/disable
- `/schedules` 页面
  - 继续作为任务看板，展示并管理当前用户的 schedules

核心设计原则是：

- AI 不直接操作数据库，只通过 tool 调用现有 `ScheduleService`
- 看板不读取 agent 内部状态，只读取现有 `/schedules` API
- AI 创建与手工创建走同一条业务链路

这样可以保证：
- 真相源只有一份
- AI 创建后天然出现在现有看板中
- 看板已有的编辑/启停能力可以直接管理 AI 创建的任务

## 5. Tool 设计

### 5.1 单一 `manage_schedule` tool

采用一个单一 tool，而不是拆成多个工具：
- 避免 tool 列表过长
- 降低 agent 选错工具的概率
- 保持 KISS

tool 名称：
- `manage_schedule`

支持 action：
- `create`
- `list`
- `update`
- `delete`
- `enable`
- `disable`

### 5.2 schema-first 方案

`manage_schedule` 输入使用 Zod `discriminatedUnion('action', ...)` 定义，LangChain tool schema 直接复用该 schema，让模型知道每种 action 允许哪些字段。

推荐结构如下：

```ts
const manageScheduleSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('create'),
    title: z.string().min(1).optional(),
    prompt: z.string().min(1),
    scheduleType: z.enum(['INTERVAL', 'CRON', 'ONCE']),
    cronExpression: z.string().optional(),
    intervalSeconds: z.number().int().positive().optional(),
    runAt: z.string().datetime().optional(),
    timezone: z.string().min(1).optional(),
    enabled: z.boolean().optional()
  }),
  z.object({
    action: z.literal('list'),
    filterEnabled: z.boolean().optional(),
    filterType: z.enum(['INTERVAL', 'CRON', 'ONCE']).optional()
  }),
  z.object({
    action: z.literal('update'),
    scheduleId: z.string().min(1),
    title: z.string().min(1).optional(),
    prompt: z.string().min(1).optional(),
    scheduleType: z.enum(['INTERVAL', 'CRON', 'ONCE']).optional(),
    cronExpression: z.string().optional(),
    intervalSeconds: z.number().int().positive().optional(),
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

### 5.3 schema 与业务层职责划分

#### schema 层负责
- 字段是否存在
- 字段类型是否正确
- 基础格式是否合法
- 哪个 action 允许哪些字段

#### tool execute / service 层负责
- `scheduleId` 是否存在
- 该 schedule 是否属于当前用户
- create/update 后是否满足业务约束
- update/delete 前是否需要先 list 做消歧

也就是说，本设计不主张再复制一套平行的手写字段校验逻辑，而是把输入约束尽量收敛到 schema，业务层只保留真正的业务与权限校验。

### 5.4 tool 输出

不同 action 返回不同结构，这是可接受的：

- `create` / `update` / `enable` / `disable`
  - `{ schedule: ScheduleSummary }`
- `list`
  - `{ schedules: ScheduleSummary[] }`
- `delete`
  - `{ deletedScheduleId: string }`

其中 `list` 返回的每条 `ScheduleSummary` 最好包含：
- `id`
- `title`
- `prompt`
- `type`
- `enabled`
- `nextRunAt`
- `timezone`
- `updatedAt`

这样 agent 才能更稳定地做消歧和自然语言回答。

## 6. 用户对话行为规则

### 6.1 创建

#### 信息足够时直接创建
例如：
- “每10秒告诉我当前时间”

agent 可以直接理解为：
- `scheduleType = INTERVAL`
- `intervalSeconds = 10`
- `prompt = 告诉我当前时间`

然后调用 `manage_schedule(action=create, ...)`。

#### 信息不足时追问
例如：
- “帮我建个定时器”

缺少触发时机与执行内容，此时 assistant 应追问，不应瞎猜。

#### 类型歧义时确认
例如：
- “明天早上提醒我开会”

可能是一条一次性任务，也可能是每天早上的循环任务。此时 assistant 应先确认是一条 `ONCE` 还是重复 schedule。

### 6.2 查询

查询是安全操作，可以直接执行 `list`：
- “我现在有哪些定时器？”
- “哪个任务下次会触发？”

### 6.3 修改

修改前推荐先 `list`，再定位目标，再 `update`。

如果候选唯一，可以直接改；如果目标不唯一，assistant 应追问，而不是猜测。

例如：
- “把那个报时任务改成每分钟一次”

正确流程：
1. list 当前 schedules
2. 定位“报时任务”
3. 若唯一则 update
4. 若多个类似任务则追问

### 6.4 启用 / 停用

启停属于较低风险操作，可以在目标唯一时直接执行：
- “暂停那个任务”
- “重新启用它”

若有歧义，同样先 `list` 再追问。

### 6.5 删除

删除属于高风险操作，要求：
- 先 `list` 定位目标
- 目标唯一后，assistant 仍应先确认再删除

例如：
- 用户：“删掉那个报时任务”
- assistant：“找到‘每10秒报时’，确认删除吗？”
- 用户确认后再调用 `delete`

### 6.6 目标定位规则

本设计不建议让 `update` / `delete` 直接接受模糊名称作为唯一定位方式。更稳的规则是：
- 先 `list`
- 再由 agent 在上下文中定位目标
- 真正执行修改/删除时使用 `scheduleId`

这样可以避免同名任务、相似 prompt 导致误删误改。

## 7. 后端 API 与服务改动

### 7.1 现有能力复用
当前已经具备：
- `POST /schedules`
- `GET /schedules`
- `PATCH /schedules/:id`
- `POST /schedules/:id/enable`
- `POST /schedules/:id/disable`
- `GET /runs`
- `GET /runs/:id`

这些接口与 `ScheduleService` 已经能支撑 create/list/update/enable/disable，不需要重做。

### 7.2 必须新增：删除 schedule

当前缺少删除 schedule API，需要补：
- `DELETE /schedules/:id`

控制器形态：

```ts
@Delete('schedules/:id')
async deleteSchedule(@CurrentUser() user: CurrentUserPayload, @Param('id') id: string) {
  await this.scheduleService.deleteSchedule(user.userId, id);
  return { deletedScheduleId: id };
}
```

同时补：
- `ScheduleService.deleteSchedule(userId, scheduleId)`

其职责：
- 校验 schedule 是否存在
- 校验该 schedule 是否属于当前用户
- 删除 schedule

### 7.3 不新增第二套 AI 专属 API

本设计不新增 `/ai/schedules` 之类的新接口。agent tool 直接复用现有 schedule 业务服务即可。

## 8. 前端看板改动

### 8.1 保持现有 `/schedules` 页面职责
`/schedules` 页面继续负责：
- 展示 schedule 列表
- 创建 schedule
- 编辑 schedule
- 启用/停用 schedule

AI 创建的任务进入同一列表，无需单独页面。

### 8.2 必须新增：删除入口

当前 `/schedules` 页面只有创建、编辑、启停，需要补删除入口：
- 每个 schedule 列表项增加 delete button
- 点击后做确认
- 确认后调用 `DELETE /schedules/:id`
- 成功后从本地状态移除

### 8.3 非必需项

MVP 不做：
- AI 创建来源标识
- 专门的“AI 任务”筛选器
- 复杂的对话式管理 UI

## 9. shared 类型改动

需要补一个删除响应类型，例如：

```ts
export interface DeleteScheduleResponse {
  deletedScheduleId: string;
}
```

同时确认 `ScheduleSummary` 是否已经包含：
- `id`
- `title`
- `prompt`
- `type`
- `enabled`
- `nextRunAt`
- `timezone`
- `updatedAt`

若缺失，则补齐到 shared 契约层，保证 agent、API、web 看板三方使用同一份结构。

## 10. 风险与规避

### 10.1 schema 设计过宽
如果 `manage_schedule` 用一个过于宽松的大 object，模型可能传出无效字段组合。

规避方式：
- 使用 `z.discriminatedUnion('action', ...)`
- 把 action 与字段组合收紧到 schema 层

### 10.2 误删误改
如果 agent 在目标不明确时直接执行 update/delete，风险很高。

规避方式：
- 先 list
- 目标不唯一时追问
- delete 前明确确认

### 10.3 自然语言时间理解模糊
例如：
- “明天早上”
- “月底”
- “每个工作日上午”

MVP 不做高级时间解析引擎。理解不确定时追问，而不是强猜。

### 10.4 权限边界被绕过
如果 tool 不基于当前 `userId` 调 service，可能错误操作他人 schedule。

规避方式：
- 所有 tool 调用统一走 `scheduleService.xxx(context.userId, ...)`

### 10.5 看板与聊天状态不一致
如果删除/更新后只在聊天回答里体现，看板本地状态没更新，会造成用户困惑。

规避方式：
- 看板继续以 API 为准
- 删除/更新时同步更新本地列表
- 最终通过真实浏览器联调验证

## 11. 实施顺序

推荐按以下顺序落地：

1. 补后端删除能力
   - `ScheduleService.deleteSchedule`
   - `DELETE /schedules/:id`
   - shared delete response
   - API 测试

2. 新增 `manage_schedule` tool
   - 建 Zod schema
   - 注册到 `ToolService`
   - 内部分发到 `ScheduleService`

3. 补 agent 行为约束
   - 创建时在信息足够时直接调用 `create`
   - 修改/删除前优先 `list`
   - 删除前确认
   - 信息不足时追问

4. 补 `/schedules` 删除入口
   - delete button
   - confirm 交互
   - 本地状态同步更新

5. 做端到端验证
   - 聊天创建 schedule
   - `/schedules` 中可见
   - 聊天启停/修改/删除
   - 看板状态同步变化

## 12. 测试与验收

### 12.1 后端测试
建议覆盖：
- `manage_schedule` 各 action 的 schema 校验
- `manage_schedule` 正确分发到 `ScheduleService`
- delete 只能删除自己的 schedule
- 无效 `scheduleId` 返回正确错误

### 12.2 前端测试
建议覆盖：
- `/schedules` 列表渲染
- 删除按钮与确认流程
- 删除成功后的本地状态更新

### 12.3 最终联调
按仓库现有协作偏好，功能完成后优先用真实浏览器联调验证：
- 聊天中输入“每10秒告诉我当前时间”
- AI 调用 `manage_schedule(action=create)`
- `/schedules` 页面出现新任务
- 聊天中暂停 / 修改 / 删除该任务
- 看板状态同步变化

## 13. 设计结论

本次设计的核心结论是：

- 不新建第二套 AI 任务系统
- 继续以现有 `ScheduleService` 和 `/schedules` 页面作为管理真相源
- 在 agent/tool 层新增单一 `manage_schedule` tool
- 用 Zod + LangChain schema 约束 tool 输入
- 把字段合法性校验尽量收敛到 schema 层
- 把权限、归属、存在性、消歧等保留为业务层责任

这样可以以最小增量，把“AI 会聊天”扩展成“AI 能真正创建并管理定时器任务”，并且天然与现有 schedule 看板打通。