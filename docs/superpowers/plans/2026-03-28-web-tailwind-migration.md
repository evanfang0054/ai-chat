# Web Tailwind Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `apps/web` 迁移为 Tailwind 主导的深色产品化界面，并统一 login、chat、schedules、runs、dashboard 与应用 shell 的视觉语言。

**Architecture:** 采用 Tailwind 作为唯一主样式系统，在 `apps/web` 中建立 theme token、基础 UI primitives 和页面组合层。保留现有路由、service、store 与 API 契约，只替换表现层和最少量组件结构，确保视觉统一且回归风险可控。

**Tech Stack:** React 19、Vite 6、Tailwind CSS 4、`@tailwindcss/vite`、Vitest、Testing Library

---

## File Structure

### New files

- `apps/web/src/lib/utils.ts` — 放置轻量 `cn()` className 合并函数，供 primitives 和页面复用。
- `apps/web/src/components/ui/button.tsx` — 统一按钮 variants（primary / secondary / ghost / danger）。
- `apps/web/src/components/ui/input.tsx` — 统一文本输入样式。
- `apps/web/src/components/ui/textarea.tsx` — 统一 textarea 样式。
- `apps/web/src/components/ui/select.tsx` — 统一 select 样式。
- `apps/web/src/components/ui/card.tsx` — 卡片容器和标题区。
- `apps/web/src/components/ui/badge.tsx` — 状态 badge。
- `apps/web/src/components/ui/page-header.tsx` — 页面标题、副标题与操作区。
- `apps/web/src/components/ui/empty-state.tsx` — 统一空态容器。
- `apps/web/tailwind.config.ts` — 定义 content 与 theme token。
- `apps/web/postcss.config.js` — 启用 Tailwind CSS PostCSS 管线。

### Modified files

- `apps/web/package.json` — 添加 Tailwind 相关依赖。
- `apps/web/vite.config.ts` — 接入 `@tailwindcss/vite`。
- `apps/web/src/main.tsx` — 保持样式入口，确保加载 Tailwind 基础层。
- `apps/web/src/styles.css` — 收缩为 Tailwind directives + 全局基础层。
- `apps/web/src/components/layout/AppShell.tsx` — 重做应用 shell 和导航。
- `apps/web/src/components/forms/LoginForm.tsx` — 替换为 primitives 组合。
- `apps/web/src/pages/login/LoginPage.tsx` — 重做登录页深色入口布局。
- `apps/web/src/components/chat/ChatComposer.tsx` — 重做输入区。
- `apps/web/src/components/chat/SessionSidebar.tsx` — 重做侧栏容器。
- `apps/web/src/components/chat/SessionList.tsx` — 套用统一列表和当前态样式。
- `apps/web/src/components/chat/MessageItem.tsx` — 消息气泡与 markdown 容器风格统一。
- `apps/web/src/components/chat/MessageList.tsx` — 重做消息区滚动容器。
- `apps/web/src/components/chat/ToolExecutionItem.tsx` — 工具执行卡片和状态 badge。
- `apps/web/src/components/chat/ToolExecutionList.tsx` — 工具执行区布局。
- `apps/web/src/components/chat/EmptyChatState.tsx` — 使用统一空态样式。
- `apps/web/src/pages/chat/ChatPage.tsx` — 调整整体网格和内容区布局。
- `apps/web/src/components/schedules/ScheduleForm.tsx` — 表单卡片化、列表卡片化。
- `apps/web/src/pages/schedules/SchedulesPage.tsx` — 页面结构分区、标题区、表单区与列表区。
- `apps/web/src/components/runs/RunList.tsx` — runs 列表卡片和状态信息。
- `apps/web/src/pages/runs/RunsPage.tsx` — 筛选区与详情区卡片化。
- `apps/web/src/pages/dashboard/DashboardPage.tsx` — 最低限度接入新 shell 与卡片风格。
- `apps/web/src/pages/admin/AdminPage.tsx` — 对齐新 shell 与视觉风格。
- `apps/web/src/__tests__/chat-page.test.tsx` — 保持语义断言，适配新结构。
- `apps/web/src/__tests__/runs-page.test.tsx` — 适配新结构。
- `apps/web/src/__tests__/schedules-page.test.tsx` — 适配新结构。
- `apps/web/src/__tests__/protected-route.test.tsx` — 如受全局布局影响，校正断言。

