import { PropsWithChildren, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';

function navClassName({ isActive }: { isActive: boolean }) {
  return [
    'rounded-md px-3 py-2 text-sm font-medium transition-colors',
    isActive ? 'bg-slate-800 text-slate-100' : 'text-slate-300 hover:bg-slate-900 hover:text-slate-100'
  ].join(' ');
}

export function AppShell({ children, sidebar }: PropsWithChildren<{ sidebar?: ReactNode }>) {
  const user = useAuthStore((state) => state.user);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-950/95">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <strong className="text-base font-semibold">ai-chat</strong>
            <nav className="flex items-center gap-2">
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
          <span className="text-sm text-slate-300">{user?.email}</span>
        </div>
      </header>
      <div className="mx-auto flex w-full max-w-6xl gap-4 px-4 py-4">
        {sidebar}
        <main className="min-w-0 flex-1 space-y-4">{children}</main>
      </div>
    </div>
  );
}
