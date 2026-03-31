# 2026-03-31 统一改进总计划设计

## 1. 背景

`ai-chat` 当前已经完成基础闭环：

- API 侧已有 auth、chat、tool execution、schedule / runs 主链路
- Web 侧已有登录、聊天、dashboard、schedules、runs、admin 页面
- `packages/shared` 已承担前后端共享契约层职责

项目当前更像“已具备可用骨架、需要持续收口与补强”的阶段，而不是初始化阶段。

与此同时，现有文档存在两个需要明确区分的层次：

- `PROJECT_PLAN.md` 现在更适合作为**项目现状总览与方向性 backlog**
- `TECH_SUMMARY.md` 更适合作为**企业级 NestJS/Node 后端实践参考**，但不能直接作为本仓库当前实现蓝图

因此，本设计的目标不是推翻现有架构，而是在当前边界基础上形成一个**单一总 plan**，统一纳入生产化收口、schedule/run 运维化、产品补缺三类工作。

---

## 2. 目标

本次设计目标是形成一个**统一实施计划**，在同一个 plan 中按阶段推进以下三类工作：

1. 生产化基础收口
2. schedule / run 运维化
3. 产品补缺

最终结果应满足：

- 不重写现有架构，只做增量收口
- 按明确阶段顺序推进，避免多线并发导致边界混乱
- 每个阶段都有明确范围、落点、验收标准与非目标
- 后续可以直接基于该 spec 写实现 plan

---

## 3. 非目标

本轮设计明确不包含以下方向：

- 不做大规模架构重写
- 不引入重型 DDD / CQRS / 事件总线
- 不提前把 tool 体系平台化成复杂插件系统
- 不急于将 API / worker 真正拆成独立服务
- 不为了“更规范”重写 Web 状态管理
- 不将 `TECH_SUMMARY.md` 中不符合当前仓库现状的技术细节强行映射到本项目

本轮的重点是**收口与补强**，而不是“升级成更复杂的平台”。

---

## 4. 设计原则

### 4.1 以当前代码边界为准

优先沿现有模块边界扩展：

- API：`auth`、`chat`、`agent`、`tool`、`schedule`
- Web：`pages`、`stores`、`services`、`components`
- Shared：统一前后端契约

不额外引入新的跨层适配层或抽象层。

### 4.2 先可诊断，再扩功能

在 chat / tool / schedule / run 已形成真实执行链路后，系统首先需要做到：

- 出问题可定位
- 失败可分类
- 链路可追踪
- 配置可确认

否则继续补功能只会放大排障成本。

### 4.3 单一总 plan，阶段化推进

用户希望所有改进都纳入同一个 plan，因此采用：

- 一个总计划文档
- 三个阶段串行推进
- 每阶段单独验收

这样既保证统一视角，也避免实施时范围失控。

### 4.4 KISS

所有设计以简单直接为先：

- 优先补最小必要能力
- 不为假设的未来需求提前搭复杂框架
- 可通过当前边界解决的问题，不新增新的系统层次

### 4.5 测试先行纳入总 plan

本次统一总 plan 不只覆盖功能与架构调整，也必须显式纳入测试建设与最终验收：

- 每个阶段都要补与改动相匹配的 automated tests
- 后端与前端的关键主链路都要补 e2e 或接近 e2e 的集成验证
- 在功能完成后的最终验收阶段，使用 `agent-browser` 做真实浏览器端到端验证
- Web 层最终浏览器 e2e 验收的测试链路需要覆盖 P0 到 P5 级别测试用例，确保从核心主路径到重要异常/恢复/边界场景都有分级覆盖

这里的目标不是把测试体系做得很重，而是确保这份总 plan 从一开始就包含“实现 + 自动化验证 + 浏览器验收”三个层次。

---

## 5. 总体实施结构

统一总 plan 拆分为三个阶段：

1. Phase 1：生产化基础收口
2. Phase 2：schedule / run 运维化
3. Phase 3：产品补缺

三者是**串行依赖**而不是并列 backlog：

- Phase 1 解决“系统是否可控、可诊断”
- Phase 2 解决“调度链路是否可运维”
- Phase 3 解决“产品是否完整易用”

---

## 6. Phase 1：生产化基础收口

### 6.1 目标

先统一系统“怎么看、怎么报错、怎么配置”，为后续所有改进提供稳定底座。

### 6.2 范围

#### 6.2.1 统一链路标识与结构化日志

为 chat / run / tool execution / schedule execution 明确统一标识字段，并在关键入口与关键失败点补齐日志。

重点目标：任意一次失败都能串联到：

- user
- session
- run
- tool execution
- schedule

主要落点：

