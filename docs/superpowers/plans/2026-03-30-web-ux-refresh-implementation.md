# Web UX Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade web app from basic dark admin shell to cohesive Editorial Workspace UI with light/dark themes, shadcn/ui conventions, and consistent product polish.

**Architecture:** System-first approach—establish visual tokens and base components first, then migrate all pages (login/chat/schedules/runs/dashboard/admin) onto the unified system.

**Tech Stack:** React 19, TypeScript, Tailwind CSS v4, shadcn/ui conventions, Vite, Vitest

---

## Task 1: Visual Token System

**Files:**
- Create: `apps/web/src/styles/tokens.css`
- Modify: `apps/web/src/styles.css:1-46`

- [ ] **Step 1: Write failing test for theme toggle**

```typescript
// apps/web/src/__tests__/theme-toggle.test.tsx
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider, useTheme } from '../contexts/theme-context';

function TestComponent() {
  const { theme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button onClick={toggleTheme}>Toggle</button>
    </div>
  );
}

describe('ThemeProvider', () => {
  it('defaults to light theme', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
  });

  it('toggles between light and dark', async () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );
    expect(screen.getByTestId('current-theme')).toHaveTextContent('light');
    await userEvent.click(screen.getByRole('button'));
    expect(screen.getByTestId('current-theme')).toHaveTextContent('dark');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai-chat/web test -- theme-toggle.test.tsx`
Expected: FAIL with "Cannot find module '../contexts/theme-context'"

- [ ] **Step 3: Create theme context**

```typescript
// apps/web/src/contexts/theme-context.tsx
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem('theme');
    return stored === 'dark' ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai-chat/web test -- theme-toggle.test.tsx`
Expected: PASS

- [ ] **Step 5: Create visual token system**

```css
/* apps/web/src/styles/tokens.css */
@import 'tailwindcss';

:root {
  /* Light theme (default) */
  --background: 250 245 238;
  --surface: 255 255 255;
  --surface-muted: 247 244 238;

  --foreground: 31 41 55;
  --foreground-secondary: 107 114 128;
  --foreground-muted: 156 163 175;

  --border: 229 231 235;
  --border-active: 209 213 219;

  --accent: 139 92 246;
  --accent-hover: 124 58 237;
  --accent-focus: 139 92 246;

  --success: 34 197 94;
  --warning: 251 146 60;
  --error: 239 68 68;
  --info: 59 130 246;
}

.dark {
  --background: 7 9 13;
  --surface: 17 24 39;
  --surface-muted: 31 41 55;

  --foreground: 243 244 246;
  --foreground-secondary: 209 213 219;
  --foreground-muted: 156 163 175;

  --border: 55 65 81;
  --border-active: 75 85 99;

  --accent: 139 92 246;
  --accent-hover: 167 139 250;
  --accent-focus: 139 92 246;

  --success: 34 197 94;
  --warning: 251 146 60;
  --error: 239 68 68;
  --info: 59 130 246;
}
```

- [ ] **Step 6: Update global styles**

```css
/* apps/web/src/styles.css */
@import './tokens.css';

:root {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

html,
body,
#root {
  min-height: 100%;
}

body {
  margin: 0;
  background-color: rgb(var(--background));
  color: rgb(var(--foreground));
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
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

::selection {
  background: rgb(var(--accent) / 0.2);
  color: rgb(var(--foreground));
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/styles/tokens.css apps/web/src/styles.css apps/web/src/contexts/theme-context.tsx apps/web/src/__tests__/theme-toggle.test.tsx
git commit -m "feat(web): add visual token system and theme context"
```

---

## Task 2: Base UI Components

**Files:**
- Modify: `apps/web/src/components/ui/Button.tsx:1-22`
- Modify: `apps/web/src/components/ui/Input.tsx:1-11`
- Modify: `apps/web/src/components/ui/Textarea.tsx:1-11`
- Modify: `apps/web/src/components/ui/Card.tsx:1-6`
- Modify: `apps/web/src/components/ui/Badge.tsx:1-23`

- [ ] **Step 1: Write failing test for Button with tokens**

