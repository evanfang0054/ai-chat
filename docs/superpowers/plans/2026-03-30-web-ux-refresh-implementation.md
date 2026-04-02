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

**Status:** Completed in current worktree and verified with `pnpm --filter @ai-chat/web test -- ui-button.test.tsx` plus `pnpm --filter @ai-chat/web build`.

**Implementation notes:**
- Final implementation uses lowercase shadcn-style file names and barrel exports from `apps/web/src/components/ui/index.ts`.
- Legacy uppercase duplicates (`Button.tsx`, `Input.tsx`, `Textarea.tsx`, `Card.tsx`, `Badge.tsx`) were removed to resolve TypeScript casing conflicts on case-insensitive filesystems.
- `Button`, `Input`, `Textarea`, `Card`, and `Badge` were migrated to shared token-driven primitives under lowercase files.
- The UI layer was expanded with additional Radix-backed primitives already consumed through the same barrel: `label`, `select`, `separator`, `skeleton`, `alert`, `dialog`, `dropdown-menu`, `sheet`, `scroll-area`, and `tabs`.
- `apps/web/src/__tests__/ui-button.test.tsx` now verifies the semantic contract instead of raw utility class strings, including safe default `type="button"`, default `data-variant` / `data-size`, and compatibility for `secondary` / `danger` variants.

**Files:**
- Modify: `apps/web/src/components/ui/button.tsx`
- Modify: `apps/web/src/components/ui/input.tsx`
- Modify: `apps/web/src/components/ui/textarea.tsx`
- Modify: `apps/web/src/components/ui/card.tsx`
- Modify: `apps/web/src/components/ui/badge.tsx`
- Modify: `apps/web/src/components/ui/index.ts`
- Modify: `apps/web/src/__tests__/ui-button.test.tsx`
- Create: `apps/web/src/components/ui/label.tsx`
- Create: `apps/web/src/components/ui/select.tsx`
- Create: `apps/web/src/components/ui/separator.tsx`
- Create: `apps/web/src/components/ui/skeleton.tsx`
- Create: `apps/web/src/components/ui/alert.tsx`
- Create: `apps/web/src/components/ui/dialog.tsx`
- Create: `apps/web/src/components/ui/dropdown-menu.tsx`
- Create: `apps/web/src/components/ui/sheet.tsx`
- Create: `apps/web/src/components/ui/scroll-area.tsx`
- Create: `apps/web/src/components/ui/tabs.tsx`

- [x] **Step 1: Write failing test for Button with tokens**
- [x] **Step 2: Run test to verify it fails**
- [x] **Step 3: Update Button component**
- [x] **Step 4: Run test to verify it passes**
- [x] **Step 5: Update Input component**
- [x] **Step 6: Update Textarea component**
- [x] **Step 7: Update Card component**
- [x] **Step 8: Update Badge component**
- [ ] **Step 9: Commit**

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

- [x] **Step 4: Update AppShell component**

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

- [x] **Step 5: Run test to verify it passes**

Run: `pnpm --filter @ai-chat/web test -- app-shell.test.tsx`
Expected: PASS

- [x] **Step 6: Wrap App with ThemeProvider**

```typescript
// apps/web/src/App.tsx
import { RouterProvider } from 'react-router-dom';
import { router } from './router';
import { ThemeProvider } from './contexts/theme-context';

export default function App() {
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

**Status:** Implemented in current worktree and verified with `pnpm --filter @ai-chat/web build`.

**Files:**
- Modify: `apps/web/src/pages/login/LoginPage.tsx`

- [x] **Step 1: Update LoginPage component**

```typescript
// apps/web/src/pages/login/LoginPage.tsx
import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input } from '../../components/ui';
import { useAuthStore } from '../../stores/auth-store';
import { login } from '../../services/auth';

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

**Status:** Implemented in current worktree and verified with `pnpm --filter @ai-chat/web test -- chat-page.test.tsx` plus `pnpm --filter @ai-chat/web build`.

**Implementation notes:**
- `EmptyChatState`, `SessionSidebar`, and `ChatComposer` already match the refreshed card-based chat layout in the current worktree.
- `ChatPage` is already wired to the refreshed shell structure with sidebar, header card, empty state, composer, and streaming/error states.
- The current error state is slightly richer than the original step text: it renders only for `streamUiState === 'FAILED'`, uses `streamErrorMessage`, and includes a retry action for the last submitted message.

**Files:**
- Modify: `apps/web/src/components/chat/EmptyChatState.tsx`
- Modify: `apps/web/src/components/chat/SessionSidebar.tsx`
- Modify: `apps/web/src/components/chat/ChatComposer.tsx`
- Modify: `apps/web/src/pages/chat/ChatPage.tsx`