- `apps/api/src/modules/chat/chat.controller.ts`
- `apps/api/src/modules/chat/chat.service.ts`
- `apps/api/src/modules/agent/agent.service.ts`
- `apps/api/src/modules/tool/tool.service.ts`
- `apps/api/src/modules/schedule/schedule-runner.service.ts`
- `apps/api/src/modules/schedule/schedule-tick.processor.ts`

#### 6.2.2 统一状态语义与错误分层

统一 chat run、tool execution、schedule run 的状态集合，并明确以下错误层级：

- 用户输入/业务错误
- 外部依赖错误
- 系统内部错误

重点是让 API、持久化、shared 契约、前端展示的状态语义保持一致。

主要落点：

- `apps/api/src/modules/chat/chat.types.ts`
- `apps/api/src/modules/agent/agent.types.ts`
- `apps/api/src/modules/tool/tool.types.ts`
- `apps/api/src/modules/schedule/schedule.types.ts`
- `packages/shared/src/*`

#### 6.2.3 timeout 与关键失败处理

明确以下场景的处理策略：

- 流式聊天超时
- tool 执行超时
- schedule 执行超时
- 部分结果可保留与必须直接失败的边界

重点不是实现复杂重试，而是先定义清楚系统语义与持久化/回推行为。

主要落点：

- `apps/api/src/modules/chat/chat.service.ts`
- `apps/api/src/modules/agent/agent.service.ts`
- `apps/api/src/modules/tool/*`
- `apps/api/src/modules/schedule/schedule-runner.service.ts`

#### 6.2.4 最小可观测性补齐

补齐最小必要的 health/readiness 与关键运行可判断信息，至少能判断：

- DB 是否正常
- Redis 是否正常
- tick / queue 是否在工作
- run / tool 失败是否显著上升

主要落点：

- `apps/api/src/health.controller.ts`
- `apps/api/src/common/queue/*`
- `apps/api/src/modules/schedule/*`

#### 6.2.5 配置边界收敛

收敛以下配置的读取入口：

- LLM 相关配置
- queue / tick 相关配置
- auth 相关配置
- Web API base url
- 本地开发与容器部署共享的运行时配置边界

重点是减少业务代码直接散读环境变量，并降低多实例、多端口、多配置联调时的误判成本。

同时参考 `TECH_SUMMARY.md` 中 Docker 部署部分的经验，为当前仓库补齐**适配现状的轻量容器化约束**：

- 明确 API / Web 的 Docker 运行时配置注入边界
- 优先采用 multi-stage build 思路控制镜像职责，而不是把开发、构建、运行混在一个阶段
- 保持与现有 `infra/compose.yaml` 的本地依赖方式协同，不把容器化改造成新的复杂部署体系

主要落点：

- `apps/api/src/common/config/env.ts`
- `apps/api/src/common/queue/*`
- `apps/api/src/modules/llm/*`
- `apps/web/src/lib/env.ts`
- `apps/web/src/lib/api.ts`
- 根目录 `Dockerfile` / `apps/*` 下部署相关文件（如后续新增）
- `infra/compose.yaml`

#### 6.2.6 测试补齐与阶段性自动化验证

Phase 1 的每类改动都必须同步补测试，避免“日志和错误语义改了，但没有稳定回归保护”。

测试要求包括：

- 为状态语义、错误分层、关键服务逻辑补单元测试
- 为 chat / tool / schedule / run 关键链路补集成测试或现有测试增强
- 对配置边界和关键失败分支至少覆盖主要回归场景

重点不是追求测试数量，而是让 Phase 1 形成稳定的自动化回归基础，为后续 Phase 2 / 3 提供保护。

主要落点：

- `apps/api/src/modules/**/*.spec.ts`
- `apps/web/src/__tests__/*.test.tsx`
- 需要时新增受影响模块的测试文件

### 6.3 验收标准

完成后至少应满足：

1. 一次 chat 执行可追踪到对应 `session/run/tool execution`
2. 一次 schedule 执行可追踪到对应 `schedule/run`，并能判断失败阶段
3. shared 契约、后端状态、前端展示的状态语义一致
4. 至少能判断 DB、Redis、tick/queue 是否正常
5. 关键配置边界更清楚，联调时更容易确认当前实例与配置
6. 受影响主链路已补对应 automated tests，能为后续阶段提供基本回归保护
7. 配置边界、运行时注入方式与本地/容器部署差异更清楚，联调与部署时更容易确认当前实例与配置

### 6.4 非目标

- 不做完整 observability 平台
- 不引入复杂告警中心
- 不实现重型 retry orchestration

---

## 7. Phase 2：schedule / run 运维化

### 7.1 目标

在 Phase 1 提供的统一状态与日志语义基础上，把调度链路从“能跑”提升到“可诊断、可运维”。

### 7.2 范围

