# 2026-03-28 Web Tailwind Migration Design

## Summary

将 `apps/web` 从现有 `styles.css` 主导的样式方式迁移为 **Tailwind 主导** 的深色产品化界面。目标不是只修补 `SchedulesPage`，而是统一 `login`、`chat`、`schedules`、`runs`、`dashboard` 与应用 shell 的视觉语言，让当前 Web 端从“功能可用”升级为“可持续扩展的产品界面”。

本次允许引入 **Tailwind 兼容的外部组件库** 作为基础交互能力来源，但组件库不能接管最终视觉。Tailwind token 和页面级组合仍然是主体系。

## Goals

1. 为 `apps/web` 接入 Tailwind，并让其成为主样式系统。
2. 用统一的深色产品感重做应用框架层与主要页面。
3. 允许引入 Tailwind 友好的外部组件 primitives，提高基础交互质量与可访问性。
4. 将旧 `styles.css` 收缩为最薄的全局基础层，不再承担页面和组件造型。
5. 保持现有业务逻辑、API 契约、store 结构基本不变，降低功能回归风险。

## Non-Goals

1. 不改动 API、shared types 或后端接口。
2. 不在这次迁移中重构 Zustand store、service 层或路由结构。
3. 不引入会接管整套视觉体系的大型 UI 框架（如 Ant Design / Mantine 主题体系）。
4. 不为了样式迁移额外抽象复杂设计系统平台。

## Design Direction

整体风格为 **深色专业 AI 工作台**：

- 背景使用深灰近黑，而非纯黑，减少刺眼感。
- 卡片、输入区和导航区通过轻微亮度差建立层级。
- 边框和分割使用低对比描边，重点交互通过冷色 focus ring 和状态色突出。
- 视觉关键词是：**克制、稳定、专业、结构清晰**。
- 避免廉价赛博风、强霓虹、过量渐变和过度装饰。

视觉记忆点不依赖夸张特效，而依赖暗色界面下高度统一的布局与组件语言，让 `chat`、`schedules`、`runs` 看起来像同一个产品中的同一套体验。

## Styling Architecture

样式结构分为三层：

### 1. Tailwind theme / token layer

在 Tailwind 配置中定义统一 token：

- 语义颜色：`background`、`surface`、`surface-elevated`、`border`、`muted`、`text`、`text-subtle`
- 状态颜色：`success`、`warning`、`danger`、`info`
- 交互颜色：`primary`、`primary-foreground`、`ring`
- 圆角、阴影、最大宽度、常用间距与断点
- 字体体系：标题和正文都使用现代、偏产品感的字体组合，但保持高可读性

### 2. Primitive component layer

在 `apps/web/src/components` 下补齐或重写基础 UI primitives，例如：

- `Button`
- `Input`
- `Textarea`
- `Select`
- `Card`
- `Badge`
- `PageSection`
- `EmptyState`
- 如确有必要，再补 `Dialog` / `Tabs` / `Toast`

这些 primitives 可以基于外部组件库或 headless primitives 构建，但必须：

- 使用 Tailwind class 进行最终样式控制
- 共享统一 token
- 保持可访问性（focus、disabled、keyboard navigation）

### 3. Page composition layer

页面文件只负责业务结构与组合关系，不再写大块自定义 CSS。页面视觉通过 primitives + Tailwind utility 组合完成。

## Global CSS Strategy

`apps/web/src/styles.css` 的职责缩减为：

1. Tailwind directives
2. 根级字体和平滑渲染
3. `body` / `#root` 的基础背景与最小高度
4. 极少量全局选择器（如 markdown 内容的基础排版，如果确实无法合理放在组件内）

不再继续把表单、按钮、卡片、页面布局写在全局 CSS 中。

## External Component Library Strategy

允许引入外部组件库，但仅限 **Tailwind 兼容、可由本地样式接管的方案**，优先考虑：

- `shadcn/ui` 风格的本地组件生成方案
- `Radix UI` 这类 headless / primitive 能力层

不建议引入原因更强绑定默认视觉主题的大型组件库，否则会与“Tailwind 主导 + 自有产品风格”目标冲突。

原则是：

- **外部库提供行为与无障碍能力**
- **Tailwind token 提供视觉规范**
- **页面组合定义最终产品体验**

## Page-by-Page Plan

### App shell / navigation

统一主应用容器、导航入口和页面内容区：