```typescript
// apps/web/src/__tests__/ui-button.test.tsx
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../components/ui';

describe('Button', () => {
  it('renders with primary variant', () => {
    render(<Button>Click me</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-[rgb(var(--accent))]');
  });

  it('renders with secondary variant', () => {
    render(<Button variant="secondary">Click me</Button>);
    const button = screen.getByRole('button');
    expect(button).toHaveClass('bg-[rgb(var(--surface-muted))]');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai-chat/web test -- ui-button.test.tsx`
Expected: FAIL with class mismatch

- [ ] **Step 3: Update Button component**

```typescript
// apps/web/src/components/ui/Button.tsx
import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const baseClassName =
  'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-focus))] focus-visible:ring-offset-2';

const variantClassName: Record<ButtonVariant, string> = {
  primary: 'bg-[rgb(var(--accent))] text-white hover:bg-[rgb(var(--accent-hover))]',
  secondary: 'bg-[rgb(var(--surface-muted))] text-[rgb(var(--foreground))] hover:bg-[rgb(var(--border-active))] border border-[rgb(var(--border))]',
  danger: 'bg-[rgb(var(--error))] text-white hover:opacity-90'
};

export function Button({ className = '', variant = 'primary', ...props }: ButtonProps) {
  const mergedClassName = `${baseClassName} ${variantClassName[variant]} ${className}`.trim();
  return <button {...props} className={mergedClassName} />;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @ai-chat/web test -- ui-button.test.tsx`
Expected: PASS

- [ ] **Step 5: Update Input component**

```typescript
// apps/web/src/components/ui/Input.tsx
import type { InputHTMLAttributes } from 'react';

export function Input({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm text-[rgb(var(--foreground))] outline-none ring-[rgb(var(--accent-focus))] placeholder:text-[rgb(var(--foreground-muted))] focus:border-[rgb(var(--border-active))] focus:ring-2 transition-all ${className}`.trim()}
    />
  );
}
```

- [ ] **Step 6: Update Textarea component**

```typescript
// apps/web/src/components/ui/Textarea.tsx
import type { TextareaHTMLAttributes } from 'react';

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm text-[rgb(var(--foreground))] outline-none ring-[rgb(var(--accent-focus))] placeholder:text-[rgb(var(--foreground-muted))] focus:border-[rgb(var(--border-active))] focus:ring-2 transition-all resize-none ${className}`.trim()}
    />
  );
}
```

- [ ] **Step 7: Update Card component**

```typescript
// apps/web/src/components/ui/Card.tsx
import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-sm ${className}`.trim()} />;
}
```

- [ ] **Step 8: Update Badge component**

```typescript
// apps/web/src/components/ui/Badge.tsx
import type { HTMLAttributes } from 'react';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantClassName: Record<BadgeVariant, string> = {
  neutral: 'bg-[rgb(var(--surface-muted))] text-[rgb(var(--foreground-secondary))] border border-[rgb(var(--border))]',
  success: 'bg-[rgb(var(--success)/0.1)] text-[rgb(var(--success))] border border-[rgb(var(--success)/0.2)]',
  warning: 'bg-[rgb(var(--warning)/0.1)] text-[rgb(var(--warning))] border border-[rgb(var(--warning)/0.2)]',
  error: 'bg-[rgb(var(--error)/0.1)] text-[rgb(var(--error))] border border-[rgb(var(--error)/0.2)]'
};

