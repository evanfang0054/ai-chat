# 2026-03-31 执行主链路收口与 Agent 能力升级设计

## 1. 背景

`ai-chat` 当前已经具备可运行的主要能力：

- API 侧已有 auth、chat、agent、tool execution、schedule / runs 主链路
- Web 侧已有聊天、会话侧栏、tool execution 展示、schedules / runs 页面
- `packages/shared` 已承担前后端共享契约层职责

但和 Claude Code 在工程层面的做法对照后，可以看到一个更关键的问题：当前项目不是“缺功能”，而是**多条执行链路已经长出来了，但主链路语义还没有彻底收口**。

目前比较明显的症状包括：

- chat 实时流事件、历史消息、tool execution、schedule run 之间仍有分层割裂
- user 触发与 schedule 触发虽然最终都在执行 agent/llm/tool，但没有统一成同一套 run 语义
- 错误、超时、失败原因、前端展示语义之间还不完全一致
- Web 页面对 domain state 和 view state 的边界还不够清晰，部分页面承担了过多拼装职责
- agent 当前更接近“单轮调用 + tool 增强”，尚未形成清晰的多步执行运行时边界

Claude Code 值得借鉴的不是 UI 形态，而是几条工程思想：

1. **会话/执行链路必须是系统主线**
2. **输入先做意图编排，再进入执行**
3. **工具不是普通函数，而是受治理的能力调用**
4. **失败恢复不只是报错，而是结构修复、状态修复与可观测性的一部分**
5. **状态变更与副作用要有统一出口，避免多入口分裂**

因此，本设计聚焦两条互相配合的优化主线：

- 方案 A：执行主链路收口优先
- 方案 B：工具 / Agent 能力升级优先

并将两者合并为一套渐进式设计，而不是拆成彼此割裂的两次重构。

---

## 2. 目标

本次设计目标是让 `ai-chat` 从“多个能力已可用”提升为“有统一执行语义、统一状态语义、统一失败语义的 AI 应用底座”。

具体目标：

1. 将 chat、run、schedule、tool execution 收口为一条可追踪的执行主链路
2. 让 user 触发与 schedule 触发共享统一 run 语义，只保留触发来源差异
3. 统一实时事件、历史记录、状态枚举、错误类型、前端展示语义
4. 为 tool / agent 建立更明确的运行时边界：输入、进度、取消、失败、并发、结果
5. 在不推翻现有模块边界的前提下，给后续多步 agent 演进留出稳定落点

最终结果应满足：

- 能清楚回答“一次执行是谁触发、做了什么、在哪失败、如何展示”
- 能让 chat 与 schedule/run 不再各自演化成两套执行系统
- 能让 Web 页面更多消费统一投影，而不是自己拼业务语义
- 能直接作为后续 implementation plan 的设计依据

---

## 3. 非目标

本轮设计明确不包含以下方向：

- 不做 Claude Code 式 CLI / REPL 产品形态迁移
- 不引入重型工作流引擎、事件总线、DDD/CQRS 体系
- 不把 tool 体系直接升级成复杂插件平台
- 不一次性实现完整 autonomous agent framework
- 不为未来假设场景提前做过度抽象
- 不重写现有 auth/chat/schedule 模块边界

重点是**在当前项目现实边界内做主链路收口与运行时补强**。

---

## 4. 设计原则

### 4.1 Run 是执行真相源，不是页面拼出来的概念

无论是用户聊天触发还是 schedule 自动触发，最终都应该落到统一的 run 语义上。`ChatSession`、`ChatMessage`、`ToolExecution`、`ScheduleRun` 是 run 的不同关联对象或投影，而不是彼此平行的主语。

### 4.2 触发来源是变体，不是新系统

`user`、`schedule`、后续潜在的 `api`/`manual rerun` 只是触发来源不同，不应该演化成不同执行链路。它们应共享统一的状态机、事件模型、失败分类与诊断字段。

### 4.3 先统一语义，再补复杂能力

