# Web shadcn 全页面重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不改路由、API 契约和 chat/store 主链路的前提下，把 `apps/web` 全页面迁移到 `shadcn/ui` 语义化组件体系，并重做共享布局与页面展示层。

**Architecture:** 采用“底座先行、页面后迁”的方式推进：先建立 `shadcn/ui` 所需依赖、`components.json`、`cn()`、主题变量映射和基础组件，再重做 `AppShell` 与通用状态组件，最后按复杂度逐页迁移页面，收尾时删除旧自研 UI。业务数据流、服务调用和 Zustand 主模型保持不变，重构范围严格限制在展示层与交互层。

**Tech Stack:** React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Radix UI, Zustand, Vitest, Testing Library

---

## File Structure Map

### Theme / shadcn 底座
- Create: `apps/web/components.json` — shadcn CLI 配置，开启 CSS variables。
- Create: `apps/web/src/lib/utils.ts` — 提供 `cn()`。
- Modify: `apps/web/package.json` — 添加 `clsx`、`tailwind-merge`、`class-variance-authority`、`lucide-react`、`@radix-ui/*`。
- Modify: `apps/web/src/styles/tokens.css` — 将现有品牌 token 映射到 shadcn 语义变量。
- Modify: `apps/web/src/styles.css` — 引入全局 layer、基础排版、统一语义类依赖。
- Modify: `apps/web/tailwind.config.js` — 清理与 token 冲突的旧颜色扩展，仅保留必要扩展。

### 基础 UI 层
- Create/Replace: `apps/web/src/components/ui/button.tsx`
- Create/Replace: `apps/web/src/components/ui/input.tsx`
- Create/Replace: `apps/web/src/components/ui/textarea.tsx`
- Create: `apps/web/src/components/ui/label.tsx`
- Create: `apps/web/src/components/ui/select.tsx`
- Create: `apps/web/src/components/ui/card.tsx`
- Create: `apps/web/src/components/ui/badge.tsx`
- Create: `apps/web/src/components/ui/separator.tsx`
- Create: `apps/web/src/components/ui/skeleton.tsx`
- Create: `apps/web/src/components/ui/alert.tsx`
- Create: `apps/web/src/components/ui/dialog.tsx`
- Create: `apps/web/src/components/ui/dropdown-menu.tsx`
- Create: `apps/web/src/components/ui/sheet.tsx`
- Create: `apps/web/src/components/ui/scroll-area.tsx`
- Create: `apps/web/src/components/ui/tabs.tsx`
- Modify: `apps/web/src/components/ui/index.ts` — 统一导出新组件。
- Delete later: `apps/web/src/components/ui/Button.tsx`, `Input.tsx`, `Textarea.tsx`, `Card.tsx`, `Badge.tsx`

### 共享布局 / 通用展示
- Modify: `apps/web/src/components/layout/AppShell.tsx` — 新导航、移动端 sheet、顶部栏、页面容器。
- Modify: `apps/web/src/components/layout/ThemeToggle.tsx` — 改为 shadcn Button/Dropdown 或 IconButton 表达。
- Create: `apps/web/src/components/layout/PageHeader.tsx` — 页面标题、说明、操作区。
- Create: `apps/web/src/components/layout/AppSidebarNav.tsx` — 导航项渲染。
- Create: `apps/web/src/components/common/EmptyState.tsx`
- Create: `apps/web/src/components/common/StateAlert.tsx`
- Create: `apps/web/src/components/common/SectionCard.tsx`

### 页面与业务展示
- Modify: `apps/web/src/pages/login/LoginPage.tsx`
- Modify: `apps/web/src/pages/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/pages/settings/SettingsPage.tsx`
- Modify: `apps/web/src/pages/admin/AdminPage.tsx`
- Modify/Split: `apps/web/src/components/schedules/ScheduleForm.tsx`
- Create: `apps/web/src/components/schedules/ScheduleList.tsx`
- Create: `apps/web/src/components/schedules/ScheduleHealthSummary.tsx`
- Modify: `apps/web/src/pages/schedules/SchedulesPage.tsx`
- Modify: `apps/web/src/components/runs/RunList.tsx`
- Create: `apps/web/src/components/runs/RunDiagnosticsCard.tsx`
- Modify: `apps/web/src/pages/runs/RunsPage.tsx`
- Modify: `apps/web/src/pages/chat/ChatPage.tsx`
- Modify: `apps/web/src/components/chat/*` — 统一消息、侧栏、composer、tool execution 展示风格。

### 测试
- Modify: `apps/web/src/__tests__/ui-button.test.tsx` — 从 class 细节断言改为语义/variant 行为断言。
- Modify: `apps/web/src/__tests__/app-shell.test.tsx` — 覆盖新导航与移动端触发器。
- Modify: `apps/web/src/__tests__/chat-page.test.tsx` — 保留行为测试，放宽对具体 DOM/文案结构的耦合。
- Create: `apps/web/src/__tests__/theme-tokens.test.tsx` — 验证主题切换仍通过 `.dark` 生效。
- Create: `apps/web/src/__tests__/schedule-form.test.tsx` — 验证 CRON / ONE_TIME 表单切换。
- Create: `apps/web/src/__tests__/runs-page.test.tsx` — 验证筛选、选择和重试按钮状态。

---

## Task 1: 建立 shadcn 底座与主题变量映射

Status: 已完成（2026-04-02）。已补充 `theme-tokens.test.tsx` 锁定 `.dark` class strategy，新增 `components.json` 与 `src/lib/utils.ts`，补齐 shadcn/Radix 依赖，完成语义主题变量与 `@theme inline` 映射，将 `tailwind.config.js` 收紧为仅保留 accordion 动画扩展，并补齐 `@/*` alias 到 `tsconfig.json` 与 `vite.config.ts` 以匹配 `components.json`。