### Validation commands

- `pnpm --filter @ai-chat/web test`
- `pnpm --filter @ai-chat/web build`

---

### Task 1: 接入 Tailwind 基础设施

**Files:**
- Create: `apps/web/tailwind.config.ts`
- Create: `apps/web/postcss.config.js`
- Modify: `apps/web/package.json`
- Modify: `apps/web/vite.config.ts`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/src/main.tsx`
- Test: `apps/web/src/__tests__/protected-route.test.tsx`

- [ ] **Step 1: 为样式入口写一个最小失败测试，确认登录页仍能渲染根内容**

```tsx
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouterProvider } from 'react-router-dom';
import { router } from '../router';

describe('ProtectedRoute', () => {
  it('renders login page content when redirected', async () => {
    await router.navigate('/chat');
    render(<RouterProvider router={router} />);

    expect(await screen.findByRole('heading', { name: /login/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试，确认当前基线通过**

Run: `pnpm --filter @ai-chat/web test -- protected-route.test.tsx`
Expected: PASS，说明后续样式基础设施改动不会从一个已失败状态开始。

- [ ] **Step 3: 安装并配置 Tailwind 4 + Vite 插件**

`apps/web/package.json`
```json
{
  "devDependencies": {
    "@tailwindcss/postcss": "^4.1.13",
    "@tailwindcss/vite": "^4.1.13",
    "tailwindcss": "^4.1.13"
  }
}
```

`apps/web/vite.config.ts`
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: Number(process.env.WEB_PORT || 5173)
  },
  test: {
    environment: 'jsdom'
  }
});
```

`apps/web/postcss.config.js`
```js
export default {
  plugins: {
    '@tailwindcss/postcss': {}
  }
};
```

`apps/web/tailwind.config.ts`
```ts
import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#09090b',
        surface: '#111318',
        'surface-elevated': '#171a21',
        border: '#272b35',
        text: '#f4f7fb',
        'text-subtle': '#9aa4b2',
        muted: '#1b2029',
        primary: '#7dd3fc',
        'primary-foreground': '#07131d',
        success: '#34d399',
        warning: '#f59e0b',
        danger: '#fb7185',
        info: '#60a5fa',
        ring: '#38bdf8'
      },
      boxShadow: {
        panel: '0 12px 40px rgba(0, 0, 0, 0.35)',
        glow: '0 0 0 1px rgba(125, 211, 252, 0.16), 0 8px 30px rgba(0, 0, 0, 0.22)'
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem'
      },
      maxWidth: {
        shell: '1400px'
      }
    }
  }
} satisfies Config;
```

`apps/web/src/styles.css`
```css
@import 'tailwindcss';

:root {
  color-scheme: dark;
}

html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
  background:
    radial-gradient(circle at top, rgba(56, 189, 248, 0.12), transparent 28%),
    linear-gradient(180deg, #09090b 0%, #0d1015 100%);
  color: #f4f7fb;
  font-family: 'IBM Plex Sans', 'Segoe UI', sans-serif;
}

* {
  box-sizing: border-box;
}

a {
  color: inherit;
  text-decoration: none;
}