先把状态、事件、错误、超时、取消、诊断字段收口，再去扩多步 agent、更多 tool、更多入口。否则功能越多，排障越乱。

### 4.4 副作用统一出口

借鉴 Claude Code 的 `store + onChange` 思路：谁触发状态变化可以多入口，但通知、持久化、对外同步、衍生更新应尽量从统一出口发出，避免在控制器、service、页面组件中四处散落副作用。

### 4.5 KISS

只引入当前问题真正需要的结构：

- 不新建多余平台层
- 不为了“看起来更抽象”而加适配层
- 可以直接沿现有模块扩展的，优先沿现有模块扩展

---

## 5. 总体设计概览

本次设计分成两条并行设计主线，但实施上建议按阶段推进。

### 5.1 主线 A：执行主链路收口

核心任务：把当前分散在 chat、schedule、tool execution、前端页面消费中的执行语义收敛成统一主线。

主要结果：

- 明确统一的 run 状态机
- 明确统一的 run 事件模型
- 明确实时事件与历史投影的对应关系
- 明确 user / schedule 两类入口如何汇入同一条执行链

### 5.2 主线 B：Tool / Agent 能力升级

核心任务：让 tool 调用与 agent 执行从“业务逻辑中的调用过程”升级为“有边界、有状态、有诊断的运行时”。

主要结果：

- 统一 tool runtime contract
- 引入 intent routing / execution preparation
- 为多步 agent loop 留下稳定运行时边界
- 明确取消、超时、失败补偿、结构修复语义

### 5.3 两条主线的关系

A 负责让系统知道“这次执行整体发生了什么”，B 负责让系统知道“执行内部是怎么跑的”。

如果只做 A，不做 B，则 run 只是外壳统一，内部 agent/tool 仍然难以治理。
如果只做 B，不做 A，则 agent/tool 更强，但 chat/schedule/run 仍会各说各话。

因此本设计采用：

1. 先收口执行主线与共享语义
2. 再把 tool / agent runtime 纳入同一套语义之下

---

## 6. 架构与边界设计

## 6.1 后端执行主链路边界

建议将现有后端执行链路抽象为以下职责层次，但仍落在现有模块中逐步实现：

1. **Intent Entry**
   - 来源：chat request、schedule tick、后续 manual rerun
   - 职责：标准化触发上下文，生成统一 execution request

2. **Run Orchestrator**
   - 职责：创建 run、推进状态、记录阶段、协调 agent 执行、落诊断信息
   - 它是统一主链路的核心，不直接承载具体 tool 实现

3. **Agent Runtime**
   - 职责：处理 prompt 组装、模型调用、tool loop、流式文本、取消/超时/失败归类

4. **Tool Runtime**
   - 职责：校验输入、执行 tool、记录进度、归一化结果/失败、关联 run

5. **Projection / Persistence**
   - 职责：把执行结果投影到 `ChatMessage`、`ToolExecution`、`ScheduleRun` 等实体

这里不是新增五个全新模块，而是用这五层职责去约束现有 `chat` / `agent` / `tool` / `schedule` 模块的边界。

## 6.2 前端边界

前端建议从“页面自己拼执行语义”转向“store 消费统一投影，页面只负责交互和展示”。

拆分原则：

- `services/*`：只负责接口/SSE 通信
- `stores/*`：负责 domain state 与事件归并
- `pages/*`：负责页面级 view state 和交互编排
- `components/*`：纯展示或局部交互

尤其是聊天页与 runs/schedules 页，后续都应该尽量消费统一的 run/tool projection，而不是各自维护一套解释逻辑。

## 6.3 shared 契约边界

`packages/shared` 应继续作为前后端契约层，但需要从“共享 TypeScript 类型”增强到“共享执行语义模型”，重点包括：

- run status
- run trigger source
- run stage
- tool execution status
- event payload shape
- failure category / failure code

这里不要求一次性把所有 runtime schema 重构完，但至少要先统一最关键的枚举和 DTO 结构，减少 API、DB、前端三处各说各话。

---

## 7. 组件与数据流设计

