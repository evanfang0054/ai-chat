import { PropsWithChildren, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '../../stores/auth-store';

export function AppShell({ children, sidebar }: PropsWithChildren<{ sidebar?: ReactNode }>) {
  const user = useAuthStore((state) => state.user);

  return (
    <div>
      <header>
        <strong>ai-chat</strong>
        <nav>
          <NavLink to="/chat">Chat</NavLink>
          <NavLink to="/schedules">Schedules</NavLink>
          <NavLink to="/runs">Runs</NavLink>
        </nav>
        <span>{user?.email}</span>
      </header>
      <div>
        {sidebar}
        <main>{children}</main>
      </div>
    </div>
  );
}