#### 7.2.1 补 run 诊断信息

为 run 增加足够的诊断字段，使页面或接口至少能回答：

- 谁触发了本次 run
- 执行到了哪个阶段
- 为什么失败
- 是否涉及 tool 调用
- 关键耗时如何

主要落点：

- `apps/api/src/modules/schedule/schedule.service.ts`
- `apps/api/src/modules/schedule/schedule-runner.service.ts`
- `packages/shared/src/schedule*`
- `apps/web/src/pages/runs/RunsPage.tsx`
- `apps/web/src/components/runs/RunList.tsx`

#### 7.2.2 补 schedule 执行上下文可见性

增强 schedules 页面和相关接口，使其清晰展示：

- enabled / disabled 状态
- next run 时间
- 最近执行结果
- 最近失败摘要
- 与 runs 的关联

主要落点：

- `apps/api/src/modules/schedule/schedule.controller.ts`
- `apps/api/src/modules/schedule/schedule.service.ts`
- `apps/web/src/pages/schedules/SchedulesPage.tsx`
- `apps/web/src/components/schedules/*`

#### 7.2.3 补 tool 执行与 run 的诊断关联

让 run 诊断视图至少能区分：

- agent 失败
- llm 失败
- tool 失败
- 系统内部失败

并提供最小必要的 tool 执行摘要信息。

主要落点：

- `apps/api/src/modules/tool/tool.service.ts`
- `apps/api/src/modules/agent/agent.service.ts`
- `packages/shared/src/tool*`
- Web 对应 runs/chat 展示层

#### 7.2.4 多实例 tick 风险治理

增加最小必要的配置或运行层提示，减少以下误判：

- 在新实例创建 schedule
- 实际由旧实例消费 tick 并执行

重点是让当前实例是否在消费 tick 更可见，而不是马上做复杂分布式协调系统。

主要落点：

- `apps/api/src/modules/schedule/schedule-tick.bootstrap.service.ts`
- `apps/api/src/modules/schedule/schedule-tick.processor.ts`
- `apps/api/src/common/queue/*`

#### 7.2.5 必要的手动重试 / 重跑能力

评估并视复杂度提供最小可用的 retry / rerun 入口，但必须明确语义边界：

- 重跑的是 schedule 定义
- 还是复用某次 run 的输入重新执行

避免在未定义清楚语义的前提下仓促加按钮。

主要落点：

- `apps/api/src/modules/schedule/*`
- `apps/web/src/pages/runs/*`
- `packages/shared/*`

#### 7.2.6 Web 端最终浏览器 e2e 验收前置要求

Phase 2 不再要求新增 API 层 e2e 测试；这里的 e2e 明确指 **Web 层通过 `agent-browser` 执行真实浏览器端到端验证**，用于确认 schedule / run 运维化改动在真实页面与真实交互中可用。

本阶段需要为后续最终浏览器验收做好前置条件，包括：

- schedule / run 页面与接口提供足够的诊断信息，便于真实浏览器流程校验
- 关键主链路具备稳定的 automated tests 作为回归保护
- 最终在 Web 层统一通过 `agent-browser` 验证 schedule 创建、启用、触发结果查看、run 结果查看等关键路径
- 为后续 Web 层最终 e2e 验收准备覆盖 P0 到 P5 分级测试用例所需的页面状态、诊断信息与可验证路径

主要落点：

- `apps/web/src/pages/schedules/*`
- `apps/web/src/pages/runs/*`
- `apps/web/src/components/schedules/*`
- `apps/web/src/components/runs/*`
- `apps/web/src/__tests__/*.test.tsx`
- 必要时补充受影响 API / shared 的非 e2e 自动化测试

### 7.3 验收标准

完成后至少应满足：

1. run 页面能回答“为什么失败”
2. schedule 页面能回答“最近执行得怎么样”
3. 多实例 tick 风险更可见，减少环境误判
4. schedule / run 主链路已具备 automated tests 回归保护，并可支撑后续 Web 层 `agent-browser` 浏览器 e2e 验收与 P0-P5 分级测试覆盖

### 7.4 非目标

- 不做完整调度中心
- 不做 DAG / workflow engine
- 不把 schedule 改造成独立工作流平台

---

## 8. Phase 3：产品补缺

### 8.1 目标

在底层与运维能力收口后，补足当前产品仍明显缺失的关键能力，提升使用完整度。

### 8.2 范围

#### 8.2.1 refresh token

补齐 auth 的续期能力，使登录态管理更接近真实产品环境。

主要落点：

- `apps/api/src/modules/auth/*`
- `apps/web/src/stores/auth-store.ts`
- `apps/web/src/services/auth.ts`
- `packages/shared/src/auth*`

#### 8.2.2 settings 页面

