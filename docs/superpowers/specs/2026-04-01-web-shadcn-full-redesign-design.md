# 2026-04-01 Web 全页面 shadcn/ui 重构设计

## 1. 背景

当前 `apps/web` 已经具备登录、聊天、调度、运行追踪、设置和管理页面，但 UI 层主要依赖项目内自封装组件与页面级手写样式。现状问题不是功能缺失，而是整体体验、设计一致性、交互质量和可维护性不足。

本次重构目标不是新增业务能力，而是将前端展示层统一迁移到 `shadcn/ui` 组件体系，在保留现有品牌配色与明暗主题语义的前提下，重做 `apps/web` 的所有页面与共享布局，显著提升体验并降低后续 UI 演进成本。

## 2. 目标

### 2.1 核心目标
- 在 `apps/web` 内全面接入 `shadcn/ui`
- 保留现有品牌配色与 light / dark 主题语义
- 重做 `apps/web` 的所有页面，而不是只替换局部组件
- 允许优化页面内部信息层级、导航表现和布局组织
- 保持现有业务路由、核心业务流、API 契约和 store 主模型不变

### 2.2 非目标
- 不改后端 API
- 不改 `packages/shared` 业务契约
- 不重构 Zustand store 主状态模型
- 不重写 chat execution spine 的业务逻辑
- 不借机新增新的业务模块或产品能力
- 不重命名页面路由或做产品信息架构重构

## 3. 当前现状摘要

### 3.1 当前 UI 现状
当前 `apps/web` 使用的是项目内自封装基础组件，例如：
- `apps/web/src/components/ui/Button.tsx`
- `apps/web/src/components/ui/Input.tsx`
- `apps/web/src/components/ui/Textarea.tsx`
- `apps/web/src/components/ui/Card.tsx`
- `apps/web/src/components/ui/Badge.tsx`

这些组件可用，但设计语言较轻，交互覆盖面有限，页面层存在较多手工拼接样式与重复 UI 决策。

### 3.2 当前主题现状
当前主题通过 `apps/web/src/contexts/theme-context.tsx` 切换根节点 `.dark` class，颜色 token 定义在 `apps/web/src/styles/tokens.css`，已经具备：
- light / dark 双主题
- 背景、表面、前景、边框、强调色、状态色等品牌语义

这意味着本次迁移不应推翻主题系统，而应把现有 token 映射到 `shadcn/ui` 可消费的主题变量语义。

### 3.3 当前页面现状
本次重构覆盖 `apps/web` 当前全部页面：
- `/login`
- `/chat`
- `/dashboard`
- `/schedules`
- `/runs`
- `/settings`
- `/admin`

同时覆盖共享布局与页面级展示组件，包括但不限于：
- `AppShell`
- 导航区域
- 聊天页侧栏与消息区
- Schedule / Run 的列表、表单、状态展示
- 空态、错误态、loading 态

## 4. 方案对比

### 4.1 方案 A：只替换基础 UI 组件
只把 `Button`、`Input`、`Card` 等基础组件替换为 `shadcn/ui` 风格，页面结构尽量不动。

优点：
- 成本最低
- 变更面相对最小

缺点：
- 页面体验改善有限
- 无法解决布局层级和设计语言不统一的问题
- 不符合“所有页面重做”的目标

### 4.2 方案 B：基础组件 + 常用复合组件替换，局部页面优化
在基础组件外，引入 `Dialog`、`DropdownMenu`、`Tabs`、`Tooltip` 等，配合主要页面做局部重做。

优点：
- 体验提升明显
- 比全量页面重做风险更低

缺点：
- 新旧页面风格会共存一段时间
- 不满足“所有页面都重做”的要求

### 4.3 方案 C：全面接入 shadcn/ui 并重做所有页面（最终采用）
接入 `shadcn/ui` 组件体系，保留现有品牌主题语义，重做所有页面与共享布局，但不改路由和核心业务流。

优点：
- 用户体验提升最大
- 设计语言统一
- 后续新增页面和组件的维护成本最低

缺点：
- 范围最大
- 需要明确边界避免演变成产品重构

## 5. 最终决策

本次采用：

**全面接入 `shadcn/ui` + 保留现有品牌配色与明暗主题 + 重做 `apps/web` 所有页面 + 允许优化页面内部布局层级，但不改路由、API 契约与 store 主模型。**

这是一个“全量 UI 体验重构”，不是“业务重构”或“产品结构重构”。

## 6. 设计边界

### 6.1 保留不变的部分
- 页面路由语义保持不变
- 现有页面职责保持不变
- `services/*` 与后端接口对接方式保持不变
- `stores/*` 的主状态模型保持不变
- Chat 的 execution state 主链路保持不变

