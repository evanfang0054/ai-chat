# 未完成项补齐 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐当前 docs 计划与代码现状之间的未完成项，重点完成 Web Tailwind 迁移收口与 AI schedule 管理行为验收闭环。

**Architecture:** 先做“计划-实现对照矩阵”锁定边界，再按“样式基础层 → primitives 层 → 页面组合层”完成 Web 迁移，最后做 AI schedule 行为规则测试与真实浏览器联调验收。保持现有业务接口与数据流不变，避免扩散式重构。

**Tech Stack:** React + Vite + Tailwind CSS、NestJS、Zod、Zustand、Vitest + Testing Library、Jest + Supertest、agent-browser

## Scope Matrix

| Plan | Item | Status | Evidence |
|---|---|---|---|
| 2026-03-28-web-tailwind-migration | Tailwind foundation | Partial | `apps/web/package.json`, `apps/web/vite.config.ts`, `apps/web/src/styles.css` |
| 2026-03-28-web-tailwind-migration | UI primitives layer | Missing | `apps/web/src/components/ui/*` |
| 2026-03-28-web-tailwind-migration | Page composition alignment | Partial | `apps/web/src/components/layout/AppShell.tsx`, `apps/web/src/pages/*` |
| 2026-03-27-ai-schedule-management | `manage_schedule` tool exists | Done | `apps/api/src/modules/tool/tools/manage-schedule.tool.ts` |
| 2026-03-27-ai-schedule-management | delete confirmation/disambiguation rules | Missing | `apps/api/test/ai-schedule-management.e2e-spec.ts` |

## Baseline Notes

- Task 1 / Step 2: `pnpm --filter @ai-chat/web lint` 已执行完成（无阻断错误）。
- Task 2 / Step 2: `pnpm --filter @ai-chat/web test -- schedules-page.test.tsx` 已执行并作为迁移基线参考。
- Task 3 / Step 2: `pnpm --filter @ai-chat/web test -- schedules-page.test.tsx` 已执行并确认替换后可访问性未回退。
- Task 4 / Step 2: `pnpm --filter @ai-chat/web test -- chat-page.test.tsx` 已执行并作为壳层导航基线参考。
- Task 5 / Step 2: `pnpm --filter @ai-chat/api test:e2e -- ai-schedule-management.e2e-spec.ts` 已执行，最终行为用例通过。
- Task 6 / Step 4: `pnpm --filter @ai-chat/web test`、`pnpm --filter @ai-chat/web build`、`pnpm --filter @ai-chat/api test`、`pnpm --filter @ai-chat/api test:e2e -- schedule.e2e-spec.ts` 已全部通过，详见最终报告。

---

## File Structure (planned changes)

### Web foundation
- Modify: `apps/web/package.json`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/src/styles.css`
- Modify (if needed by chosen setup): `apps/web/tailwind.config.js`

### Web UI primitives (new)
- Create: `apps/web/src/components/ui/Button.tsx`
- Create: `apps/web/src/components/ui/Input.tsx`
- Create: `apps/web/src/components/ui/Textarea.tsx`
- Create: `apps/web/src/components/ui/Card.tsx`
- Create: `apps/web/src/components/ui/Badge.tsx`
- Create: `apps/web/src/components/ui/index.ts`

### Web page composition
- Modify: `apps/web/src/components/layout/AppShell.tsx`
- Modify: `apps/web/src/pages/login/LoginPage.tsx`
- Modify: `apps/web/src/pages/chat/ChatPage.tsx`
- Modify: `apps/web/src/pages/schedules/SchedulesPage.tsx`
- Modify: `apps/web/src/pages/runs/RunsPage.tsx`

### AI schedule behavior validation
- Modify/Test: `apps/api/src/modules/agent/agent.service.ts`（仅在测试暴露缺口时改）
- Test: `apps/api/src/modules/tool/tools/manage-schedule.tool.ts`（配套单测）
- Test: `apps/api/test/schedule.e2e-spec.ts`
- Test (new): `apps/api/test/ai-schedule-management.e2e-spec.ts`

### Plan/report artifacts
- Create: `docs/superpowers/plans/2026-03-30-gap-closure.md`（执行中更新复选框）
- Create: `docs/superpowers/plans/2026-03-30-gap-closure-report.md`（最终 Done/Partial/Missing 证据报告）

---

### Task 1: 建立计划对照矩阵（冻结范围）

**Files:**
- Create: `docs/superpowers/plans/2026-03-30-gap-closure.md`
- Modify: `docs/superpowers/plans/2026-03-27-schedule-mvp.md`（只读对照，不改内容）
- Modify: `docs/superpowers/plans/2026-03-27-ai-schedule-management.md`（只读对照，不改内容）
- Modify: `docs/superpowers/plans/2026-03-28-web-tailwind-migration.md`（只读对照，不改内容）

- [x] **Step 1: 写对照矩阵骨架（先写文档）**

```md
## Scope Matrix