## 7.1 统一执行对象模型

建议把核心执行对象关系收口为：

- `Run`
  - 本次执行的统一主对象
  - 记录触发来源、状态、阶段、错误分类、摘要、开始/结束时间
- `ChatSession`
  - 用户视角的会话容器
- `ChatMessage`
  - 聊天消息投影
- `ToolExecution`
  - run 内部工具调用投影
- `Schedule`
  - 调度定义
- `ScheduleRun`
  - schedule 视角下对 run 的关联投影或扩展诊断记录

如果当前数据库尚未有独立 `Run` 实体，也应至少先在 service/shared 层形成 run 语义对象，并逐步推动存储模型靠拢。

## 7.2 统一触发流

### 用户聊天触发

1. `POST /chat/stream`
2. 生成标准化 execution request
3. 创建 run / 关联 session
4. 进入 agent runtime
5. 过程中产出文本事件、tool 事件、状态事件
6. 事件一部分实时流给 Web，一部分持久化成历史投影
7. run 完成后统一收尾

### schedule 触发

1. tick 发现 due schedule
2. 生成标准化 execution request
3. 创建 run / 关联 schedule
4. 进入同一 agent runtime
5. 过程中产出相同结构的状态/工具/失败信息
6. 最终把结果投影到 `ScheduleRun` 与相关历史记录

两条路径只应在“触发上下文构造”处不同，后面尽量共享执行主链。

## 7.3 实时事件与历史投影

当前项目已经有 SSE 事件和历史数据两套表现。下一步不是废弃其中一套，而是明确它们的关系：

- **实时事件**：服务于当前运行中的 UI 反馈
- **历史投影**：服务于刷新后可恢复、列表可查看、诊断可追溯

建议统一事件大类，例如：

- `run_started`
- `run_stage_changed`
- `text_delta`
- `tool_started`
- `tool_progressed`
- `tool_completed`
- `tool_failed`
- `run_completed`
- `run_failed`

然后为每类事件定义其历史投影落点，避免出现“实时能看到，历史里找不到”或“历史有一套字段，流里又是另一套字段”的问题。

## 7.4 前端状态流

前端建议以 store 为中心完成事件归并：

1. 页面发起 chat / schedule 相关操作
2. `services` 建立 SSE / HTTP 调用
3. `stores` 接收事件并更新统一 domain state
4. 页面只订阅选择后的投影数据
5. 组件只展示，不重复推导执行语义

这会带来两个直接收益：

- 聊天页、runs 页、schedules 页能共享更多执行语义
- 页面局部重构不会影响整体执行模型

---

## 8. 错误处理、恢复与 Agent/Tool 升级设计

## 8.1 统一失败分类

建议先统一失败分类，而不是先实现复杂重试机制。最小可用分类可包括：

- `input_error`：用户输入或业务前置条件问题
- `tool_error`：具体 tool 失败
- `model_error`：LLM / provider 失败
- `dependency_error`：DB / Redis / 外部服务等依赖问题
- `timeout_error`：超时
- `system_error`：未归类内部错误
- `cancelled`：用户取消或系统中断

分类统一后，后端状态、shared DTO、前端展示、runs 诊断页才有统一语言。

## 8.2 状态机与阶段语义

建议为 run 至少明确以下状态：

- `pending`
- `running`
- `completed`
- `failed`
- `cancelled`

并补充阶段字段，例如：

- `preparing`
- `model_calling`
- `tool_running`
- `persisting`
- `finalizing`

状态回答“现在总体成功没”，阶段回答“卡在哪一段”。两者不能混用。

## 8.3 超时、取消与结构修复

借鉴 Claude Code 的可靠性思路，失败处理不能只停留在抛错层面。

需要明确：

1. **超时**：哪一层负责超时判定，超时后 run/tool 如何标记
2. **取消**：用户中断或系统取消时，tool sibling / stream 如何收尾
3. **结构修复**：如果流式过程中半途失败，哪些中间态要 tombstone、哪些要清理、哪些允许保留

