import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui';

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