- [x] **Step 1: Update EmptyChatState**
- [x] **Step 2: Update SessionSidebar**
- [x] **Step 3: Update ChatComposer**
- [x] **Step 4: Update ChatPage header and error**
- [ ] **Step 5: Commit**

---

## Task 6: Message Display

**Status:** Implemented in current worktree; current files already match the planned card-based message layout.

**Implementation notes:**
- `MessageItem` already renders user/assistant messages with left-right alignment and token-based card styling.
- `MessageList` already provides the intended simple vertical spacing wrapper around `MessageItem`.
- No additional code change was required while reconciling this task against the current worktree.

**Files:**
- Modify: `apps/web/src/components/chat/MessageItem.tsx`
- Modify: `apps/web/src/components/chat/MessageList.tsx`

- [x] **Step 1: Update MessageItem**
- [x] **Step 2: Update MessageList**
- [ ] **Step 3: Commit**

---

## Task 7: Tool Execution Display

**Status:** Implemented in current worktree; current components already provide the planned card-based tool execution display.

**Implementation notes:**
- `ToolExecutionItem` already renders tool status with token-based `Card` and `Badge` styling.
- The current shared contract uses `ToolExecutionSummary` with statuses `RUNNING` / `SUCCEEDED` / `FAILED`, so the implementation is aligned to the real shared types rather than the older plan snippet.
- The current component also renders both `output` and `errorMessage`, which is a richer but compatible version of the intended refreshed display.

**Files:**
- Modify: `apps/web/src/components/chat/ToolExecutionItem.tsx`

- [x] **Step 1: Update ToolExecutionItem**
- [ ] **Step 2: Commit**

---

## Task 8: Schedules Page

**Status:** Updated in current worktree and verified with `pnpm --filter @ai-chat/web test -- chat-page.test.tsx` plus `pnpm --filter @ai-chat/web build`.

**Implementation notes:**
- `SchedulesPage` header was already aligned with the refreshed shell/card layout.
- `ScheduleForm` was updated to use token-aligned label, select, and text color styling instead of remaining slate-specific colors.
- `ScheduleList` and schedule health summary were also normalized onto token-based foreground colors to match the refreshed visual system.

**Files:**
- Modify: `apps/web/src/pages/schedules/SchedulesPage.tsx`
- Modify: `apps/web/src/components/schedules/ScheduleForm.tsx`

- [x] **Step 1: Update SchedulesPage header**
- [x] **Step 2: Update ScheduleForm styling**
- [ ] **Step 3: Commit**

---

## Task 9: Runs Page

**Status:** Updated in current worktree and verified with `pnpm --filter @ai-chat/web test -- runs-page.test.tsx` plus `pnpm --filter @ai-chat/web build`.

**Implementation notes:**
- `RunsPage` header already matched the refreshed shell/card layout in the current worktree.
- `RunsPage` filters and diagnostics panel were normalized from remaining slate/rose classes to token-based foreground, border, surface, and error colors.
- `RunList` was also normalized onto token-based text and link styling while preserving the existing status badge mapping and chat-session deep link behavior.

**Files:**
- Modify: `apps/web/src/pages/runs/RunsPage.tsx`
- Modify: `apps/web/src/components/runs/RunList.tsx`

- [x] **Step 1: Update RunsPage header**
- [x] **Step 2: Update RunList status badges**
- [ ] **Step 3: Commit**

---

## Task 10: Dashboard and Admin Pages

**Status:** Implemented in current worktree; both pages already match the planned refreshed shell/card layout.

**Implementation notes:**
- `DashboardPage` already renders the intended page header card and secondary content card with token-based typography.
- `AdminPage` already renders the intended page header card and secondary content card with token-based typography.
- No additional code change was required while reconciling this task against the current worktree.

**Files:**
- Modify: `apps/web/src/pages/dashboard/DashboardPage.tsx`
- Modify: `apps/web/src/pages/admin/AdminPage.tsx`

- [x] **Step 1: Update DashboardPage**
- [x] **Step 2: Update AdminPage**
- [ ] **Step 3: Commit**

---

## Task 11: Final Verification

**Status:** Verification in progress. `lint` / `test` / `build` passed in the current worktree, and browser verification covered login plus the authenticated shell routes on the local dev stack; final commit remains pending.