export function Badge({ className = '', variant = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${variantClassName[variant]} ${className}`.trim()}
    />
  );
}
```

- [ ] **Step 9: Commit**

```bash
git add apps/web/src/components/ui/Button.tsx apps/web/src/components/ui/Input.tsx apps/web/src/components/ui/Textarea.tsx apps/web/src/components/ui/Card.tsx apps/web/src/components/ui/Badge.tsx apps/web/src/__tests__/ui-button.test.tsx
git commit -m "feat(web): update base UI components with token system"
```

---

## Task 3: App Shell Redesign

**Files:**
- Modify: `apps/web/src/components/layout/AppShell.tsx:1-43`
- Create: `apps/web/src/components/layout/ThemeToggle.tsx`
- Modify: `apps/web/src/App.tsx:1-10`

- [ ] **Step 1: Write failing test for theme toggle in shell**

```typescript
// apps/web/src/__tests__/app-shell.test.tsx
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { ThemeProvider } from '../contexts/theme-context';
import { useAuthStore } from '../stores/auth-store';

describe('AppShell', () => {
  it('renders theme toggle button', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'token',
      user: { id: '1', email: 'test@example.com', role: 'USER', status: 'ACTIVE', createdAt: new Date().toISOString() }
    });

    render(
      <BrowserRouter>
        <ThemeProvider>
          <AppShell>Content</AppShell>
        </ThemeProvider>
      </BrowserRouter>
    );

    expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @ai-chat/web test -- app-shell.test.tsx`
Expected: FAIL with "Unable to find role button with name /theme/i"

- [ ] **Step 3: Create ThemeToggle component**

```typescript
// apps/web/src/components/layout/ThemeToggle.tsx
import { useTheme } from '../../contexts/theme-context';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="rounded-lg p-2 text-[rgb(var(--foreground-secondary))] hover:bg-[rgb(var(--surface-muted))] transition-colors"
      aria-label="Toggle theme"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ) : (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )}
    </button>
  );
}
```

- [ ] **Step 4: Update AppShell component**

```typescript
// apps/web/src/components/layout/AppShell.tsx
import { PropsWithChildren, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';
import { ThemeToggle } from './ThemeToggle';

function navClassName({ isActive }: { isActive: boolean }) {
  return [
    'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
    isActive
      ? 'bg-[rgb(var(--accent))] text-white'
      : 'text-[rgb(var(--foreground-secondary))] hover:bg-[rgb(var(--surface-muted))] hover:text-[rgb(var(--foreground))]'
  ].join(' ');
}

export function AppShell({ children, sidebar }: PropsWithChildren<{ sidebar?: ReactNode }>) {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="min-h-screen bg-[rgb(var(--background))] text-[rgb(var(--foreground))]">
      <header className="border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))] sticky top-0 z-10 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-8">
            <div className="flex flex-col">
              <strong className="text-lg font-semibold tracking-tight">AI Chat</strong>
              <span className="text-xs text-[rgb(var(--foreground-muted))]">Workspace</span>
            </div>
            <nav className="flex items-center gap-1">
              <NavLink className={navClassName} to="/chat">
                Chat
              </NavLink>
              <NavLink className={navClassName} to="/schedules">
                Schedules
              </NavLink>
              <NavLink className={navClassName} to="/runs">
                Runs
              </NavLink>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[rgb(var(--foreground-secondary))]">{user?.email}</span>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-7xl gap-6 px-6 py-6">
        {sidebar}
        <main className="min-w-0 flex-1 space-y-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ai-chat/web test -- app-shell.test.tsx`
Expected: PASS

- [ ] **Step 6: Wrap App with ThemeProvider**

```typescript
// apps/web/src/App.tsx
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ThemeProvider } from './contexts/theme-context';

export function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );
}
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/layout/AppShell.tsx apps/web/src/components/layout/ThemeToggle.tsx apps/web/src/App.tsx apps/web/src/__tests__/app-shell.test.tsx
git commit -m "feat(web): redesign app shell with theme toggle"
```

---

## Task 4: Login Page Refresh

**Files:**
- Modify: `apps/web/src/pages/login/LoginPage.tsx:1-80`

- [ ] **Step 1: Update LoginPage component**

```typescript
// apps/web/src/pages/login/LoginPage.tsx
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input } from '../components/ui';
import { useAuthStore } from '../stores/auth-store';
import { login } from '../services/auth';

export function LoginPage() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await login({ email, password });
      setAuth(response);
      navigate('/chat');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[rgb(var(--background))] px-4">
      <div className="w-full max-w-md space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-[rgb(var(--foreground))]">
            Welcome to AI Chat
          </h1>
          <p className="mt-2 text-sm text-[rgb(var(--foreground-secondary))]">
            Sign in to continue to your workspace
          </p>
        </div>

        <Card className="p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-4">
              <div className="space-y-2">
                <label htmlFor="email" className="block text-sm font-medium text-[rgb(var(--foreground))]">
                  Email
                </label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="password" className="block text-sm font-medium text-[rgb(var(--foreground))]">
                  Password
                </label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  disabled={loading}
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-[rgb(var(--error)/0.3)] bg-[rgb(var(--error)/0.1)] p-3 text-sm text-[rgb(var(--error))]">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? 'Signing in...' : 'Sign in'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/pages/login/LoginPage.tsx
git commit -m "feat(web): refresh login page with refined welcome UI"
```

---

## Task 5: Chat Page Components

**Files:**
- Modify: `apps/web/src/components/chat/EmptyChatState.tsx:1-15`
- Modify: `apps/web/src/components/chat/SessionSidebar.tsx:1-26`
- Modify: `apps/web/src/components/chat/ChatComposer.tsx:1-31`
- Modify: `apps/web/src/pages/chat/ChatPage.tsx:143-149`

- [ ] **Step 1: Update EmptyChatState**

```typescript
// apps/web/src/components/chat/EmptyChatState.tsx
import { Card } from '../ui';

export function EmptyChatState() {
  return (
    <Card className="flex flex-col items-center justify-center p-12 text-center">
      <div className="mb-4 rounded-full bg-[rgb(var(--accent)/0.1)] p-4">
        <svg className="h-8 w-8 text-[rgb(var(--accent))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-[rgb(var(--foreground))]">开始一个新的对话</h2>
      <p className="mt-2 text-sm text-[rgb(var(--foreground-secondary))]">
        在下方输入框中输入消息开始聊天
      </p>
    </Card>
  );
}
```

- [ ] **Step 2: Update SessionSidebar**

```typescript
// apps/web/src/components/chat/SessionSidebar.tsx
import type { ChatSessionSummary } from '@ai-chat/shared';
import { Button, Card } from '../ui';
import { SessionList } from './SessionList';

export function SessionSidebar(props: {
  sessions: ChatSessionSummary[];
  currentSessionId: string | null;
  onNewChat: () => void;
  onSelect: (sessionId: string) => void;
}) {
  return (
    <aside className="w-full max-w-xs shrink-0">
      <Card className="space-y-4 p-4">
        <Button className="w-full" onClick={props.onNewChat}>
          <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Chat
        </Button>
        <SessionList
          sessions={props.sessions}
          currentSessionId={props.currentSessionId}
          onSelect={props.onSelect}
        />
      </Card>
    </aside>
  );
}
```

- [ ] **Step 3: Update ChatComposer**

```typescript
// apps/web/src/components/chat/ChatComposer.tsx
import type { FormEvent } from 'react';
import { Button, Textarea } from '../ui';

export function ChatComposer(props: {
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    props.onSubmit();
  };

  return (
    <form className="rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 shadow-sm" onSubmit={handleSubmit}>
      <div className="space-y-3">
        <Textarea
          rows={4}
          value={props.value}
          disabled={props.disabled}
          onChange={(event) => props.onChange(event.target.value)}
          placeholder="输入消息..."
        />
        <div className="flex justify-end">
          <Button disabled={props.disabled || !props.value.trim()} type="submit">
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
            Send
          </Button>
        </div>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Update ChatPage header and error**

```typescript
// Replace lines 143-149 in apps/web/src/pages/chat/ChatPage.tsx
<Card className="p-6">
  <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--foreground))]">Chat</h1>
  <p className="mt-1 text-sm text-[rgb(var(--foreground-secondary))]">与 AI 助手对话</p>