| Plan | Item | Status | Evidence |
|---|---|---|---|
| 2026-03-28-web-tailwind-migration | Tailwind foundation | Partial | apps/web/package.json |
| 2026-03-28-web-tailwind-migration | UI primitives layer | Missing | apps/web/src/components/ui/* |
| 2026-03-27-ai-schedule-management | manage_schedule tool exists | Done | apps/api/src/modules/tool/tools/manage-schedule.tool.ts |
```

- [x] **Step 2: 运行最小校验命令确认路径存在**

Run: `pnpm --filter @ai-chat/web lint`
Expected: lint 可执行，可能有 warning，但命令可运行。

- [ ] **Step 3: 提交矩阵初版（已合并到最终收口提交）**

```bash
git add docs/superpowers/plans/2026-03-30-gap-closure.md
git commit -m "docs: add gap-closure scope matrix for unfinished plan items"
```

---

### Task 2: Tailwind 基础层补齐（TDD/验证先行）

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/src/styles.css`
- Test: `apps/web/src/__tests__/schedules-page.test.tsx`
- Test: `apps/web/src/__tests__/runs-page.test.tsx`

- [x] **Step 1: 先写一个基础样式存在性测试（失败）**

```tsx
// 在 schedules-page.test.tsx 增加
it('renders schedule page shell heading', async () => {
  render(<SchedulesPage />);
  expect(await screen.findByRole('heading', { name: /schedules/i })).toBeInTheDocument();
});
```

- [x] **Step 2: 运行该测试确认当前基线**

Run: `pnpm --filter @ai-chat/web test -- schedules-page.test.tsx`
Expected: 当前通过或失败都可，记录结果到 gap 文档的 Baseline 小节。

- [x] **Step 3: 最小化修改 Tailwind 接入与全局层**

```ts
// vite.config.ts
import tailwindcss from '@tailwindcss/vite';
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: Number(process.env.WEB_PORT || 5170) },
  test: { environment: 'jsdom' }
});
```

```css
/* styles.css */
@import 'tailwindcss';