**Implementation notes:**
- `pnpm --filter @ai-chat/web lint` passed with no lint errors.
- `pnpm --filter @ai-chat/web test` passed with 11 test files and 35 tests green.
- `pnpm --filter @ai-chat/web build` passed; Vite still reports pre-existing chunk-size and mixed static/dynamic import warnings around `auth-store`, but they do not fail the build.
- Real browser verification was executed against the local dev server at `http://localhost:5171` because port `5170` was already occupied.
- Login with the seeded admin account succeeded, and the refreshed shell/navigation rendered correctly across `/chat`, `/schedules`, `/runs`, `/dashboard`, and `/admin`.
- Browser verification was sufficient to confirm the refined login card, authenticated navigation, page headers, schedule form/list, runs filters/empty state, and consistent shell styling, but deeper theme persistence and chat-flow interaction coverage still remain as optional follow-up.

**Files:**
- Test: All modified files

- [x] **Step 1: Run lint**
- [x] **Step 2: Run tests**
- [x] **Step 3: Run build**
- [x] **Step 4: Manual browser verification**
- [ ] **Step 5: Final commit if needed**

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

---

## Task 12: E2E Browser Verification

**Status:** Browser verification executed against the local dev stack; findings recorded, with no blocking regressions found during route-level acceptance checks.

**Implementation notes:**
- The web dev server started successfully on `http://localhost:5171` after Vite detected that `5170` was already in use.
- The API initially failed local startup because `DEEPSEEK_API_KEY` was empty in `.env.local`; after setting a non-empty local placeholder, the API booted and the seeded admin login flow became testable.
- `agent-browser` verified the login page heading/card layout, authenticated sign-in with `admin@example.com`, and successful redirect into `/chat`.
- The authenticated shell rendered correctly across `/schedules`, `/runs`, `/dashboard`, and `/admin`, including nav links, user email, page headers, and the refreshed card-based layout.
- `/schedules` showed the refined create form and populated schedule list; `/runs` showed filters, empty state copy, and details scaffold; `/dashboard` and `/admin` both matched the expected shell/card structure.
- Browser automation was less reliable for heavy chat snapshots and repeated cold opens, so deeper theme-persistence, responsive-width, and end-to-end chat send verification were not exhaustively re-run in this pass.

**Files:**
- All implemented pages and components

- [x] **Step 1: Start dev server**

Run: `pnpm --filter @ai-chat/web dev`
Expected: Dev server starts on port 5170 (or next available)

- [x] **Step 2: Invoke agent-browser skill**

Use agent-browser to verify:

1. **Login Flow**
   - Navigate to http://localhost:5170/login
   - Verify welcome heading and refined card layout
   - Check light theme is default
   - Test theme toggle switches to dark mode
   - Verify form inputs and button styling
   - Test login with valid credentials

2. **Theme Consistency**
   - Toggle between light and dark themes
   - Verify all pages maintain consistent token usage
   - Check borders, backgrounds, text colors adapt correctly
   - Verify no visual breaks or contrast issues

3. **Chat Page**
   - Verify empty state displays with icon and message
   - Check session sidebar with "New Chat" button
   - Send a test message
   - Verify message bubbles display correctly (user vs assistant)
   - Check tool execution cards if applicable
   - Verify composer textarea and send button

4. **Schedules Page**
   - Navigate to /schedules
   - Verify page header and description
   - Check form styling and input fields
   - Verify schedule list displays correctly

5. **Runs Page**
   - Navigate to /runs
   - Verify page header and description
   - Check run list with status badges
   - Verify badge colors match status (success/error/warning)

6. **Dashboard & Admin**
   - Navigate to /dashboard
   - Verify consistent page structure
   - Navigate to /admin (if admin role)
   - Verify consistent styling

7. **Navigation & Shell**
   - Test all nav links work
   - Verify active nav state highlights correctly
   - Check user email displays in header
   - Verify theme toggle persists across page navigation
   - Check responsive layout at different widths

8. **Overall Polish**
   - Verify spacing and typography consistency
   - Check all interactive states (hover, focus, disabled)
   - Verify no console errors
   - Check loading states if applicable
   - Verify error states display correctly

- [x] **Step 3: Document findings**

Note any issues found during browser testing
- Local route-level verification passed for login, shell navigation, schedules, runs, dashboard, and admin.
- No blocking visual regressions were observed on the verified routes.
- Theme persistence, responsive-width checks, and a full chat send flow were not exhaustively validated in this pass because the existing local chat dataset made snapshots noisy and repeated direct navigations occasionally timed out.

- [ ] **Step 4: Fix issues if needed**

Address any visual or functional issues discovered

- [ ] **Step 5: Final commit**

```bash
git add .
git commit -m "fix(web): address e2e browser verification issues"
```

