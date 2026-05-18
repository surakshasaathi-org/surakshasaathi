import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdminSession } from '@/lib/admin/auth';

export default async function DpdpPage() {
  const session = await requireAdminSession(['super_admin', 'admin']);
  return (
    <AdminShell role={session.role} email={session.email}>
      <h1 className="font-display text-2xl font-semibold tracking-tight">DPDP requests</h1>
      <p className="mt-2 max-w-prose text-sm text-ink-muted">
        Access, erasure, correction, and portability requests. Every request has a 72-hour SLA. The queue here
        shows age, status, and assignee; bulk export writes to Supabase Storage.
      </p>
      <div className="mt-8 rounded-lg border border-border bg-card p-10 text-center text-ink-muted">
        No open requests. Intake endpoint lives in Week-3 — until then, handle via email and log manually.
      </div>
    </AdminShell>
  );
}