:root { color-scheme: dark; font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif; }
html, body, #root { min-height: 100%; }
body { margin: 0; background: #0b0f14; color: #f3f7fb; }
```

- [x] **Step 4: 回归测试**

Run: `pnpm --filter @ai-chat/web test`
Expected: 全部 PASS。

- [x] **Step 5: 构建验证**

Run: `pnpm --filter @ai-chat/web build`
Expected: build SUCCESS。

- [ ] **Step 6: 提交（已合并到最终收口提交）**

```bash
git add apps/web/package.json apps/web/vite.config.ts apps/web/src/styles.css
git commit -m "build(web): align tailwind foundation with migration plan"
```

---

### Task 3: 新增 primitives 层并接入（最小可用集）

**Files:**
- Create: `apps/web/src/components/ui/Button.tsx`
- Create: `apps/web/src/components/ui/Input.tsx`
- Create: `apps/web/src/components/ui/Textarea.tsx`
- Create: `apps/web/src/components/ui/Card.tsx`
- Create: `apps/web/src/components/ui/Badge.tsx`
- Create: `apps/web/src/components/ui/index.ts`
- Test: `apps/web/src/__tests__/chat-page.test.tsx`
- Test: `apps/web/src/__tests__/schedules-page.test.tsx`

- [x] **Step 1: 先写一个组件替换后的可访问性测试（失败）**

```tsx
it('keeps form controls accessible by label', () => {
  render(<SchedulesPage />);
  expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
});
```

- [x] **Step 2: 运行单测确认基线**

Run: `pnpm --filter @ai-chat/web test -- schedules-page.test.tsx`
Expected: FAIL（若控件无 label）或 PASS（记录基线）。

- [x] **Step 3: 实现最小 primitives**

```tsx
// Button.tsx
export function Button(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button {...props} className={`rounded-md px-3 py-2 text-sm ${props.className ?? ''}`} />;
}
```

```tsx
// Card.tsx
export function Card({ className = '', ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`rounded-xl border border-slate-800 bg-slate-900/60 ${className}`} />;
}
```

- [x] **Step 4: 页面中替换一处真实用法（先 schedules）**

```tsx
// SchedulesPage.tsx (示意)
<Card className="p-4">
  <h1 className="text-xl font-semibold">Schedules</h1>
</Card>
```

- [x] **Step 5: 运行 web 全量测试**

Run: `pnpm --filter @ai-chat/web test`
Expected: PASS。

- [ ] **Step 6: 提交（已合并到最终收口提交）**

```bash
git add apps/web/src/components/ui apps/web/src/pages/schedules/SchedulesPage.tsx apps/web/src/__tests__/schedules-page.test.tsx
git commit -m "feat(web): add ui primitives and wire schedules page"
```

---

### Task 4: 页面组合层统一（AppShell/Login/Chat/Schedules/Runs）

**Files:**
- Modify: `apps/web/src/components/layout/AppShell.tsx`
- Modify: `apps/web/src/pages/login/LoginPage.tsx`
- Modify: `apps/web/src/pages/chat/ChatPage.tsx`
- Modify: `apps/web/src/pages/schedules/SchedulesPage.tsx`
- Modify: `apps/web/src/pages/runs/RunsPage.tsx`
- Test: `apps/web/src/__tests__/chat-page.test.tsx`
- Test: `apps/web/src/__tests__/runs-page.test.tsx`
- Test: `apps/web/src/__tests__/schedules-page.test.tsx`

- [x] **Step 1: 先补壳层导航可见性测试（失败）**

```tsx
it('shows main nav entries', () => {
  render(<AppShell><div>content</div></AppShell>);
  expect(screen.getByRole('link', { name: /chat/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /schedules/i })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /runs/i })).toBeInTheDocument();
});
```

- [x] **Step 2: 执行测试**

Run: `pnpm --filter @ai-chat/web test -- chat-page.test.tsx`
Expected: baseline result recorded。

- [x] **Step 3: 最小改造 AppShell 样式结构**

```tsx
return (
  <div className="min-h-screen bg-slate-950 text-slate-100">
    <header className="border-b border-slate-800">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        ...
      </div>
    </header>
    <div className="mx-auto flex max-w-6xl gap-4 px-4 py-4">
      {sidebar}
      <main className="flex-1">{children}</main>
    </div>
  </div>
);
```

- [x] **Step 4: 同步更新 Login/Chat/Schedules/Runs 的卡片与间距体系**

```tsx
// 统一页面标题容器示例
<div className="mb-4 flex items-center justify-between">
  <h1 className="text-xl font-semibold">Runs</h1>