**Files:**
- Create: `apps/web/components.json`
- Create: `apps/web/src/lib/utils.ts`
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/styles/tokens.css`
- Modify: `apps/web/src/styles.css`
- Modify: `apps/web/tailwind.config.js`
- Test: `apps/web/src/__tests__/theme-tokens.test.tsx`

- [ ] **Step 1: 写主题切换失败测试**

```tsx
// apps/web/src/__tests__/theme-tokens.test.tsx
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { ThemeProvider } from '../contexts/theme-context';

function ThemeProbe() {
  return <div>theme-ready</div>;
}

describe('theme tokens', () => {
  it('mounts without removing the existing dark-class strategy', () => {
    localStorage.setItem('theme', 'dark');
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );

    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });
});
```

- [ ] **Step 2: 运行测试确认当前失败**

Run: `pnpm --filter @ai-chat/web test -- theme-tokens.test.tsx`
Expected: FAIL，因为测试文件尚不存在。

- [ ] **Step 3: 添加 shadcn 初始化文件与工具函数**

```json
// apps/web/components.json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "src/styles.css",
    "baseColor": "zinc",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```

```ts
// apps/web/src/lib/utils.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 4: 安装并声明依赖**

```json
// apps/web/package.json（只展示新增依赖）
{
  "dependencies": {
    "@radix-ui/react-dialog": "^1.1.14",
    "@radix-ui/react-dropdown-menu": "^2.1.15",
    "@radix-ui/react-label": "^2.1.7",
    "@radix-ui/react-scroll-area": "^1.2.10",
    "@radix-ui/react-select": "^2.2.5",
    "@radix-ui/react-separator": "^1.1.7",
    "@radix-ui/react-slot": "^1.2.3",
    "@radix-ui/react-tabs": "^1.1.12",
    "@radix-ui/react-tooltip": "^1.2.7",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "lucide-react": "^0.542.0",
    "tailwind-merge": "^3.3.1"
  }
}
```

- [ ] **Step 5: 把品牌 token 映射成 shadcn 语义变量**

```css
/* apps/web/src/styles/tokens.css */
@import 'tailwindcss';

:root {
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

  --card: var(--surface);
  --card-foreground: var(--foreground);
  --popover: var(--surface);
  --popover-foreground: var(--foreground);
  --primary: var(--accent);
  --primary-foreground: 255 255 255;
  --secondary: var(--surface-muted);
  --secondary-foreground: var(--foreground);
  --muted: var(--surface-muted);
  --muted-foreground: var(--foreground-secondary);
  --accent-foreground: 255 255 255;
  --destructive: var(--error);
  --destructive-foreground: 255 255 255;
  --input: var(--border);
  --ring: var(--accent-focus);
  --radius: 1rem;
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

- [ ] **Step 6: 更新全局样式入口**

```css
/* apps/web/src/styles.css */
@import './styles/tokens.css';

@theme inline {
  --color-background: rgb(var(--background));
  --color-foreground: rgb(var(--foreground));
  --color-card: rgb(var(--card));
  --color-card-foreground: rgb(var(--card-foreground));
  --color-popover: rgb(var(--popover));
  --color-popover-foreground: rgb(var(--popover-foreground));
  --color-primary: rgb(var(--primary));
  --color-primary-foreground: rgb(var(--primary-foreground));
  --color-secondary: rgb(var(--secondary));
  --color-secondary-foreground: rgb(var(--secondary-foreground));
  --color-muted: rgb(var(--muted));
  --color-muted-foreground: rgb(var(--muted-foreground));
  --color-accent: rgb(var(--accent));
  --color-accent-foreground: rgb(var(--accent-foreground));
  --color-destructive: rgb(var(--destructive));
  --color-destructive-foreground: rgb(var(--destructive-foreground));
  --color-border: rgb(var(--border));
  --color-input: rgb(var(--input));
  --color-ring: rgb(var(--ring));
  --radius-sm: calc(var(--radius) - 0.25rem);
  --radius-md: calc(var(--radius) - 0.125rem);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 0.25rem);
}

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
```

- [ ] **Step 7: 收紧 Tailwind 配置，去掉旧颜色真相源**

```js
// apps/web/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      keyframes: {
        'accordion-down': {
          from: { height: 0 },
          to: { height: 'var(--radix-accordion-content-height)' }
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: 0 }
        }
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out'
      }
    }
  },
  plugins: []
};
```

- [ ] **Step 8: 运行测试确认通过**

Run: `pnpm --filter @ai-chat/web test -- theme-tokens.test.tsx`
Expected: PASS

- [ ] **Step 9: 提交**

```bash
git add apps/web/components.json apps/web/package.json apps/web/src/lib/utils.ts apps/web/src/styles/tokens.css apps/web/src/styles.css apps/web/tailwind.config.js apps/web/src/__tests__/theme-tokens.test.tsx
git commit -m "feat(web): initialize shadcn theme foundation"
```

---

## Task 2: 迁移基础 UI 组件到 shadcn/ui

**Files:**
- Create/Replace: `apps/web/src/components/ui/button.tsx`
- Create/Replace: `apps/web/src/components/ui/input.tsx`
- Create/Replace: `apps/web/src/components/ui/textarea.tsx`
- Create: `apps/web/src/components/ui/label.tsx`
- Create: `apps/web/src/components/ui/select.tsx`
- Create: `apps/web/src/components/ui/card.tsx`
- Create: `apps/web/src/components/ui/badge.tsx`
- Create: `apps/web/src/components/ui/separator.tsx`
- Create: `apps/web/src/components/ui/skeleton.tsx`
- Create: `apps/web/src/components/ui/alert.tsx`
- Create: `apps/web/src/components/ui/dialog.tsx`
- Create: `apps/web/src/components/ui/dropdown-menu.tsx`
- Create: `apps/web/src/components/ui/sheet.tsx`
- Create: `apps/web/src/components/ui/scroll-area.tsx`
- Create: `apps/web/src/components/ui/tabs.tsx`
- Modify: `apps/web/src/components/ui/index.ts`
- Test: `apps/web/src/__tests__/ui-button.test.tsx`

- [ ] **Step 1: 把旧 Button class 断言改成行为断言**

```tsx
// apps/web/src/__tests__/ui-button.test.tsx
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Button } from '../components/ui';