对当前项目而言，最重要的不是完全照搬 Claude Code 的 tombstone 机制，而是补齐这类问题的系统语义：

- 中途失败的 assistant 文本如何展示
- 失败前已成功的 tool 调用是否保留
- 前端 streaming 状态怎样与最终历史记录对齐

## 8.4 Tool Runtime Contract

建议为 tool execution 明确统一 contract，至少包括：

- `tool name`
- `validated input`
- `runId`
- `invocationId/toolExecutionId`
- `startedAt/completedAt`
- `status`
- `progress payload`
- `result summary`
- `error category / error message`
- `cancel capability`

这不是为了做复杂抽象，而是为了避免 tool 调用仍然只是 agent 内部的一次黑盒函数调用。

## 8.5 Intent Routing

建议在 agent 执行前增加一个轻量 intent routing / execution preparation 层，负责：

- 识别本次执行的触发来源
- 标准化 system prompt / execution context
- 决定可用 tools、模型参数、运行限制
- 统一注入 run metadata / diagnostics metadata

这层不需要做成通用规则引擎。它的目标只是把“进入 agent 之前的准备动作”从控制器/service 的散乱逻辑中抽出来。

## 8.6 Agent Runtime 的渐进升级

当前不建议一步到位做成复杂 autonomous agent，而是分三步升级：

1. **Step 1：建立 `AgentRunContext`**
   - 持有 run metadata、trigger source、abort signal、tool policies、diagnostics sink

2. **Step 2：统一单轮 tool loop**
   - 先让一次模型调用中的 tool use / tool result / text delta 有清晰边界和归档方式

3. **Step 3：支持有限多步 loop**
   - 在已有状态、超时、取消、诊断语义稳定后，再支持多轮 tool → model → tool

这样做可以避免在 run 语义还没收口时，先把 agent runtime 做得过重。

---

## 9. 测试与实施落点

## 9.1 测试设计原则

这次改动不是单点功能，而是执行语义、事件语义、错误语义、前端投影语义的统一，因此测试不能只靠少量 happy path。

测试设计遵循四条原则：

1. **先保主链路，再补边界场景**
   - 优先覆盖 chat run、schedule run、tool execution 三条核心执行链
2. **先验证统一语义，再验证页面表现**
   - 先确保状态/事件/错误分类统一，再看 UI 是否正确消费
3. **自动化测试优先覆盖回归风险最高的位置**
   - 重点不是数量，而是防止后续继续把 run/chat/tool/schedule 语义拉散
4. **最终验收必须有真实浏览器链路**
   - 关键用户路径最终要通过真实浏览器验证，而不只靠单元测试

## 9.2 实施阶段建议

### Phase 1：统一语义与执行主线收口

优先处理：

- run 状态/阶段/失败分类统一
- user / schedule 触发共享 execution request 模型
- SSE 事件与历史投影关系统一
- shared 契约统一

主要落点：

- `apps/api/src/modules/chat/*`
- `apps/api/src/modules/schedule/*`
- `apps/api/src/modules/agent/*`
- `packages/shared/src/chat.ts`
- `packages/shared/src/tool.ts`
- `packages/shared/src/schedule.ts`

### Phase 2：前端状态与投影收口

优先处理：

- `chat-store` 承担更多 domain state 归并
- `ChatPage` 收缩为页面交互编排
- runs/schedules 页面消费统一 run/tool diagnostics projection
- API 错误展示从“粗粒度 request failed”升级为分层语义

主要落点：

- `apps/web/src/stores/chat-store.ts`
- `apps/web/src/pages/chat/ChatPage.tsx`
- `apps/web/src/pages/runs/RunsPage.tsx`
- `apps/web/src/pages/schedules/SchedulesPage.tsx`
- `apps/web/src/lib/api.ts`

### Phase 3：Tool / Agent Runtime 升级

优先处理：

- `AgentRunContext`
- tool runtime contract
- tool progress / cancellation / timeout 语义
- 有限多步 agent loop

主要落点：