button,
input,
textarea,
select {
  font: inherit;
}
```

- [ ] **Step 4: 运行最小测试与 build，确认 Tailwind 接入成功**

Run: `pnpm --filter @ai-chat/web test -- protected-route.test.tsx && pnpm --filter @ai-chat/web build`
Expected: test PASS，build PASS，且不会再依赖旧的 `main {}` 全局样式。

- [ ] **Step 5: 提交基础设施改动**

```bash
git add apps/web/package.json apps/web/vite.config.ts apps/web/postcss.config.js apps/web/tailwind.config.ts apps/web/src/styles.css apps/web/src/main.tsx apps/web/src/__tests__/protected-route.test.tsx
git commit -m "build(web): 接入 tailwind 样式基础设施"
```

---

### Task 2: 建立基础 UI primitives 与深色应用 shell

**Files:**
- Create: `apps/web/src/lib/utils.ts`
- Create: `apps/web/src/components/ui/button.tsx`
- Create: `apps/web/src/components/ui/input.tsx`
- Create: `apps/web/src/components/ui/textarea.tsx`
- Create: `apps/web/src/components/ui/select.tsx`
- Create: `apps/web/src/components/ui/card.tsx`
- Create: `apps/web/src/components/ui/badge.tsx`
- Create: `apps/web/src/components/ui/page-header.tsx`
- Create: `apps/web/src/components/ui/empty-state.tsx`
- Modify: `apps/web/src/components/layout/AppShell.tsx`
- Modify: `apps/web/src/pages/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/pages/admin/AdminPage.tsx`
- Test: `apps/web/src/__tests__/protected-route.test.tsx`

- [ ] **Step 1: 写失败测试，确认 AppShell 导航和用户邮箱仍可见**

```tsx
it('shows app navigation links and signed-in email', async () => {
  useAuthStore.getState().setAuth({
    accessToken: 'token-123',
    user: {
      id: 'user-1',
      email: 'user@example.com',
      role: 'USER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    }
  });

  await router.navigate('/dashboard');
  render(<RouterProvider router={router} />);

  expect(await screen.findByRole('link', { name: 'Chat' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Schedules' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Runs' })).toBeInTheDocument();
  expect(screen.getByText('user@example.com')).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试，确认当前行为受保护**

Run: `pnpm --filter @ai-chat/web test -- protected-route.test.tsx`
Expected: PASS。

- [ ] **Step 3: 实现 primitives 与新的 AppShell**

`apps/web/src/lib/utils.ts`
```ts
export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(' ');
}
```

`apps/web/src/components/ui/button.tsx`
```tsx
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<ButtonVariant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-sky-300',
  secondary: 'border border-border bg-surface-elevated text-text hover:bg-muted',
  ghost: 'text-text-subtle hover:bg-muted hover:text-text',
  danger: 'border border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20'
};

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  const variant = props.variant ?? 'primary';
  return (
    <button
      {...props}
      className={cn(
        'inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
        variants[variant],
        className
      )}
    />
  );
}
```

`apps/web/src/components/ui/card.tsx`
```tsx
import type { PropsWithChildren } from 'react';
import { cn } from '../../lib/utils';

export function Card({ className, children }: PropsWithChildren<{ className?: string }>) {
  return <section className={cn('rounded-2xl border border-border bg-surface shadow-panel', className)}>{children}</section>;
}
```

`apps/web/src/components/layout/AppShell.tsx`
```tsx
import { PropsWithChildren, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { cn } from '../../lib/utils';

const navItem = ({ isActive }: { isActive: boolean }) =>
  cn(
    'rounded-xl px-3 py-2 text-sm transition',
    isActive ? 'bg-sky-400/15 text-primary' : 'text-text-subtle hover:bg-muted hover:text-text'
  );

export function AppShell({ children, sidebar }: PropsWithChildren<{ sidebar?: ReactNode }>) {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="min-h-screen bg-transparent text-text">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-shell items-center justify-between gap-6 px-6 py-4">
          <div className="flex items-center gap-6">
            <strong className="text-base font-semibold tracking-wide">ai-chat</strong>
            <nav className="flex items-center gap-2">
              <NavLink className={navItem} to="/chat">Chat</NavLink>
              <NavLink className={navItem} to="/schedules">Schedules</NavLink>
              <NavLink className={navItem} to="/runs">Runs</NavLink>
            </nav>
          </div>
          <span className="rounded-full border border-border bg-surface-elevated px-3 py-1 text-sm text-text-subtle">{user?.email}</span>
        </div>
      </header>
      <div className="mx-auto flex max-w-shell gap-6 px-6 py-6">
        {sidebar}
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
```

`apps/web/src/pages/dashboard/DashboardPage.tsx`
```tsx
import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui/card';
import { PageHeader } from '../../components/ui/page-header';

export function DashboardPage() {
  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="查看平台的聊天、调度与运行总览。" />
        <Card className="p-6">
          <p className="text-sm text-text-subtle">Dashboard 内容将在后续迭代补全，当前先接入统一视觉框架。</p>
        </Card>
      </div>
    </AppShell>
  );
}
```

- [ ] **Step 4: 运行保护性测试，确认导航与基础 shell 没有回归**

Run: `pnpm --filter @ai-chat/web test -- protected-route.test.tsx`
Expected: PASS，并且 `/dashboard` 下能看到新 shell 中的链接和邮箱。

- [ ] **Step 5: 提交 primitives 与 shell 改动**

```bash
git add apps/web/src/lib/utils.ts apps/web/src/components/ui apps/web/src/components/layout/AppShell.tsx apps/web/src/pages/dashboard/DashboardPage.tsx apps/web/src/pages/admin/AdminPage.tsx apps/web/src/__tests__/protected-route.test.tsx
git commit -m "feat(web): 建立基础 ui primitives 与应用 shell"
```

---

### Task 3: 重做登录页与通用表单风格

**Files:**
- Modify: `apps/web/src/components/forms/LoginForm.tsx`
- Modify: `apps/web/src/pages/login/LoginPage.tsx`
- Reuse: `apps/web/src/components/ui/button.tsx`
- Reuse: `apps/web/src/components/ui/input.tsx`
- Reuse: `apps/web/src/components/ui/card.tsx`
- Test: `apps/web/src/__tests__/protected-route.test.tsx`

- [ ] **Step 1: 写失败测试，固定登录页标题、按钮和错误文案**

```tsx
it('renders the styled login page and shows login errors', async () => {
  await router.navigate('/login');
  render(<RouterProvider router={router} />);

  expect(await screen.findByRole('heading', { name: 'Login' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试，确认行为基线可复用**

Run: `pnpm --filter @ai-chat/web test -- protected-route.test.tsx`
Expected: PASS。

- [ ] **Step 3: 用 primitives 重写登录页结构**

`apps/web/src/components/forms/LoginForm.tsx`
```tsx
import { FormEvent, useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';

export function LoginForm({ onSubmit }: { onSubmit: (values: { email: string; password: string }) => Promise<void> }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    try {
      await onSubmit({ email, password });
    } catch {
      setError('Login failed');
    }
  }

  return (
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="text-sm text-text-subtle" htmlFor="email">Email</label>
        <Input id="email" value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      <div className="space-y-2">
        <label className="text-sm text-text-subtle" htmlFor="password">Password</label>
        <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      </div>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      <Button className="w-full" type="submit">Sign in</Button>
    </form>
  );
}
```

`apps/web/src/pages/login/LoginPage.tsx`
```tsx
import { useNavigate } from 'react-router-dom';
import { LoginForm } from '../../components/forms/LoginForm';
import { Card } from '../../components/ui/card';
import { login } from '../../services/auth';
import { useAuthStore } from '../../stores/auth-store';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  async function handleLogin(values: { email: string; password: string }) {
    const response = await login(values);
    setAuth(response);
    navigate('/');
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 space-y-3">
          <div className="inline-flex rounded-full border border-sky-400/20 bg-sky-400/10 px-3 py-1 text-xs uppercase tracking-[0.24em] text-primary">
            AI Chat Workspace
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">Login</h1>
          <p className="text-sm leading-6 text-text-subtle">登录后即可访问聊天、调度与运行记录工作台。</p>
        </div>
        <LoginForm onSubmit={handleLogin} />
      </Card>
    </main>
  );
}
```

- [ ] **Step 4: 运行测试，确认登录语义和交互没有回归**

Run: `pnpm --filter @ai-chat/web test -- protected-route.test.tsx`
Expected: PASS。

- [ ] **Step 5: 提交登录页样式迁移**

```bash
git add apps/web/src/components/forms/LoginForm.tsx apps/web/src/pages/login/LoginPage.tsx apps/web/src/__tests__/protected-route.test.tsx
git commit -m "feat(web): 重做登录页与表单样式"
```

---

### Task 4: 重做 Chat 页面与相关组件

**Files:**
- Modify: `apps/web/src/components/chat/EmptyChatState.tsx`
- Modify: `apps/web/src/components/chat/SessionSidebar.tsx`
- Modify: `apps/web/src/components/chat/SessionList.tsx`
- Modify: `apps/web/src/components/chat/MessageItem.tsx`
- Modify: `apps/web/src/components/chat/MessageList.tsx`
- Modify: `apps/web/src/components/chat/ToolExecutionItem.tsx`
- Modify: `apps/web/src/components/chat/ToolExecutionList.tsx`
- Modify: `apps/web/src/components/chat/ChatComposer.tsx`
- Modify: `apps/web/src/pages/chat/ChatPage.tsx`
- Test: `apps/web/src/__tests__/chat-page.test.tsx`

- [ ] **Step 1: 扩展失败测试，固定 chat 页核心语义**

```tsx
it('renders chat layout with composer and sidebar actions', async () => {
  useAuthStore.getState().setAuth({
    accessToken: 'token-123',
    user: {
      id: 'user-1',
      email: 'user@example.com',
      role: 'USER',
      status: 'ACTIVE',
      createdAt: new Date().toISOString()
    }
  });

  vi.spyOn(chatService, 'listChatSessions').mockResolvedValue({ sessions: [] });

  await router.navigate('/chat');
  render(<RouterProvider router={router} />);

  expect(await screen.findByText('开始一个新的对话')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'New Chat' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Send' })).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行 chat 测试，确认当前行为稳定**

Run: `pnpm --filter @ai-chat/web test -- chat-page.test.tsx`
Expected: PASS。

- [ ] **Step 3: 以统一卡片与 badge 风格重写 Chat 相关组件**

`apps/web/src/components/chat/ChatComposer.tsx`
```tsx
import { Button } from '../ui/button';

export function ChatComposer(props: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-panel">
      <textarea
        className="min-h-32 w-full resize-none rounded-xl border border-border bg-background px-4 py-3 text-sm text-text outline-none transition placeholder:text-text-subtle focus-visible:ring-2 focus-visible:ring-ring"
        placeholder="输入消息，调用 agent 与工具能力…"
        value={props.value}
        disabled={props.disabled}
        onChange={(event) => props.onChange(event.target.value)}
      />
      <div className="mt-3 flex justify-end">
        <Button disabled={props.disabled} onClick={props.onSubmit}>Send</Button>
      </div>
    </div>
  );
}
```

`apps/web/src/components/chat/SessionSidebar.tsx`
```tsx
import type { ChatSessionSummary } from '@ai-chat/shared';
import { Button } from '../ui/button';
import { Card } from '../ui/card';
import { SessionList } from './SessionList';

export function SessionSidebar(props: {
  sessions: ChatSessionSummary[];
  currentSessionId: string | null;
  onNewChat: () => void;
  onSelect: (sessionId: string) => void;
}) {
  return (
    <aside className="w-full max-w-xs shrink-0">
      <Card className="sticky top-24 p-4">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-text-subtle">Sessions</h2>
          <Button variant="secondary" onClick={props.onNewChat}>New Chat</Button>
        </div>
        <SessionList sessions={props.sessions} currentSessionId={props.currentSessionId} onSelect={props.onSelect} />
      </Card>
    </aside>
  );
}
```

`apps/web/src/pages/chat/ChatPage.tsx`
```tsx
return (
  <AppShell
    sidebar={
      <SessionSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={() => {
          setCurrentSession(null);
          setMessages([]);
        }}
        onSelect={setCurrentSession}
      />
    }
  >
    <div className="flex min-h-[calc(100vh-12rem)] flex-col gap-4">
      <section className="flex-1 rounded-2xl border border-border bg-surface/80 p-4 shadow-panel">
        {messages.length === 0 && toolExecutions.length === 0 ? (
          <EmptyChatState />
        ) : (
          <MessageList messages={messages} toolExecutions={toolExecutions} />
        )}
      </section>
      <ChatComposer value={draft} disabled={isStreaming} onChange={setDraft} onSubmit={handleSubmit} />
    </div>
  </AppShell>
);
```

- [ ] **Step 4: 运行 chat 测试，确认流式消息、空态和查询字符串会话行为仍然正确**

Run: `pnpm --filter @ai-chat/web test -- chat-page.test.tsx`
Expected: PASS，且原有 “开始一个新的对话”“Send”“Hi there” 等断言全部通过。

- [ ] **Step 5: 提交 Chat 表现层迁移**

```bash
git add apps/web/src/components/chat apps/web/src/pages/chat/ChatPage.tsx apps/web/src/__tests__/chat-page.test.tsx
git commit -m "feat(web): 重做 chat 工作台界面"
```

---

### Task 5: 重做 Schedules 与 Runs 页面

**Files:**
- Modify: `apps/web/src/components/schedules/ScheduleForm.tsx`
- Modify: `apps/web/src/pages/schedules/SchedulesPage.tsx`
- Modify: `apps/web/src/components/runs/RunList.tsx`
- Modify: `apps/web/src/pages/runs/RunsPage.tsx`
- Test: `apps/web/src/__tests__/schedules-page.test.tsx`
- Test: `apps/web/src/__tests__/runs-page.test.tsx`

- [ ] **Step 1: 写失败测试，固定 Schedules 与 Runs 的标题、筛选、操作按钮语义**

```tsx
expect(await screen.findByRole('heading', { name: 'Schedules' })).toBeInTheDocument();
expect(screen.getByRole('button', { name: 'Create Schedule' })).toBeInTheDocument();
expect(await screen.findByRole('heading', { name: 'Runs' })).toBeInTheDocument();
expect(screen.getByLabelText('Status')).toBeInTheDocument();
```

- [ ] **Step 2: 运行页面测试，确认当前交互受保护**

Run: `pnpm --filter @ai-chat/web test -- schedules-page.test.tsx runs-page.test.tsx`
Expected: PASS。

- [ ] **Step 3: 重写 Schedules 表单与列表卡片布局**

`apps/web/src/components/schedules/ScheduleForm.tsx`
```tsx
return (
  <form className="space-y-4 rounded-2xl border border-border bg-surface p-6 shadow-panel" onSubmit={handleSubmit}>
    <h2 className="text-xl font-semibold">{props.initial ? 'Edit Schedule' : 'Create Schedule'}</h2>
    <div className="grid gap-4 md:grid-cols-2">
      <label className="space-y-2 md:col-span-2">
        <span className="text-sm text-text-subtle">Title</span>
        <input className="h-11 w-full rounded-xl border border-border bg-background px-4" name="title" type="text" required defaultValue={props.initial?.title ?? ''} />
      </label>
      <label className="space-y-2 md:col-span-2">
        <span className="text-sm text-text-subtle">Task Prompt</span>
        <textarea className="min-h-28 w-full rounded-xl border border-border bg-background px-4 py-3" name="taskPrompt" required rows={4} defaultValue={props.initial?.taskPrompt ?? ''} />
      </label>
      <label className="space-y-2">
        <span className="text-sm text-text-subtle">Type</span>
        <select className="h-11 w-full rounded-xl border border-border bg-background px-4" name="type" defaultValue={props.initial?.type ?? 'ONE_TIME'}>
          <option value="ONE_TIME">ONE_TIME</option>
          <option value="CRON">CRON</option>
        </select>
      </label>
      <label className="space-y-2">
        <span className="text-sm text-text-subtle">Timezone</span>
        <input className="h-11 w-full rounded-xl border border-border bg-background px-4" name="timezone" type="text" defaultValue={props.initial?.timezone ?? 'UTC'} />
      </label>
    </div>
    <div className="flex flex-wrap gap-3">
      <button className="rounded-xl bg-primary px-4 py-2 text-primary-foreground" type="submit">{props.initial ? 'Save' : 'Create Schedule'}</button>
      {props.onCancel ? <button className="rounded-xl border border-border px-4 py-2" type="button" onClick={props.onCancel}>Cancel</button> : null}
    </div>
  </form>
);
```

`apps/web/src/pages/schedules/SchedulesPage.tsx`
```tsx
return (
  <AppShell>
    <div className="space-y-6">
      <PageHeader title="Schedules" description="创建、编辑和删除定时任务，统一管理 agent 自动执行入口。" />
      <ScheduleForm onSubmit={handleCreate} />
      {editingSchedule ? (
        <ScheduleForm initial={editingSchedule} onSubmit={handleUpdate} onCancel={() => setEditingSchedule(null)} />
      ) : null}
      <ScheduleList schedules={schedules} onToggle={handleToggle} onEdit={setEditingSchedule} onDelete={handleDelete} />
    </div>
  </AppShell>
);
```

- [ ] **Step 4: 重写 Runs 页面筛选区、列表区和详情区**

`apps/web/src/components/runs/RunList.tsx`
```tsx
import { Link } from 'react-router-dom';
import type { ScheduleRunSummary } from '@ai-chat/shared';
import { Button } from '../ui/button';
import { Card } from '../ui/card';

export function RunList(props: { runs: ScheduleRunSummary[]; currentRunId: string | null; onSelect: (runId: string) => void }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">Runs</h2>
      {props.runs.length === 0 ? (
        <Card className="p-6"><p className="text-sm text-text-subtle">No runs yet.</p></Card>
      ) : (
        <div className="space-y-3">
          {props.runs.map((run) => (
            <Card className="p-4" key={run.id}>
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <strong className="text-base font-semibold">{run.schedule.title}</strong>
                  <div className="text-sm text-text-subtle">Prompt: {run.taskPromptSnapshot}</div>
                  <div className="text-sm text-text-subtle">Status: {run.status}</div>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => props.onSelect(run.id)} disabled={props.currentRunId === run.id}>View Details</Button>
                  {run.chatSessionId ? <Link className="rounded-xl border border-border px-4 py-2 text-sm" to={`/chat?sessionId=${run.chatSessionId}`}>Open Chat</Link> : null}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
```

`apps/web/src/pages/runs/RunsPage.tsx`
```tsx
return (
  <AppShell>
    <div className="space-y-6">
      <PageHeader title="Runs" description="查看定时任务最近执行记录，并按状态或 schedule 过滤。" />
      <section className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 text-lg font-semibold">Filters</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2">
                <span className="text-sm text-text-subtle">Status</span>
                <select className="h-11 w-full rounded-xl border border-border bg-background px-4" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                  <option value="">All</option>
                  <option value="PENDING">PENDING</option>
                  <option value="RUNNING">RUNNING</option>
                  <option value="SUCCEEDED">SUCCEEDED</option>
                  <option value="FAILED">FAILED</option>
                </select>
              </label>
              <label className="space-y-2">
                <span className="text-sm text-text-subtle">Schedule ID</span>
                <input className="h-11 w-full rounded-xl border border-border bg-background px-4" type="text" value={scheduleIdFilter} onChange={(event) => setScheduleIdFilter(event.target.value)} />
              </label>
            </div>
          </Card>
          <RunList runs={runs} currentRunId={currentRunId} onSelect={setCurrentRunId} />
        </div>
        <Card className="p-6">
          <h2 className="mb-4 text-lg font-semibold">Run Details</h2>
          {!selectedRun ? <p className="text-sm text-text-subtle">Select a run to inspect.</p> : <div className="space-y-3 text-sm text-text-subtle">...</div>}
        </Card>
      </section>
    </div>
  </AppShell>
);
```

- [ ] **Step 5: 运行两个页面测试，确认创建/编辑/删除/过滤/详情查看全部通过**

Run: `pnpm --filter @ai-chat/web test -- schedules-page.test.tsx runs-page.test.tsx`
Expected: PASS，且 `Create Schedule`、`Edit Schedule`、`Delete`、`Status`、`Open Chat` 等断言仍成立。

- [ ] **Step 6: 提交 Schedules 与 Runs 页面迁移**

```bash
git add apps/web/src/components/schedules/ScheduleForm.tsx apps/web/src/pages/schedules/SchedulesPage.tsx apps/web/src/components/runs/RunList.tsx apps/web/src/pages/runs/RunsPage.tsx apps/web/src/__tests__/schedules-page.test.tsx apps/web/src/__tests__/runs-page.test.tsx
git commit -m "feat(web): 重做 schedules 与 runs 管理界面"
```

---

### Task 6: 全量回归验证与浏览器验收

**Files:**
- Verify only: `apps/web/src/**`
- Test: `apps/web/src/__tests__/chat-page.test.tsx`
- Test: `apps/web/src/__tests__/runs-page.test.tsx`
- Test: `apps/web/src/__tests__/schedules-page.test.tsx`
- Test: `apps/web/src/__tests__/protected-route.test.tsx`

- [ ] **Step 1: 运行 web 相关测试套件**

Run: `pnpm --filter @ai-chat/web test`
Expected: PASS，所有既有页面语义断言继续通过。

- [ ] **Step 2: 运行 web build 验证生产构建**

Run: `pnpm --filter @ai-chat/web build`
Expected: PASS，Vite 正常产出构建，无 Tailwind 或 TS 类型报错。

- [ ] **Step 3: 用浏览器进行真实验收**

Run: 使用 `agent-browser` skill 打开本地 Web 应用，至少验证以下流程：

```text
1. 打开 /login，确认深色卡片登录页渲染正常
2. 登录后进入 /chat，确认侧栏、消息区、输入区风格统一
3. 进入 /schedules，确认创建表单、列表卡片、删除按钮层级正确
4. 进入 /runs，确认筛选区、runs 列表和详情卡片一致
```

Expected: 页面之间没有明显风格断裂，文字可读性良好，按钮/输入/badge/card 的视觉语言一致。

- [ ] **Step 4: 提交最终验证后的整理改动**

```bash
git add apps/web
 git commit -m "test(web): 完成 tailwind 界面迁移验收"
```

---

## Self-Review

### Spec coverage

- Tailwind 接入与 token 层：Task 1
- 外部 primitives / 基础 UI 层：Task 2
- 登录页深色产品化：Task 3
- Chat 工作台统一风格：Task 4
- Schedules / Runs 管理页统一风格：Task 5
- 测试与浏览器验收：Task 6

没有遗漏 spec 中的主要要求。

### Placeholder scan

- 没有使用 `TODO` / `TBD` / “类似 Task N” 之类占位符。
- 唯一需要在执行时补完的是 `Run Details` 中 `...` 所代表的现有字段展开，这里必须在实现时直接按当前字段全部渲染，不允许保留省略号。

### Type consistency

- 页面与测试继续使用现有 `CreateSchedule`、`Run Details`、`Send`、`Open Chat`、`Status` 等语义名称。
- `AppShell`、`ScheduleForm`、`RunList`、`ChatComposer` 的 props 名称与当前代码保持一致。

### Inline fix after review

执行 Task 5 Step 4 时，`Run Details` 区必须写成完整实现，不能保留 `...`。实际代码应为：

```tsx
<div className="space-y-3 text-sm text-text-subtle">
  <div>Run ID: {selectedRun.id}</div>
  <div>Schedule ID: {selectedRun.scheduleId}</div>
  <div>Chat Session ID: {selectedRun.chatSessionId ?? '—'}</div>
  <div>Status: {selectedRun.status}</div>
  <div>Prompt: {selectedRun.taskPromptSnapshot}</div>
  <div>Started: {selectedRun.startedAt ?? '—'}</div>
  <div>Finished: {selectedRun.finishedAt ?? '—'}</div>
  <div>Result: {selectedRun.resultSummary ?? '—'}</div>
  <div>Error: {selectedRun.errorMessage ?? '—'}</div>
</div>
```
