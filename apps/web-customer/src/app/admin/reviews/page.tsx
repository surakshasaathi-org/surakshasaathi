import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdminSession } from '@/lib/admin/auth';

export default async function ReviewsPage() {
  const session = await requireAdminSession(['super_admin', 'admin', 'case_manager', 'reviewer']);
  return (
    <AdminShell role={session.role} email={session.email}>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Human-in-loop review queue</h1>
      <p className="mt-2 max-w-prose text-sm text-ink-muted">
        Agent outputs flagged as <code>reviewRequired</code> land here before anything is sent to a regulator. A
        reviewer approves, requests edits, or rejects — every action is audited.
      </p>
      <div className="mt-8 rounded-lg border border-border bg-card p-10 text-center text-ink-muted">
        Review queue UI lands with Week-2 Claims-Advocacy backend.
      </div>
    </AdminShell>
  );
}