</Card>
{!hasMessages ? <EmptyChatState /> : <MessageList messages={messages} />}
{errorMessage ? (
  <Card className="border-[rgb(var(--error)/0.3)] bg-[rgb(var(--error)/0.05)] p-4">
    <div className="flex items-start gap-3">
      <svg className="h-5 w-5 text-[rgb(var(--error))] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span className="text-sm text-[rgb(var(--error))]">{errorMessage}</span>
    </div>
  </Card>
) : null}
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/chat/EmptyChatState.tsx apps/web/src/components/chat/SessionSidebar.tsx apps/web/src/components/chat/ChatComposer.tsx apps/web/src/pages/chat/ChatPage.tsx
git commit -m "feat(web): refresh chat page components"
```

---

## Task 6: Message Display

**Files:**
- Modify: `apps/web/src/components/chat/MessageItem.tsx:1-30`
- Modify: `apps/web/src/components/chat/MessageList.tsx:1-13`

- [ ] **Step 1: Update MessageItem**

```typescript
// apps/web/src/components/chat/MessageItem.tsx
import type { UIMessage } from 'ai';
import { Card } from '../ui';

export function MessageItem({ message }: { message: UIMessage }) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <Card
        className={`max-w-[80%] p-4 ${
          isUser
            ? 'bg-[rgb(var(--accent)/0.1)] border-[rgb(var(--accent)/0.2)]'
            : 'bg-[rgb(var(--surface))]'
        }`}
      >
        <div className="mb-2 flex items-center gap-2">
          <span className="text-xs font-medium text-[rgb(var(--foreground-secondary))]">
            {isUser ? 'You' : 'Assistant'}
          </span>
        </div>
        <div className="whitespace-pre-wrap text-sm text-[rgb(var(--foreground))]">
          {message.content}
        </div>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Update MessageList**

