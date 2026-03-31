import { AppShell } from '../../components/layout/AppShell';
import { Card } from '../../components/ui';

export function SettingsPage() {
  return (
    <AppShell>
      <Card className="p-6">
        <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--foreground))]">Settings</h1>
        <p className="mt-1 text-sm text-[rgb(var(--foreground-secondary))]">
          仅放用户会话与界面相关设置，不承载 schedule 或 admin 杂项。
        </p>
      </Card>
    </AppShell>
  );
}