### 6.2 允许重构的部分
- `components/ui/*` 基础组件层
- `layout/*` 共享布局组件
- `forms/*` 表单展示组件
- `chat/*`、`runs/*`、`schedules/*` 等展示组件
- 页面布局、卡片层级、导航呈现、表单布局、状态样式
- loading / empty / error / disabled / streaming 等视觉与交互反馈

### 6.3 明确不做的部分
- 不引入新的业务功能
- 不改 API 数据结构
- 不改状态命名或状态机语义
- 不把页面重构扩展成新的产品 IA 重构

## 7. 组件体系设计

## 7.1 基础组件层
将在 `apps/web/src/components/ui` 中建立 `shadcn/ui` 为核心的基础组件体系，优先覆盖当前页面必需能力。

预计首批组件包括：
- Button
- Input
- Textarea
- Label
- Checkbox
- Switch
- Select
- Card
- Badge
- Separator
- Skeleton
- Alert
- Tooltip
- Dialog
- DropdownMenu
- Sheet
- Tabs
- ScrollArea
- Table
- Avatar
- Breadcrumb

原则：
- 只引入当前页面重构会实际使用的组件
- 优先复用 `shadcn/ui` 生成代码，避免继续手搓通用交互
- 项目保留源码级可控性，不依赖“黑盒 UI 库”运行时

## 7.2 业务展示组件层
基础组件之上，保留清晰的业务展示层，例如：
- Chat 会话侧栏
- 消息列表与消息项
- Tool execution 展示
- Run 状态列表
- Schedule 表单与列表
- 页面标题区和操作条

这些组件继续贴近业务语义，但内部展示能力收口到统一的 `shadcn/ui` 基础层。

## 7.3 旧组件退场策略
现有自研 `components/ui/*` 不应长期与新组件双轨共存。

策略：
- 迁移阶段允许短期桥接
- 页面完成替换后，删除不再使用的旧组件实现
- 最终只保留新的统一组件体系，避免未来继续混搭

## 8. 页面重做范围

## 8.1 LoginPage
目标：
- 重做登录页视觉层级与品牌表达
- 提升输入、错误提示、提交中状态与聚焦体验
- 让登录页成为整体设计语言的入口页面

## 8.2 ChatPage
目标：
- 重做聊天工作台布局
- 统一会话侧栏、消息区、输入区、运行态信息的层级
- 提升流式聊天与 tool execution 的可读性

约束：
- 不改变 `useChat` 与 store 协作主链路
- 不改变 timeline / run / tool execution 的核心消费模型

## 8.3 DashboardPage
目标：
- 统一概览区、状态卡片、近期活动和摘要信息层级
- 强化信息密度与可扫描性

## 8.4 SchedulesPage
目标：
- 重做 schedule 列表、筛选区、操作区与表单布局
- 提升启停、创建、编辑等交互反馈

## 8.5 RunsPage
目标：
- 重做 run 列表、状态徽标、诊断摘要和失败信息表现
- 强化 stage / failure category 的可读性

## 8.6 SettingsPage
目标：
- 重做设置分区和表单型 UI
- 统一开关、说明文案、二级设置布局

## 8.7 AdminPage
目标：
- 重做管理页结构与视觉优先级
- 体现管理态页面与普通用户页面的区分感

## 8.8 共享布局层
重做范围包括：
- `AppShell`
- 全局导航
- 页面标题区
- 容器宽度与内容栅格
- 通用空态 / 错误态 / loading 态
- 窄屏和移动端下的导航与内容折叠行为

## 9. 主题与视觉系统设计

## 9.1 总体策略
保留现有品牌配色与 light / dark 语义，不直接照搬 `shadcn/ui` 默认配色。

### 9.2 变量映射策略
把当前 token 语义映射为 `shadcn/ui` 常用变量，形成统一主题层。例如：
- 当前 `--surface` 映射到 `--card` / `--popover`
- 当前 `--accent` 映射到 `--primary` 或 `--accent`
- 当前 `--border` 映射到 `--border` / `--input`
- 当前状态色映射到 `--destructive` 等语义变量

最终 UI 使用 `bg-background`、`text-foreground`、`bg-card`、`text-muted-foreground`、`border-border`、`bg-primary` 等统一语义类，而不是继续大规模手写 `rgb(var(--...))` 组合。

## 9.3 主题切换策略
保留当前 `.dark` class 切换机制与 `ThemeProvider`，不重写主题切换入口。

这样可以：
- 维持现有行为稳定
- 降低重构期间的状态切换风险
- 让新旧页面在过渡期仍可共享同一个主题源

## 10. 技术实现策略

### 10.1 接入方式
根据 `shadcn/ui` 当前文档，采用 CSS Variables 主题方式，并保持 `components.json` 的 `tailwind.cssVariables = true`。