- `apps/api/src/modules/agent/agent.service.ts`
- `apps/api/src/modules/tool/tool.service.ts`
- `apps/api/src/modules/tool/*`
- 必要时新增 runtime 辅助文件，但不新增大而全平台层

## 9.3 分层测试策略

### 9.3.1 Shared 契约层

目标：确保前后端共享的执行语义不会漂移。

至少覆盖：

- run status / run stage / trigger source 枚举的稳定性
- failure category / failure code 映射
- SSE event payload 与历史投影 DTO 的结构约束
- tool execution status 与错误字段的契约约束

推荐方式：

- `packages/shared` 下的类型/映射单元测试
- 对关键 DTO 映射函数做快照或显式断言测试

### 9.3.2 API 服务层

目标：确保 user-triggered 与 schedule-triggered 两条入口真正共享同一套执行语义。

至少覆盖：

- chat 请求创建 run 并正确推进状态
- schedule due 后创建 run 并正确推进状态
- tool 成功/失败/超时时 run 的阶段和最终状态是否正确
- 错误分类是否正确映射到 API 返回/SSE 事件/持久化记录
- 中途失败时历史投影与最终状态是否一致

推荐方式：

- 受影响 service 的单元测试
- `chat` / `schedule-runner` / `tool` 的集成测试
- 对关键失败分支补回归测试，而不是只测成功路径

### 9.3.3 SSE 与流式事件层

目标：确保实时事件与历史投影不再各说各话。

至少覆盖：

- `run_started -> text_delta -> tool_* -> run_completed` 的正常流
- `run_started -> tool_failed -> run_failed` 的失败流
- stream 中断、取消、超时后的最终收尾事件
- 前端实际消费到的事件序列是否满足约束

推荐方式：

- API 层对 SSE 事件序列的集成测试
- store 层对事件归并逻辑的单元测试

### 9.3.4 Web Store 与页面层

目标：确保页面不再自行拼业务主语义，而是稳定消费统一 projection。

至少覆盖：

- `chat-store` 对 run/tool/text 事件的归并
- ChatPage 在 streaming、失败、完成三种状态下的展示
- RunsPage 对失败原因、阶段、tool 摘要的展示
- SchedulesPage 对最近执行结果、关联 runs、状态摘要的展示
- API 错误映射后用户提示是否符合统一语义

推荐方式：

- store 单元测试
- 关键页面组件测试
- 对最容易回归的错误提示与空态做显式断言

## 9.4 关键测试场景清单

至少应明确覆盖以下场景：

### P0：主成功路径

1. 用户发起聊天，请求成功，产生文本输出并完成 run
2. 聊天过程中触发 tool，tool 成功完成并正确展示
3. schedule 到期后成功触发 run，并可在 runs 页面查看结果

### P1：主失败路径

4. tool 执行失败，run 最终失败，页面能正确展示失败原因
5. model/provider 调用失败，run 被标记为失败且错误分类正确
6. schedule 触发失败，runs 页面能回答失败发生在哪一阶段

### P2：恢复与边界路径

7. 流式过程中断开或超时，最终状态与历史投影保持一致
8. 用户取消执行后，run/tool 状态正确收尾
9. 已有部分 tool 成功后后续失败，前端展示与历史记录不冲突

### P3：契约一致性路径

10. shared 枚举变更时，API 与 Web 消费测试能及时失败
11. SSE event payload 结构变化时，store 测试能及时发现不兼容

## 9.5 阶段性验收测试要求

### Phase 1 验收

至少完成：

- shared 契约测试
- chat run / schedule run / tool execution 的关键 API 测试
- 失败分类与状态推进相关测试

目标：证明统一语义成立。

### Phase 2 验收

至少完成：

- `chat-store` 事件归并测试
- ChatPage / RunsPage / SchedulesPage 关键展示测试
- API 错误映射与 UI 提示测试

目标：证明前端已经基于统一 projection 工作。

### Phase 3 验收

至少完成：

- tool runtime contract 测试
- agent 多步或有限多步 loop 的关键测试
- 取消、超时、tool progress 的回归测试

