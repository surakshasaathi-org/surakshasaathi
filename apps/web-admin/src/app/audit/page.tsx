import { AdminShell } from '@/components/admin-shell';
import { requireAdminSession } from '@/lib/auth';

export default async function AuditPage() {
  const session = await requireAdminSession(['super_admin']);
  return (
    <AdminShell role={session.role} email={session.email}>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Audit log</h1>
      <p className="mt-2 max-w-prose text-sm text-ink-muted">
        Immutable record of every sensitive action — admin reads, service-role queries, payment state changes,
        regulatory filings. Retention: 7 years. Super-admin only.
      </p>
    </AdminShell>
  );
}