新增 settings 页面，但必须先明确边界，不做杂物页面。设置项应具备明确归属与用途。

主要落点：

- `apps/web/src/pages/*`
- `apps/web/src/router/index.tsx`
- 必要时新增 API / shared 契约

#### 8.2.3 聊天体验补强

继续打磨聊天页异常态、恢复态、空态，以及 tool execution 与主消息流之间的展示关系。

主要落点：

- `apps/web/src/pages/chat/ChatPage.tsx`
- `apps/web/src/stores/chat-store.ts`
- `apps/web/src/components/chat/*`

#### 8.2.4 schedules / runs 页面体验优化

提升筛选、状态标签、错误摘要与可读性，使非开发者也能理解主要执行状态。

主要落点：

- `apps/web/src/pages/schedules/*`
- `apps/web/src/pages/runs/*`
- 对应 service/store/components

#### 8.2.5 Web 端 automated tests 与最终浏览器验收

Phase 3 除了补产品能力本身，还必须把用户侧关键路径纳入测试与最终验收。

测试与验收要求包括：

- auth、settings、chat、schedules、runs 等受影响页面补对应 automated tests
- 对关键用户流程补近似 e2e 的自动化测试覆盖
- 在功能完成后的最终验收阶段，使用 `agent-browser` skill 做真实浏览器端到端验证，确认页面跳转、交互、状态展示与主链路行为符合预期
- Web 层最终浏览器 e2e 测试链路需覆盖 P0 到 P5 级别测试用例，至少覆盖核心主路径、关键运维路径、主要异常态、恢复态、权限边界与关键空态/边界场景

主要落点：

- `apps/web/src/__tests__/*.test.tsx`
- 需要时新增 API 集成测试
- 最终验收阶段通过 `agent-browser` 执行真实 UI 流程验证

### 8.3 验收标准

完成后至少应满足：

1. refresh token 工作正常，前后端 auth 契约一致
2. settings 页面边界明确，不成为杂物堆
3. 聊天失败态、空态、恢复态更自然
4. runs / schedules 页面更可读、更接近真实产品使用
5. 受影响用户路径具备对应 automated tests / 近似 e2e 覆盖，并完成一次基于 `agent-browser` 的真实浏览器验收
6. Web 层最终 e2e 测试链路已覆盖 P0 到 P5 级别测试用例，能够验证核心主路径与关键异常/恢复/边界场景

### 8.4 非目标

- 不做大规模 UI 重写
- 不做完整权限系统重构
- 不扩展到多租户、组织体系等更重产品能力

---

## 9. 阶段依赖与推荐执行顺序

### 9.1 总顺序

阶段顺序固定为：

1. Phase 1：生产化基础收口
2. Phase 2：schedule / run 运维化
3. Phase 3：产品补缺

原因：

- 先解决系统可控性
- 再解决调度链路可运维性
- 最后补产品完整度

### 9.2 Phase 1 内部顺序

1. 统一 shared / status / error 语义
2. 补 API 主链路日志
3. 补 schedule/run/tool 的关键日志与失败处理
4. 为上述改动补单元测试、集成测试与回归测试
5. 补 health / 最小可观测性
6. 收敛配置边界

### 9.3 Phase 2 内部顺序

1. 先补后端 run / schedule 诊断字段
2. 再更新 shared 契约
3. 再补 runs / schedules 页面展示
4. 补 schedule / run 主链路 e2e 或近似 e2e 验证
5. 最后再评估是否加 retry / rerun

### 9.4 Phase 3 内部顺序

1. 先 refresh token
2. 再 settings 页面
3. 再聊天与 runs / schedules 的体验优化
4. 补 Web 关键用户路径 automated tests / e2e
5. 最终使用 `agent-browser` 做真实浏览器端到端验收

---

## 10. 与现有文档的关系

### 10.1 `PROJECT_PLAN.md`

继续作为：

- 当前项目总览
- 已实现能力描述
- 方向性 backlog 入口

不承担详细实现计划职责。

### 10.2 `TECH_SUMMARY.md`

继续作为：

- 企业级 Node/NestJS 后端实践参考
- 工程与架构经验输入

不直接视作本仓库当前实现蓝图。

### 10.3 本文档的角色

本文档用于：

- 将多个改进方向统一收束到一个总 plan
- 为后续 implementation plan 提供阶段化设计输入
- 明确边界、依赖、优先级与验收标准

---

## 11. 结论

本设计建议采用：

- **一个统一总 plan**
- **三阶段串行推进**
- **每阶段独立验收**
- **整体目标是收口与补强，而不是重构或平台化升级**

该设计既满足“都要做，而且放在同一个 plan 里”的要求，又能控制实施范围，避免生产化、运维化、产品补缺三类工作在执行时互相打架。
