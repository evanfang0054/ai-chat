import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui';

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
