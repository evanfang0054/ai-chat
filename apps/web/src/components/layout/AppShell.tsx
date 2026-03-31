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
              <NavLink className={navClassName} to="/settings">
                Settings
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