目标：证明 agent/tool runtime 升级没有破坏主链路统一语义。

## 9.6 最终浏览器验收

功能完成后，应优先用真实浏览器流程验证：

- 聊天发起 → 流式文本 → tool 状态 → 完成/失败
- schedule 创建 → 自动触发 → runs 查看 → 失败诊断

最终浏览器验收重点不是替代自动化测试，而是确认：

- 真实交互顺序下页面状态是否连贯
- 流式与历史展示是否一致
- runs / schedules 诊断信息是否真的足够用户理解问题

## 9.7 验收标准

完成后至少应满足：

1. user-triggered 与 schedule-triggered 执行能映射到统一 run 语义
2. run、tool execution、chat/schedule 历史记录之间的关系更清楚
3. 实时流事件与历史投影不再明显割裂
4. 前端页面更多消费统一 projection，而不是页面内自行拼装主语义
5. tool / agent 执行的状态、失败、取消、超时更可诊断
6. 自动化测试已覆盖统一语义最关键的主路径、失败路径与边界路径
7. 最终浏览器验收可以验证聊天与 schedule/run 两条核心用户路径
8. 为后续多步 agent 升级留出稳定运行时边界，而不需要再次大幅重构主链路

---

## 10. 模块级落点建议

### API

- `apps/api/src/modules/chat/chat.controller.ts`
  - 收口 chat 触发入口与 SSE 事件结构
- `apps/api/src/modules/chat/chat.service.ts`
  - 负责 execution request 到 run 主线的承接
- `apps/api/src/modules/agent/agent.service.ts`
  - 收口 agent runtime、失败分类、tool loop
- `apps/api/src/modules/tool/tool.service.ts`
  - 收口 tool execution contract 与持久化语义
- `apps/api/src/modules/schedule/schedule-runner.service.ts`
  - 与 chat 共享统一 execution orchestration 语义
- `apps/api/src/modules/schedule/schedule.service.ts`
  - 保持 schedule 定义管理，不扩成调度平台

### Web

- `apps/web/src/stores/chat-store.ts`
  - 扩展为聊天执行域状态中心
- `apps/web/src/pages/chat/ChatPage.tsx`
  - 收缩本地 domain logic
- `apps/web/src/pages/runs/RunsPage.tsx`
  - 消费统一 run diagnostics projection
- `apps/web/src/pages/schedules/SchedulesPage.tsx`
  - 消费统一 schedule/run 关联视图
- `apps/web/src/lib/api.ts`
  - 统一 API 错误映射

### Shared

- `packages/shared/src/chat.ts`
- `packages/shared/src/tool.ts`
- `packages/shared/src/schedule.ts`

优先统一枚举、DTO 与错误/状态语义，而不是只做表面类型复用。

---

## 11. 风险与权衡

### 11.1 风险：一次改太多，影响当前可用链路

应对：按阶段推进，先统一语义与投影，再做更深的 runtime 升级。

### 11.2 风险：为了统一 run，反而引入过重抽象

应对：优先在现有模块内实现共享对象与共享流程，不急于抽独立 orchestration framework。

### 11.3 风险：前端状态收口时把页面都改穿

应对：先围绕 chat / runs / schedules 三条核心页面做最小必要收口，不做全站状态重构。

### 11.4 风险：agent 升级过早，掩盖主链路问题

应对：先把 run / event / projection / error 语义打稳，再推进多步 loop。

---

## 12. 结论

这次优化最值得借鉴 Claude Code 的地方，不是界面或产品形态，而是它对“执行主线”的尊重：输入、执行、工具、状态、失败恢复都围绕同一条会话/运行主线组织。

`ai-chat` 当前已经具备不错的能力基础，下一步不该继续沿着“加功能点”前进，而是要把已有 chat、schedule、run、tool execution、Web 状态消费收成同一套执行语言。

一句话总结：

**先把系统收成一条可追踪、可解释、可恢复的执行主链，再把 Agent 能力往上长。**