原因：
- 适合承接现有 token 体系
- 更适合主题扩展和后续组件新增
- 与当前 `.dark` 切换方式兼容

### 10.2 样式组织
- 在全局样式中建立 `shadcn/ui` 所需的主题变量层
- 保留项目自有 token 的品牌语义，但下沉为统一主题变量来源
- 页面和组件尽量改用语义化 Tailwind utility，而非重复拼接低层颜色 class

### 10.3 工具与依赖
引入 `shadcn/ui` 所需依赖与工具链，包括但不限于：
- `shadcn` CLI 初始化产物
- `class-variance-authority`
- `clsx`
- `tailwind-merge`
- `lucide-react`
- 所选组件依赖的 `@radix-ui/*`
- 动画相关依赖（如果组件需要）

### 10.4 结构约束
- 保持现有 `pages/`、`components/`、`services/`、`stores/` 分层
- 不因为引入 `shadcn/ui` 而把业务组件和基础组件混在一起
- 共享布局和业务展示组件继续维持语义化目录结构

## 11. 分阶段迁移策略

### 阶段 1：底座准备
- 初始化 `shadcn/ui`
- 建立 `components.json`
- 建立 `lib/utils.ts` 中的 `cn()`
- 建立主题变量映射
- 接入首批基础组件

### 阶段 2：共享布局重做
- 重做 `AppShell`
- 重做全局导航
- 重做页面标题区
- 收口通用空态 / 错误态 / loading 态

### 阶段 3：全页面重做
按页面逐步替换：
1. `LoginPage`
2. `DashboardPage`
3. `SchedulesPage`
4. `RunsPage`
5. `SettingsPage`
6. `AdminPage`
7. `ChatPage`

说明：`ChatPage` 放在最后，因为它是当前前端里交互和运行态最复杂的页面，需要在新设计系统稳定后再收尾。

### 阶段 4：清理与统一
- 删除旧自研基础 UI 组件
- 清理重复样式和无用 token
- 修正页面间设计不一致残留

## 12. 风险与应对

### 12.1 Tailwind CSS 4 与 shadcn/ui 接入细节风险
风险：当前仓库使用 Tailwind CSS 4，不能直接照搬旧版模板。

应对：
- 以当前文档推荐方式初始化
- 使用 CSS Variables 主题方式
- 接入前先确认 `components.json`、全局 CSS 和主题变量写法与当前版本一致

### 12.2 全页面改造范围过大
风险：UI 重构容易扩散为产品重构。

应对：
- 严格限制为“展示层与交互层重做”
- 不改路由、不改 API、不改 store 主模型
- 逐层替换，先共享框架、后页面

### 12.3 Chat 页面复杂度最高
风险：聊天页存在流式输出、会话切换、tool execution 和错误重试等复杂状态，容易在“改好看”时破坏行为。

应对：
- 仅重做展示组织，不重写执行主链路
- 重点验证 streaming、retry、tool execution 展示与 session 切换
- 聊天页在迁移顺序中最后处理

### 12.4 新旧 UI 混搭风险
风险：分阶段迁移期间可能出现明显割裂。

应对：
- 优先先搭统一底座和共享布局
- 旧基础组件只作过渡，不长期保留
- 全量页面完成后统一清理旧实现

## 13. 验收标准

### 13.1 工程验证
至少通过：
- `pnpm --filter @ai-chat/web lint`
- `pnpm --filter @ai-chat/web test`
- `pnpm --filter @ai-chat/web build`

### 13.2 UI 一致性验证
所有页面应满足：
- 统一的排版、间距、边框、圆角、阴影与交互语义
- 统一的 Button / Input / Card / Badge / Dialog / Menu 语言
- 不再出现旧 UI 与新 UI 明显混搭
- light / dark 模式下可正常展示

### 13.3 业务可用性验证
以下能力必须保持可用：
- 登录
- 聊天发送与流式输出
- tool execution 展示
- schedule 创建、编辑、启停
- runs 浏览
- settings 页面操作
- admin 页面访问控制

### 13.4 响应式与状态验证
至少验证：
- 桌面宽度下布局稳定
- 窄屏下导航和主要内容不崩坏
- loading / empty / error / disabled / streaming 状态表现合理

## 14. 实施结论

本次 Web UI 重构将以 `shadcn/ui` 为统一基础组件体系，保留现有品牌色与明暗主题语义，重做 `apps/web` 的所有页面与共享布局，同时将改造边界明确限制在展示层和交互层，不改业务主链路、路由语义、API 契约和 store 主模型。

该方案能够在不扩大到产品重构的前提下，最大化提升当前前端体验与一致性，并为后续页面扩展建立可持续的 UI 基础设施。