</div>
```

- [x] **Step 5: 运行测试与构建**

Run: `pnpm --filter @ai-chat/web test && pnpm --filter @ai-chat/web build`
Expected: PASS + build SUCCESS。

- [ ] **Step 6: 提交（已合并到最终收口提交）**

```bash
git add apps/web/src/components/layout/AppShell.tsx apps/web/src/pages/login/LoginPage.tsx apps/web/src/pages/chat/ChatPage.tsx apps/web/src/pages/schedules/SchedulesPage.tsx apps/web/src/pages/runs/RunsPage.tsx
git commit -m "feat(web): unify shell and major pages under tailwind composition"
```

---

### Task 5: AI schedule 管理行为验收补齐（删除确认/消歧/先 list）

**Files:**
- Test: `apps/api/test/ai-schedule-management.e2e-spec.ts` (Create)
- Test: `apps/api/test/schedule.e2e-spec.ts`
- Modify (only if test fails): `apps/api/src/modules/agent/agent.service.ts`
- Modify (only if test fails): `apps/api/src/modules/tool/tools/manage-schedule.tool.ts`

- [x] **Step 1: 先写失败用例（行为约束）**

```ts
it('asks for confirmation before delete action execution', async () => {
  // 构造 delete 意图但无确认，断言不会直接删除
  // 断言响应包含确认语义
});
```

```ts
it('lists schedules before ambiguous update target', async () => {
  // 构造两个相似任务，断言先触发 list/追问
});
```

- [x] **Step 2: 运行 e2e 测试确认失败**

Run: `pnpm --filter @ai-chat/api test:e2e -- ai-schedule-management.e2e-spec.ts`
Expected: FAIL（在未补齐行为规则前）。

- [x] **Step 3: 最小实现修复（仅在失败时）**

```ts
// agent.service.ts 伪代码示意
if (intent === 'delete_schedule' && !userConfirmed) {
  return askForConfirmation(targetSummary);
}
if (intentNeedsDisambiguation) {
  return askToChooseFromCandidates(candidates);
}
```

- [x] **Step 4: 重跑 API 测试**

Run: `pnpm --filter @ai-chat/api test -- manage-schedule && pnpm --filter @ai-chat/api test:e2e -- ai-schedule-management.e2e-spec.ts`
Expected: PASS。

- [ ] **Step 5: 提交（已合并到最终收口提交）**

```bash
git add apps/api/test/ai-schedule-management.e2e-spec.ts apps/api/src/modules/agent/agent.service.ts apps/api/src/modules/tool/tools/manage-schedule.tool.ts
git commit -m "test(api): enforce ai schedule management confirmation and disambiguation rules"
```

---

### Task 6: 真实浏览器联调 + 最终闭环报告

**Files:**
- Create: `docs/superpowers/plans/2026-03-30-gap-closure-report.md`

- [x] **Step 1: 启动单实例联调环境**

Run: `pnpm db:up && pnpm dev`
Expected: API 与 Web 可访问（避免多实例抢同一 Redis tick）。

- [x] **Step 2: 用 agent-browser 执行关键路径**

Run:
```bash
agent-browser open http://localhost:5170
agent-browser snapshot -i
```

覆盖路径：
1) 登录
2) Chat 页面发送消息并观察流式响应
3) Schedules 创建/编辑/启停/删除
4) Runs 查看状态 badge 与时间信息
5) 页面切换视觉一致性（shell/nav/card/form）

- [x] **Step 3: 记录验收证据**

```md
## Browser Validation
- Login: PASS
- Chat stream render: PASS
- Schedule create/update/delete: PASS
- Runs status readability: PASS
- Style consistency across pages: PASS
```

- [x] **Step 4: 回归命令收口**

Run:
- `pnpm --filter @ai-chat/web test`
- `pnpm --filter @ai-chat/web build`
- `pnpm --filter @ai-chat/api test`
- `pnpm --filter @ai-chat/api test:e2e -- schedule.e2e-spec.ts`

Expected: 全部 PASS。

- [ ] **Step 5: 提交最终报告（待最终统一提交）**

```bash
git add docs/superpowers/plans/2026-03-30-gap-closure-report.md docs/superpowers/plans/2026-03-30-gap-closure.md
git commit -m "docs: finalize gap closure report for unfinished plan items"
```

---

## Self-Review Checklist (applied)

- Spec coverage: 覆盖了 Tailwind 迁移缺口、primitives、页面统一、AI schedule 行为验收、浏览器真实联调。
- Placeholder scan: 已移除 TBD/TODO。
- Type consistency: 全文统一使用 `manage_schedule`、`SchedulesPage`、`AppShell` 等现有命名。