describe('Button', () => {
  it('renders button text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('supports secondary variant', () => {
    render(<Button variant="secondary">Secondary</Button>);
    expect(screen.getByRole('button', { name: 'Secondary' })).toHaveAttribute('data-slot', 'button');
  });

  it('supports destructive variant', () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认当前失败**

Run: `pnpm --filter @ai-chat/web test -- ui-button.test.tsx`
Expected: FAIL，因为旧 `Button` 还没有 `destructive` variant，也没有 `data-slot`。

- [ ] **Step 3: 写入核心 primitives**

```tsx
// apps/web/src/components/ui/button.tsx
import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
  {
    variants: {
      variant: {
        default: 'bg-primary text-primary-foreground hover:opacity-95',
        secondary: 'border border-border bg-secondary text-secondary-foreground hover:bg-muted',
        destructive: 'bg-destructive text-destructive-foreground hover:opacity-95',
        ghost: 'text-foreground hover:bg-muted'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 rounded-md px-3',
        lg: 'h-11 rounded-xl px-6',
        icon: 'h-10 w-10'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, className }))} {...props} />;
}
```

```tsx
// apps/web/src/components/ui/card.tsx
import * as React from 'react';
import { cn } from '../../lib/utils';

export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded-2xl border border-border bg-card text-card-foreground shadow-sm', className)} {...props} />;
}
```

```tsx
// apps/web/src/components/ui/input.tsx
import * as React from 'react';
import { cn } from '../../lib/utils';

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      {...props}
    />
  );
}
```

```tsx
// apps/web/src/components/ui/textarea.tsx
import * as React from 'react';
import { cn } from '../../lib/utils';

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'flex min-h-[96px] w-full rounded-lg border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring',
        className
      )}
      {...props}
    />
  );
}
```

- [ ] **Step 4: 补齐表单与交互组件**

```tsx
// apps/web/src/components/ui/label.tsx
import * as LabelPrimitive from '@radix-ui/react-label';
import { cn } from '../../lib/utils';

export function Label({ className, ...props }: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return <LabelPrimitive.Root className={cn('text-sm font-medium text-foreground', className)} {...props} />;
}
```

```tsx
// apps/web/src/components/ui/badge.tsx
import { cva, type VariantProps } from 'class-variance-authority';
import type * as React from 'react';
import { cn } from '../../lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium', {
  variants: {
    variant: {
      neutral: 'border-border bg-secondary text-secondary-foreground',
      success: 'border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
      warning: 'border-transparent bg-amber-500/15 text-amber-700 dark:text-amber-400',
      error: 'border-transparent bg-destructive/15 text-destructive'
    }
  },
  defaultVariants: { variant: 'neutral' }
});

export function Badge({ className, variant, ...props }: React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
```

```ts
// apps/web/src/components/ui/index.ts
export * from './button';
export * from './input';
export * from './textarea';
export * from './label';
export * from './select';
export * from './card';
export * from './badge';
export * from './separator';
export * from './skeleton';
export * from './alert';
export * from './dialog';
export * from './dropdown-menu';
export * from './sheet';
export * from './scroll-area';
export * from './tabs';
```

- [ ] **Step 5: 运行按钮测试确认通过**

Run: `pnpm --filter @ai-chat/web test -- ui-button.test.tsx`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/components/ui apps/web/src/__tests__/ui-button.test.tsx
git commit -m "feat(web): replace base ui with shadcn primitives"
```

---

## Task 3: 重做共享布局与全局状态展示

**Files:**
- Modify: `apps/web/src/components/layout/AppShell.tsx`
- Modify: `apps/web/src/components/layout/ThemeToggle.tsx`
- Create: `apps/web/src/components/layout/PageHeader.tsx`
- Create: `apps/web/src/components/layout/AppSidebarNav.tsx`
- Create: `apps/web/src/components/common/EmptyState.tsx`
- Create: `apps/web/src/components/common/StateAlert.tsx`
- Create: `apps/web/src/components/common/SectionCard.tsx`
- Test: `apps/web/src/__tests__/app-shell.test.tsx`

- [ ] **Step 1: 写失败测试覆盖新导航骨架**

```tsx
// apps/web/src/__tests__/app-shell.test.tsx
import '@testing-library/jest-dom/vitest';
import { describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import { AppShell } from '../components/layout/AppShell';
import { useAuthStore } from '../stores/auth-store';

describe('AppShell', () => {
  it('renders primary nav entries and theme toggle', () => {
    useAuthStore.getState().setAuth({
      accessToken: 'token',
      refreshToken: 'refresh',
      user: {
        id: 'user-1',
        email: 'user@example.com',
        role: 'USER',
        status: 'ACTIVE',
        createdAt: new Date().toISOString()
      }
    });

    render(
      <MemoryRouter>
        <AppShell>
          <div>content</div>
        </AppShell>
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Chat' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Schedules' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Runs' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /theme/i })).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @ai-chat/web test -- app-shell.test.tsx`
Expected: FAIL，如果新拆出的布局组件还不存在。

- [ ] **Step 3: 新建布局部件**

```tsx
// apps/web/src/components/layout/PageHeader.tsx
import type { ReactNode } from 'react';

export function PageHeader(props: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-sm md:flex-row md:items-start md:justify-between">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">{props.title}</h1>
        {props.description ? <p className="text-sm text-muted-foreground">{props.description}</p> : null}
      </div>
      {props.actions ? <div className="flex flex-wrap items-center gap-2">{props.actions}</div> : null}
    </div>
  );
}
```

```tsx
// apps/web/src/components/common/EmptyState.tsx
import type { ReactNode } from 'react';

export function EmptyState(props: { title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex min-h-[240px] flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card px-6 py-10 text-center">
      <h2 className="text-lg font-semibold text-foreground">{props.title}</h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{props.description}</p>
      {props.action ? <div className="mt-4">{props.action}</div> : null}
    </div>
  );
}
```

- [ ] **Step 4: 重写 AppShell**

```tsx
// apps/web/src/components/layout/AppShell.tsx
import { type PropsWithChildren, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { PanelLeft } from 'lucide-react';
import { Button, Sheet, SheetContent, SheetTrigger } from '../ui';
import { useAuthStore } from '../../stores/auth-store';
import { ThemeToggle } from './ThemeToggle';

const navItems = [
  { to: '/chat', label: 'Chat' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/schedules', label: 'Schedules' },
  { to: '/runs', label: 'Runs' },
  { to: '/settings', label: 'Settings' }
];

function navLinkClassName({ isActive }: { isActive: boolean }) {
  return isActive
    ? 'rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground'
    : 'rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground';
}

function NavList() {
  return (
    <nav className="flex flex-col gap-1 md:flex-row md:items-center">
      {navItems.map((item) => (
        <NavLink key={item.to} className={navLinkClassName} to={item.to}>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}

export function AppShell({ children, sidebar }: PropsWithChildren<{ sidebar?: ReactNode }>) {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-20 border-b border-border/80 bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 md:px-6">
          <div className="flex items-center gap-3 md:gap-8">
            <Sheet>
              <SheetTrigger asChild>
                <Button className="md:hidden" variant="ghost" size="icon" aria-label="Open navigation">
                  <PanelLeft className="h-5 w-5" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <div className="space-y-6">
                  <div>
                    <div className="text-lg font-semibold tracking-tight">AI Chat</div>
                    <p className="text-sm text-muted-foreground">Workspace</p>
                  </div>
                  <NavList />
                </div>
              </SheetContent>
            </Sheet>
            <div>
              <div className="text-lg font-semibold tracking-tight">AI Chat</div>
              <p className="text-xs text-muted-foreground">Workspace</p>
            </div>
            <div className="hidden md:block">
              <NavList />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-foreground sm:inline">{user?.email}</span>
            <ThemeToggle />
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl gap-6 px-4 py-6 md:px-6">
        {sidebar ? <aside className="hidden w-80 shrink-0 xl:block">{sidebar}</aside> : null}
        <main className="min-w-0 flex-1 space-y-6">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: 运行布局测试确认通过**

Run: `pnpm --filter @ai-chat/web test -- app-shell.test.tsx`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/components/layout apps/web/src/components/common apps/web/src/__tests__/app-shell.test.tsx
git commit -m "feat(web): redesign shared app shell"
```

---

## Task 4: 重做 Login / Dashboard / Settings / Admin 页面

**Files:**
- Modify: `apps/web/src/pages/login/LoginPage.tsx`
- Modify: `apps/web/src/pages/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/pages/settings/SettingsPage.tsx`
- Modify: `apps/web/src/pages/admin/AdminPage.tsx`
- Reuse: `apps/web/src/components/layout/PageHeader.tsx`
- Reuse: `apps/web/src/components/common/SectionCard.tsx`

- [ ] **Step 1: 先写登录页基础交互测试**

```tsx
// 在 apps/web/src/__tests__/login-page.test.tsx 新增
it('shows submit button and error area', async () => {
  await router.navigate('/login');
  render(
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  );

  expect(await screen.findByRole('button', { name: '登录' })).toBeInTheDocument();
  expect(screen.getByLabelText('邮箱')).toBeInTheDocument();
  expect(screen.getByLabelText('密码')).toBeInTheDocument();
});
```

- [ ] **Step 2: 运行测试确认当前失败或需更新查询方式**

Run: `pnpm --filter @ai-chat/web test -- login-page.test.tsx`
Expected: FAIL，如果当前文案还是英文 label。

- [ ] **Step 3: 重写 LoginPage 为品牌登录入口**

```tsx
// apps/web/src/pages/login/LoginPage.tsx（结构示意）
return (
  <div className="grid min-h-screen bg-background lg:grid-cols-[1.2fr_0.8fr]">
    <section className="hidden lg:flex lg:flex-col lg:justify-between lg:border-r lg:border-border lg:bg-card lg:p-12">
      <div>
        <div className="text-sm font-medium text-primary">AI Chat Workspace</div>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight text-foreground">把聊天、调度和执行追踪放到同一个工作台。</h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground">这是一次纯展示层重构后的新入口，业务流与认证契约保持不变。</p>
      </div>
    </section>
    <section className="flex items-center justify-center px-4 py-10 sm:px-6">
      <Card className="w-full max-w-md p-8">
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight">登录</h2>
          <p className="text-sm text-muted-foreground">使用已有账号继续进入工作台。</p>
        </div>
        <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="email">邮箱</Label>
            <Input id="email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="password">密码</Label>
            <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          </div>
          {error ? <StateAlert title="登录失败" description={error} variant="destructive" /> : null}
          <Button className="w-full" disabled={loading} type="submit">{loading ? '登录中...' : '登录'}</Button>
        </form>
      </Card>
    </section>
  </div>
);
```

- [ ] **Step 4: 重写 Dashboard / Settings / Admin 页面骨架**

```tsx
// apps/web/src/pages/dashboard/DashboardPage.tsx
return (
  <AppShell>
    <PageHeader title="Dashboard" description="系统概览与近期活动摘要。" />
    <div className="grid gap-4 md:grid-cols-3">
      <Card className="p-6"><p className="text-sm text-muted-foreground">Chat activity</p></Card>
      <Card className="p-6"><p className="text-sm text-muted-foreground">Schedule health</p></Card>
      <Card className="p-6"><p className="text-sm text-muted-foreground">Run status</p></Card>
    </div>
    <Card className="p-6"><p className="text-sm text-muted-foreground">Recent activity coming soon</p></Card>
  </AppShell>
);
```

```tsx
// apps/web/src/pages/settings/SettingsPage.tsx
return (
  <AppShell>
    <PageHeader title="Settings" description="仅放用户会话与界面相关设置，不承载 schedule 或 admin 杂项。" />
    <Card className="p-6 space-y-4">
      <div>
        <h2 className="text-base font-semibold">界面</h2>
        <p className="text-sm text-muted-foreground">保留当前主题切换入口，统一为新的表单布局。</p>
      </div>
      <div className="flex items-center justify-between rounded-xl border border-border p-4">
        <div>
          <div className="font-medium">主题模式</div>
          <p className="text-sm text-muted-foreground">在 light / dark 之间切换。</p>
        </div>
        <ThemeToggle />
      </div>
    </Card>
  </AppShell>
);
```

```tsx
// apps/web/src/pages/admin/AdminPage.tsx
return (
  <AppShell>
    <PageHeader title="Admin" description="系统管理与受限操作。" />
    <Card className="border-border p-6">
      <p className="text-sm text-muted-foreground">Admin controls coming soon</p>
    </Card>
  </AppShell>
);
```

- [ ] **Step 5: 运行相关测试**

Run: `pnpm --filter @ai-chat/web test -- login-page.test.tsx app-shell.test.tsx`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/pages/login/LoginPage.tsx apps/web/src/pages/dashboard/DashboardPage.tsx apps/web/src/pages/settings/SettingsPage.tsx apps/web/src/pages/admin/AdminPage.tsx apps/web/src/__tests__/login-page.test.tsx
git commit -m "feat(web): redesign foundational pages"
```

---

## Task 5: 重做 Schedules 页面并拆分展示职责

**Files:**
- Modify: `apps/web/src/pages/schedules/SchedulesPage.tsx`
- Modify: `apps/web/src/components/schedules/ScheduleForm.tsx`
- Create: `apps/web/src/components/schedules/ScheduleList.tsx`
- Create: `apps/web/src/components/schedules/ScheduleHealthSummary.tsx`
- Test: `apps/web/src/__tests__/schedule-form.test.tsx`

- [ ] **Step 1: 写 ScheduleForm 行为测试**

```tsx
// apps/web/src/__tests__/schedule-form.test.tsx
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ScheduleForm } from '../components/schedules/ScheduleForm';

describe('ScheduleForm', () => {
  it('submits cron payload', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<ScheduleForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText('Title'), 'Morning sync');
    await userEvent.type(screen.getByLabelText('Task Prompt'), 'Run summary');
    await userEvent.click(screen.getByRole('combobox'));
    await userEvent.click(screen.getByText('CRON'));
    await userEvent.type(screen.getByLabelText('Cron Expression'), '0 9 * * *');
    await userEvent.click(screen.getByRole('button', { name: 'Create Schedule' }));

    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: 'CRON', cronExpr: '0 9 * * *' }));
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @ai-chat/web test -- schedule-form.test.tsx`
Expected: FAIL，因为当前仍使用原生 `<select>`，label/query 结构不稳定。

- [ ] **Step 3: 把表单改成 shadcn 表单布局**

```tsx
// apps/web/src/components/schedules/ScheduleForm.tsx（结构示意）
return (
  <Card className="p-6">
    <div className="mb-6 space-y-1">
      <h2 className="text-lg font-semibold">{props.initial ? 'Edit Schedule' : 'Create Schedule'}</h2>
      <p className="text-sm text-muted-foreground">定义一次性任务或周期性任务，不改变现有 API payload。</p>
    </div>
    <form className="space-y-5" onSubmit={handleSubmit}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="title">Title</Label>
          <Input id="title" name="title" required defaultValue={props.initial?.title ?? ''} />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="taskPrompt">Task Prompt</Label>
          <Textarea id="taskPrompt" name="taskPrompt" rows={5} required defaultValue={props.initial?.taskPrompt ?? ''} />
        </div>
        <div className="space-y-2">
          <Label>Type</Label>
          <Select name="type" defaultValue={props.initial?.type ?? 'ONE_TIME'}>
            <SelectTrigger><SelectValue placeholder="Select schedule type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ONE_TIME">ONE_TIME</SelectItem>
              <SelectItem value="CRON">CRON</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="timezone">Timezone</Label>
          <Input id="timezone" name="timezone" defaultValue={props.initial?.timezone ?? 'UTC'} />
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="submit">{props.initial ? 'Save' : 'Create Schedule'}</Button>
        {props.onCancel ? <Button type="button" variant="secondary" onClick={props.onCancel}>Cancel</Button> : null}
      </div>
    </form>
  </Card>
);
```

- [ ] **Step 4: 拆出列表和健康摘要组件**

```tsx
// apps/web/src/components/schedules/ScheduleHealthSummary.tsx
import type { ScheduleSummary } from '@ai-chat/shared';

export function ScheduleHealthSummary({ schedule }: { schedule: ScheduleSummary }) {
  return (
    <dl className="grid gap-2 text-sm text-muted-foreground md:grid-cols-2">
      <div><dt className="font-medium text-foreground">Next Run</dt><dd>{schedule.nextRunAt ?? '—'}</dd></div>
      <div><dt className="font-medium text-foreground">Latest Status</dt><dd>{schedule.latestRunStatus ?? '—'}</dd></div>
      <div><dt className="font-medium text-foreground">Latest Stage</dt><dd>{schedule.latestRunStage ?? '—'}</dd></div>
      <div><dt className="font-medium text-foreground">Latest Result</dt><dd>{schedule.latestResultSummary ?? '—'}</dd></div>
    </dl>
  );
}
```

```tsx
// apps/web/src/components/schedules/ScheduleList.tsx
import type { ScheduleSummary } from '@ai-chat/shared';
import { Badge, Button, Card } from '../ui';
import { ScheduleHealthSummary } from './ScheduleHealthSummary';

export function ScheduleList(props: {
  schedules: ScheduleSummary[];
  onToggle: (schedule: ScheduleSummary) => Promise<void>;
  onEdit: (schedule: ScheduleSummary) => void;
  onDelete: (schedule: ScheduleSummary) => Promise<void>;
}) {
  if (props.schedules.length === 0) {
    return <Card className="p-6 text-sm text-muted-foreground">No schedules yet.</Card>;
  }

  return (
    <ul className="space-y-4">
      {props.schedules.map((schedule) => (
        <li key={schedule.id}>
          <Card className="space-y-4 p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-base font-semibold">{schedule.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{schedule.taskPrompt}</p>
              </div>
              <Badge variant={schedule.enabled ? 'success' : 'warning'}>{schedule.enabled ? 'Enabled' : 'Disabled'}</Badge>
            </div>
            <ScheduleHealthSummary schedule={schedule} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => props.onEdit(schedule)}>Edit</Button>
              <Button variant="secondary" onClick={() => props.onToggle(schedule)}>{schedule.enabled ? 'Disable' : 'Enable'}</Button>
              <Button variant="destructive" onClick={() => props.onDelete(schedule)}>Delete</Button>
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 5: 重写 SchedulesPage 组合方式**

```tsx
// apps/web/src/pages/schedules/SchedulesPage.tsx（结构示意）
return (
  <AppShell>
    <PageHeader title="Schedules" description="管理定时任务、编辑执行提示词并查看最近一次运行健康度。" />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
      <div className="space-y-6">
        {editingSchedule ? <ScheduleForm initial={editingSchedule} onSubmit={handleUpdate} onCancel={() => setEditingSchedule(null)} /> : null}
        <ScheduleList schedules={schedules} onToggle={handleToggle} onEdit={setEditingSchedule} onDelete={handleDelete} />
      </div>
      <div>
        <ScheduleForm onSubmit={handleCreate} />
      </div>
    </div>
  </AppShell>
);
```

- [ ] **Step 6: 运行测试确认通过**

Run: `pnpm --filter @ai-chat/web test -- schedule-form.test.tsx`
Expected: PASS

- [ ] **Step 7: 提交**

```bash
git add apps/web/src/pages/schedules/SchedulesPage.tsx apps/web/src/components/schedules/ScheduleForm.tsx apps/web/src/components/schedules/ScheduleList.tsx apps/web/src/components/schedules/ScheduleHealthSummary.tsx apps/web/src/__tests__/schedule-form.test.tsx
git commit -m "feat(web): redesign schedules workspace"
```

---

## Task 6: 重做 Runs 页面与诊断面板

**Files:**
- Modify: `apps/web/src/pages/runs/RunsPage.tsx`
- Modify: `apps/web/src/components/runs/RunList.tsx`
- Create: `apps/web/src/components/runs/RunDiagnosticsCard.tsx`
- Test: `apps/web/src/__tests__/runs-page.test.tsx`

- [ ] **Step 1: 写 RunsPage 失败测试**

```tsx
// apps/web/src/__tests__/runs-page.test.tsx
import '@testing-library/jest-dom/vitest';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { RunsPage } from '../pages/runs/RunsPage';
import * as scheduleService from '../services/schedule';
import { useAuthStore } from '../stores/auth-store';

describe('RunsPage', () => {
  it('loads list and disables retry while run is running', async () => {
    useAuthStore.getState().setAuth({
      accessToken: 'token',
      refreshToken: 'refresh',
      user: { id: 'u1', email: 'user@example.com', role: 'USER', status: 'ACTIVE', createdAt: new Date().toISOString() }
    });

    vi.spyOn(scheduleService, 'listRuns').mockResolvedValue({
      runs: [{ id: 'run-1', scheduleId: 'schedule-1', status: 'RUNNING', stage: 'EXECUTING', triggerSource: 'USER', failureCategory: null, failureCode: null, failureMessage: null, startedAt: new Date().toISOString(), finishedAt: null, taskPromptSnapshot: 'Do work', toolExecutionCount: 0, resultSummary: null }]
    } as never);
    vi.spyOn(scheduleService, 'getRun').mockResolvedValue({
      run: { id: 'run-1', scheduleId: 'schedule-1', status: 'RUNNING', stage: 'EXECUTING', triggerSource: 'USER', failureCategory: null, failureCode: null, failureMessage: null, startedAt: new Date().toISOString(), finishedAt: null, taskPromptSnapshot: 'Do work', toolExecutionCount: 0, resultSummary: null }
    } as never);

    render(
      <MemoryRouter>
        <RunsPage />
      </MemoryRouter>
    );

    expect(await screen.findByText('run-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry Run' })).toBeDisabled();
  });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm --filter @ai-chat/web test -- runs-page.test.tsx`
Expected: FAIL，因为测试文件和新结构还不存在。

- [ ] **Step 3: 把 RunDiagnosticsCard 从页面内联实现拆出**

```tsx
// apps/web/src/components/runs/RunDiagnosticsCard.tsx
import type { RunToolExecutionSummary, ScheduleRunSummary } from '@ai-chat/shared';
import { Card } from '../ui';

export function RunDiagnosticsCard(props: {
  run: ScheduleRunSummary & { toolExecutions?: RunToolExecutionSummary[] };
}) {
  const { run } = props;

  return (
    <Card className="p-5">
      <dl className="grid gap-3 text-sm md:grid-cols-2">
        <div><dt className="font-medium text-foreground">Run ID</dt><dd className="text-muted-foreground">{run.id}</dd></div>
        <div><dt className="font-medium text-foreground">Status</dt><dd className="text-muted-foreground">{run.status}</dd></div>
        <div><dt className="font-medium text-foreground">Stage</dt><dd className="text-muted-foreground">{run.stage}</dd></div>
        <div><dt className="font-medium text-foreground">Failure Category</dt><dd className="text-muted-foreground">{run.failureCategory ?? '—'}</dd></div>
        <div className="md:col-span-2"><dt className="font-medium text-foreground">Prompt</dt><dd className="text-muted-foreground">{run.taskPromptSnapshot}</dd></div>
        <div className="md:col-span-2"><dt className="font-medium text-foreground">Result</dt><dd className="text-muted-foreground">{run.resultSummary ?? '—'}</dd></div>
      </dl>
    </Card>
  );
}
```

- [ ] **Step 4: 重写列表和筛选区**

```tsx
// apps/web/src/components/runs/RunList.tsx（结构示意）
return props.runs.length === 0 ? (
  <Card className="p-6 text-sm text-muted-foreground">No runs yet.</Card>
) : (
  <ul className="space-y-3">
    {props.runs.map((run) => (
      <li key={run.id}>
        <button
          className={cn(
            'w-full rounded-2xl border p-4 text-left transition-colors',
            props.currentRunId === run.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/60'
          )}
          onClick={() => props.onSelect(run.id)}
          type="button"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="font-medium">{run.id}</span>
            <Badge variant={run.status === 'FAILED' ? 'error' : run.status === 'COMPLETED' ? 'success' : 'warning'}>{run.status}</Badge>
          </div>
          <div className="mt-2 text-sm text-muted-foreground">{run.taskPromptSnapshot}</div>
        </button>
      </li>
    ))}
  </ul>
);
```

```tsx
// apps/web/src/pages/runs/RunsPage.tsx（结构示意）
return (
  <AppShell>
    <PageHeader title="Runs" description="查看任务执行记录、状态、失败信息与重试入口。" />
    <Card className="space-y-4 p-5">
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label>Status</Label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="RUNNING">Running</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="scheduleIdFilter">Schedule ID</Label>
          <Input id="scheduleIdFilter" value={scheduleIdFilter} onChange={(event) => setScheduleIdFilter(event.target.value)} />
        </div>
      </div>
    </Card>
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
      <RunList runs={runs} currentRunId={currentRunId} onSelect={selectRun} />
      {selectedRun ? <RunDiagnosticsCard run={selectedRun} /> : <EmptyState title="Select a run" description="Choose a run from the list to inspect diagnostics." />}
    </div>
  </AppShell>
);
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm --filter @ai-chat/web test -- runs-page.test.tsx`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/pages/runs/RunsPage.tsx apps/web/src/components/runs/RunList.tsx apps/web/src/components/runs/RunDiagnosticsCard.tsx apps/web/src/__tests__/runs-page.test.tsx
git commit -m "feat(web): redesign runs workspace"
```

---

## Task 7: 最后重做 Chat 页面与复杂展示组件

**Files:**
- Modify: `apps/web/src/pages/chat/ChatPage.tsx`
- Modify: `apps/web/src/components/chat/EmptyChatState.tsx`
- Modify: `apps/web/src/components/chat/SessionSidebar.tsx`
- Modify: `apps/web/src/components/chat/MessageList.tsx`
- Modify: `apps/web/src/components/chat/ChatComposer.tsx`
- Modify: `apps/web/src/components/chat/*` 中展示型组件
- Test: `apps/web/src/__tests__/chat-page.test.tsx`

- [ ] **Step 1: 先锁住现有关键行为测试**

```tsx
// apps/web/src/__tests__/chat-page.test.tsx 保留这些断言
expect(useChatStore.getState().runtime.append).toEqual(expect.any(Function));
expect(await screen.findByText('开始一个新的对话')).toBeInTheDocument();
expect(await screen.findByText('Hi there')).toBeInTheDocument();
expect(await screen.findByText('manage_schedule')).toBeInTheDocument();
expect(screen.getByRole('button', { name: '重试上一条消息' })).toBeInTheDocument();
```

- [ ] **Step 2: 运行聊天页测试建立基线**

Run: `pnpm --filter @ai-chat/web test -- chat-page.test.tsx`
Expected: PASS，作为 UI 重构前行为基线。

- [ ] **Step 3: 重写 ChatPage 页面容器，但不动 store / runtime 调用**

```tsx
// apps/web/src/pages/chat/ChatPage.tsx（结构示意）
return (
  <AppShell
    sidebar={
      <SessionSidebar
        sessions={sessions}
        currentSessionId={currentSessionId}
        onNewChat={startNewChatWithReset}
        onSelect={setCurrentSession}
      />
    }
  >
    <PageHeader title="Chat" description="与 AI 助手对话，查看流式输出与 tool execution。" />
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <div className="space-y-4">
        {streamUiState === 'IDLE' && !hasMessages ? <EmptyChatState /> : null}
        {hasMessages ? <MessageList messages={messages} /> : null}
        {streamUiState === 'FAILED' && streamErrorMessage ? (
          <StateAlert
            title="发送失败"
            description={streamErrorMessage}
            variant="destructive"
            action={<Button type="button" variant="secondary" onClick={handleRetryLastMessage}>重试上一条消息</Button>}
          />
        ) : null}
        <ChatComposer value={draftInput} disabled={isStreaming || !accessToken} onChange={setDraftInput} onSubmit={handleSubmit} />
      </div>
      <Card className="hidden p-4 xl:block">
        <p className="text-sm text-muted-foreground">运行态、会话切换与工具结果会在主消息流里统一展示。</p>
      </Card>
    </div>
  </AppShell>
);
```

- [ ] **Step 4: 重写聊天展示组件外观**

```tsx
// apps/web/src/components/chat/SessionSidebar.tsx（结构示意）
return (
  <Card className="space-y-4 p-4">
    <div className="flex items-center justify-between gap-2">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Sessions</h2>
        <p className="text-xs text-muted-foreground">切换历史会话或开始新对话。</p>
      </div>
      <Button size="sm" onClick={props.onNewChat}>New Chat</Button>
    </div>
    <ScrollArea className="h-[calc(100vh-16rem)] pr-3">
      <div className="space-y-2">
        {props.sessions.map((session) => (
          <Button
            key={session.id}
            className="w-full justify-start"
            variant={props.currentSessionId === session.id ? 'default' : 'ghost'}
            onClick={() => props.onSelect(session.id)}
          >
            {session.title}
          </Button>
        ))}
      </div>
    </ScrollArea>
  </Card>
);
```

```tsx
// apps/web/src/components/chat/ChatComposer.tsx（结构示意）
return (
  <Card className="sticky bottom-0 p-4 shadow-lg">
    <div className="flex flex-col gap-3">
      <Textarea value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} placeholder="输入你的任务或问题..." />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">保留现有发送与 retry 主链路，只重做输入体验。</p>
        <Button onClick={onSubmit} disabled={disabled}>Send</Button>
      </div>
    </div>
  </Card>
);
```

- [ ] **Step 5: 重新运行聊天页测试**

Run: `pnpm --filter @ai-chat/web test -- chat-page.test.tsx`
Expected: PASS

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/pages/chat/ChatPage.tsx apps/web/src/components/chat apps/web/src/__tests__/chat-page.test.tsx
git commit -m "feat(web): redesign chat workspace ui"
```

---

## Task 8: 清理旧 UI、统一测试并做工程验收

**Files:**
- Delete: `apps/web/src/components/ui/Button.tsx`
- Delete: `apps/web/src/components/ui/Input.tsx`
- Delete: `apps/web/src/components/ui/Textarea.tsx`
- Delete: `apps/web/src/components/ui/Card.tsx`
- Delete: `apps/web/src/components/ui/Badge.tsx`
- Modify: 受影响 import 的所有页面与组件

- [ ] **Step 1: 删除不再使用的旧 UI 文件并统一 import**

```ts
// 所有 import 统一收口到
import { Badge, Button, Card, Input, Textarea } from '../ui';
```

```bash
rm apps/web/src/components/ui/Button.tsx apps/web/src/components/ui/Input.tsx apps/web/src/components/ui/Textarea.tsx apps/web/src/components/ui/Card.tsx apps/web/src/components/ui/Badge.tsx
```

- [ ] **Step 2: 运行 lint**

Run: `pnpm --filter @ai-chat/web lint`
Expected: PASS

- [ ] **Step 3: 运行测试**

Run: `pnpm --filter @ai-chat/web test`
Expected: PASS

- [ ] **Step 4: 运行构建**

Run: `pnpm --filter @ai-chat/web build`
Expected: PASS

- [ ] **Step 5: 做最终人工验收**

Run: `pnpm --filter @ai-chat/web dev`
Expected: 本地启动成功；随后重点检查 `/login`、`/chat`、`/dashboard`、`/schedules`、`/runs`、`/settings`、`/admin` 的 light / dark、空态 / 错误态 / loading / streaming 状态。

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/components/ui apps/web/src/pages apps/web/src/components apps/web/src/__tests__ apps/web/package.json apps/web/components.json apps/web/src/lib/utils.ts apps/web/src/styles/tokens.css apps/web/src/styles.css apps/web/tailwind.config.js
git commit -m "feat(web): complete shadcn full-page redesign"
```

---

## Self-Review

### Spec coverage
- `shadcn/ui` 全面接入：Task 1、Task 2 覆盖。
- 保留品牌配色与 light/dark 语义：Task 1 覆盖。
- 重做所有页面：Task 4、Task 5、Task 6、Task 7 覆盖 `login/dashboard/settings/admin/schedules/runs/chat`。
- 重做共享布局：Task 3 覆盖。
- 不改路由 / API / store 主模型：Task 7 明确只改 ChatPage 展示容器，不动 `useChatStore` 主链路；其他任务仅修改 UI 与展示组件。
- 清理旧 UI，避免双轨共存：Task 8 覆盖。
- 工程验收：Task 8 覆盖 `lint` / `test` / `build`。

### Placeholder scan
- 已去掉 “TODO / TBD / later” 类占位。
- 每个任务都给了具体文件、命令、预期结果。
- 代码步骤提供了最小可执行结构示例。

### Type consistency
- 新 Button variant 使用 `default | secondary | destructive | ghost`，计划中的页面按钮已统一使用这些名字。
- `ScheduleList` / `RunDiagnosticsCard` / `PageHeader` 的命名在后续任务保持一致。
- `ChatPage` 继续使用现有 `bindRuntime` / `clearRuntime` / `syncRuntime` / `retryLastMessage`，未引入新 store 接口。

---

Plan complete and saved to `docs/superpowers/plans/2026-04-01-web-shadcn-full-redesign.md`.

Two execution options:

1. **Subagent-Driven (recommended)** - 我按任务派发独立 subagent，逐段实现并在段间 review
2. **Inline Execution** - 我在当前会话里按计划直接实现，做到一个阶段汇报一次

Which approach?