```typescript
// apps/web/src/components/chat/MessageList.tsx
import type { UIMessage } from 'ai';
import { MessageItem } from './MessageItem';

export function MessageList({ messages }: { messages: UIMessage[] }) {
  return (
    <div className="space-y-6">
      {messages.map((message) => (
        <MessageItem key={message.id} message={message} />
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/chat/MessageItem.tsx apps/web/src/components/chat/MessageList.tsx
git commit -m "feat(web): refresh message display"
```

---

## Task 7: Tool Execution Display

**Files:**
- Modify: `apps/web/src/components/chat/ToolExecutionItem.tsx:1-40`

- [ ] **Step 1: Update ToolExecutionItem**

```typescript
// apps/web/src/components/chat/ToolExecutionItem.tsx
import type { ToolExecution } from '@ai-chat/shared';
import { Badge, Card } from '../ui';

const statusVariant: Record<ToolExecution['status'], 'neutral' | 'success' | 'warning' | 'error'> = {
  PENDING: 'neutral',
  RUNNING: 'warning',
  SUCCESS: 'success',
  FAILED: 'error'
};

export function ToolExecutionItem({ execution }: { execution: ToolExecution }) {
  return (
    <Card className="p-4 bg-[rgb(var(--surface-muted))]">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-[rgb(var(--accent)/0.1)] p-2 shrink-0">
          <svg className="h-4 w-4 text-[rgb(var(--accent))]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-[rgb(var(--foreground))]">{execution.toolName}</span>
            <Badge variant={statusVariant[execution.status]}>{execution.status}</Badge>
          </div>
          {execution.result && (
            <pre className="mt-2 overflow-x-auto rounded-md bg-[rgb(var(--background))] p-3 text-xs text-[rgb(var(--foreground-secondary))]">
              {JSON.stringify(execution.result, null, 2)}
            </pre>
          )}
        </div>
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/chat/ToolExecutionItem.tsx
git commit -m "feat(web): refresh tool execution display"
```

---

## Task 8: Schedules Page

**Files:**
- Modify: `apps/web/src/pages/schedules/SchedulesPage.tsx:1-50`
- Modify: `apps/web/src/components/schedules/ScheduleForm.tsx:1-150`

- [ ] **Step 1: Update SchedulesPage header**

```typescript
// Replace header section in apps/web/src/pages/schedules/SchedulesPage.tsx
<Card className="p-6">
  <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--foreground))]">Schedules</h1>
  <p className="mt-1 text-sm text-[rgb(var(--foreground-secondary))]">管理定时任务</p>
</Card>
```

- [ ] **Step 2: Update ScheduleForm styling**

```typescript
// Update form container in apps/web/src/components/schedules/ScheduleForm.tsx
<Card className="p-6">
  <h2 className="text-lg font-semibold text-[rgb(var(--foreground))] mb-4">
    {editingSchedule ? 'Edit Schedule' : 'Create Schedule'}
  </h2>
  <form onSubmit={handleSubmit} className="space-y-4">
    {/* form fields */}
  </form>
</Card>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/schedules/SchedulesPage.tsx apps/web/src/components/schedules/ScheduleForm.tsx
git commit -m "feat(web): refresh schedules page"
```

