import { Card, CardContent, CardHeader, CardTitle } from '@suraksha/ui';
import { AdminShell } from '@/components/admin-shell';
import { requireAdminSession } from '@/lib/auth';

export default async function AdminHome() {
  const session = await requireAdminSession(['super_admin', 'admin', 'case_manager', 'content_editor', 'cx_agent', 'viewer']);

  return (
    <AdminShell role={session.role} email={session.email}>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Operations overview</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Day-1 scaffold. Real tiles replace these stubs as live data begins flowing.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Open cases" value="—" detail="awaiting triage" />
        <StatCard title="Cases breaching SLA" value="—" detail="IRDAI 14-day / 15-day" />
        <StatCard title="Awaiting review" value="—" detail="human-in-loop queue" />
        <StatCard title="Reviews this week" value="—" detail="by case_manager" />
        <StatCard title="Agent spend (MTD)" value="—" detail="in paise" />
        <StatCard title="Success fees earned" value="—" detail="MTD" />
        <StatCard title="Subscriptions" value="—" detail="active" />
        <StatCard title="DPDP requests" value="—" detail="open" />
      </div>
    </AdminShell>
  );
}

function StatCard({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm text-ink-muted">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="font-display text-3xl font-semibold tracking-tight text-ink">{value}</div>
        <div className="mt-1 text-xs text-ink-subtle">{detail}</div>
      </CardContent>
    </Card>
  );
}
