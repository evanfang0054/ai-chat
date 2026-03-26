import { PropsWithChildren } from 'react';
import { useAuthStore } from '../../stores/auth-store';

export function AppShell({ children }: PropsWithChildren) {
  const user = useAuthStore((state) => state.user);

  return (
    <div>
      <header>
        <strong>ai-chat</strong>
        <span>{user?.email}</span>
      </header>
      <main>{children}</main>
    </div>
  );
}