- 建立稳定的深色 shell
- 统一页面标题、次级描述、主操作按钮位置
- 导航当前态清晰，hover/active/focus 一致
- 页面内容区最大宽度、边距和垂直节奏统一

### Login page

将登录页从功能页提升为产品入口页：

- 深色背景 + 中央登录卡片
- 清晰的标题、副标题和表单层级
- 输入框、按钮、错误状态与 loading 状态统一

### Chat page

保持现有 chat/store 数据流不动，重做表现层：

- 会话侧栏、消息区、输入区、tool execution 卡片风格统一
- assistant 文本可读性优先，markdown 内容做深色主题排版
- tool 状态通过 badge / card 边界强化识别
- 流式生成态与空态表现更完整

### Schedules page

从“原始表单 + 裸列表”升级成管理台样式：

- 创建 / 编辑表单采用卡片化结构
- `ONE_TIME` 与 `CRON` 的输入区更清晰
- schedule 列表项作为独立卡片展示标题、类型、prompt、下次运行时间、状态和操作按钮
- 删除、启停、编辑等操作具备明确主次关系

### Runs page

强调运行记录查看效率：

- 筛选区与结果列表层次清晰
- 状态 badge 明确展示 `SUCCEEDED` / `FAILED` / `RUNNING`
- 时间、schedule 来源和结果摘要更易扫描

### Dashboard

如果当前内容较少，至少先对齐 shell、标题、卡片和空态风格，避免与其他页面割裂。

## Interaction Design

统一以下交互细节：

- 按钮：primary / secondary / ghost / danger
- 输入控件：hover、focus-visible、disabled、invalid
- 列表项 / 卡片：hover 提升感但不过度动画
- Badge：状态色保持稳定映射
- 危险操作：删除按钮需要在视觉上与普通操作区分
- 表单布局：桌面端优先清晰分组，小屏下可以自然折叠为单列

动画保持克制：

- 仅使用短促 hover/focus 过渡
- 不引入夸张页面动效
- 将“专业工具感”优先于“视觉表演感”

## Testing and Validation

本次验收分三层：

### 1. Static validation

- `pnpm --filter @ai-chat/web test`
- `pnpm --filter @ai-chat/web build`

必要时补充针对新 primitives 的测试，避免只靠页面级断言。

### 2. UI regression check

更新受影响的页面测试，重点覆盖：

- 登录页仍可提交
- Chat 页面核心结构仍可渲染
- Schedules 页面创建 / 编辑 / 删除 / 启停仍可操作
- Runs 页面列表与筛选仍可工作

### 3. Browser validation

按仓库协作约定，功能完成后优先做真实浏览器联调，重点确认：

- 主导航与页面容器视觉统一
- 深色主题下文字可读性充足
- 表单输入、按钮、badge、卡片状态一致
- Chat / Schedules / Runs / Login 四类页面没有明显风格断裂
- 常见桌面宽度下布局稳定，窄屏至少不坏

## Risks and Mitigations

### Risk 1: 样式迁移范围大，页面容易出现遗漏

**Mitigation:** 先统一 shell 和 primitives，再逐页替换，避免边写边散。

### Risk 2: 外部组件库与 Tailwind token 冲突

**Mitigation:** 只选可被 Tailwind 接管视觉的库，不引入强主题框架。

### Risk 3: 旧 CSS 与新 utility 并存导致维护混乱

**Mitigation:** 明确 `styles.css` 只保留最小全局职责，新页面样式禁止继续写回旧模式。

### Risk 4: UI 改动影响现有测试断言

**Mitigation:** 保持语义结构和可访问名称稳定，优先通过角色和文本断言而不是脆弱的 DOM 结构断言。

## Implementation Boundary

这次实现预计主要影响：

- `apps/web/package.json`
- `apps/web` 下 Tailwind 配置相关文件
- `apps/web/src/main.tsx`
- `apps/web/src/styles.css`
- `apps/web/src/components/layout/*`
- `apps/web/src/components/chat/*`
- `apps/web/src/components/schedules/*`
- `apps/web/src/pages/*`
- `apps/web/src/__tests__/*`

如果需要新增少量基础 UI 组件文件，可以新增，但应控制在直接服务当前迁移目标的范围内，避免过度抽象。

## Recommendation

采用 **Tailwind 全量主导 + 外部 primitives 辅助** 的方案，一轮完成 Web 端主要页面和基础 UI 的视觉统一。这是最符合当前需求、又能保持后续扩展成本较低的路径。