---

## Task 9: Runs Page

**Files:**
- Modify: `apps/web/src/pages/runs/RunsPage.tsx:1-40`
- Modify: `apps/web/src/components/runs/RunList.tsx:1-60`

- [ ] **Step 1: Update RunsPage header**

```typescript
// Replace header in apps/web/src/pages/runs/RunsPage.tsx
<Card className="p-6">
  <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--foreground))]">Runs</h1>
  <p className="mt-1 text-sm text-[rgb(var(--foreground-secondary))]">查看任务执行记录</p>
</Card>
```

- [ ] **Step 2: Update RunList status badges**

```typescript
// Update status rendering in apps/web/src/components/runs/RunList.tsx
<Badge variant={run.status === 'SUCCESS' ? 'success' : run.status === 'FAILED' ? 'error' : 'warning'}>
  {run.status}
</Badge>
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/runs/RunsPage.tsx apps/web/src/components/runs/RunList.tsx
git commit -m "feat(web): refresh runs page"
```

---

## Task 10: Dashboard and Admin Pages

**Files:**
- Modify: `apps/web/src/pages/dashboard/DashboardPage.tsx:1-30`
- Modify: `apps/web/src/pages/admin/AdminPage.tsx:1-30`

- [ ] **Step 1: Update DashboardPage**

```typescript
// apps/web/src/pages/dashboard/DashboardPage.tsx
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui';

export function DashboardPage() {
  return (
    <AppShell>
      <Card className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--foreground))]">Dashboard</h1>
        <p className="mt-1 text-sm text-[rgb(var(--foreground-secondary))]">系统概览</p>
      </Card>
      <Card className="p-6">
        <p className="text-sm text-[rgb(var(--foreground-secondary))]">Dashboard content coming soon</p>
      </Card>
    </AppShell>
  );
}
```

- [ ] **Step 2: Update AdminPage**

```typescript
// apps/web/src/pages/admin/AdminPage.tsx
import { AppShell } from '../components/layout/AppShell';
import { Card } from '../components/ui';

export function AdminPage() {
  return (
    <AppShell>
      <Card className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--foreground))]">Admin</h1>
        <p className="mt-1 text-sm text-[rgb(var(--foreground-secondary))]">系统管理</p>
      </Card>
      <Card className="p-6">
        <p className="text-sm text-[rgb(var(--foreground-secondary))]">Admin controls coming soon</p>
      </Card>
    </AppShell>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/pages/dashboard/DashboardPage.tsx apps/web/src/pages/admin/AdminPage.tsx
git commit -m "feat(web): refresh dashboard and admin pages"
```

---

## Task 11: Final Verification

**Files:**
- Test: All modified files

- [ ] **Step 1: Run lint**

Run: `pnpm --filter @ai-chat/web lint`
Expected: PASS with no errors

- [ ] **Step 2: Run tests**

Run: `pnpm --filter @ai-chat/web test`
Expected: All tests PASS

- [ ] **Step 3: Run build**

Run: `pnpm --filter @ai-chat/web build`
Expected: Build succeeds

- [ ] **Step 4: Manual browser verification**

Start dev server: `pnpm --filter @ai-chat/web dev`

Verify flows:
1. Login page displays with refined welcome UI
2. Theme toggle works in both light and dark modes
3. Chat page shows empty state, can send messages
4. Schedules page displays with consistent styling
5. Runs page displays with status badges
6. Dashboard and admin pages render correctly
7. All navigation links work
8. All pages maintain consistent visual language

- [ ] **Step 5: Final commit if needed**

```bash
git add .
git commit -m "chore(web): final UX refresh adjustments"
```

---

## Completion Checklist

- [ ] Visual token system established
- [ ] Theme toggle functional in light and dark modes
- [ ] Base UI components updated with token system
- [ ] App shell redesigned with refined navigation
- [ ] Login page refreshed with welcome UI
- [ ] Chat page components updated
- [ ] Message and tool execution display improved
- [ ] Schedules page aligned to new system
- [ ] Runs page aligned to new system
- [ ] Dashboard and admin pages updated
- [ ] All tests passing
- [ ] Build succeeds
- [ ] Browser verification complete

