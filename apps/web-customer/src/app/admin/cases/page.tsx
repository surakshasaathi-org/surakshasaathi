import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdminSession } from '@/lib/admin/auth';
import { serviceDb, schema } from '@suraksha/db';
import { desc } from 'drizzle-orm';

export default async function CaseQueuePage() {
  const session = await requireAdminSession(['super_admin', 'admin', 'case_manager', 'viewer']);
  const db = serviceDb();

  const cases = await db
    .select({
      id: schema.caseRow.id,
      kind: schema.caseRow.kind,
      status: schema.caseRow.status,
      priority: schema.caseRow.priority,
      amountClaimed: schema.caseRow.amountClaimedPaise,
      deadlineAt: schema.caseRow.deadlineAt,
      insurer: schema.caseRow.insurerName,
      createdAt: schema.caseRow.createdAt,
    })
    .from(schema.caseRow)
    .orderBy(desc(schema.caseRow.createdAt))
    .limit(100);

  return (
    <AdminShell role={session.role} email={session.email}>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Case queue</h1>
      <p className="mt-2 text-sm text-ink-muted">All cases across every module. Filter + assign coming in week 2.</p>

      <div className="mt-8 overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-primary-subtle/50 text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">Case</th>
              <th className="px-4 py-3">Kind</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Priority</th>
              <th className="px-4 py-3">Insurer</th>
              <th className="px-4 py-3 text-right">Amount (₹)</th>
              <th className="px-4 py-3">Deadline</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {cases.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-16 text-center text-ink-muted">
                  No cases yet. Intake goes live with Week-2 deploy.
                </td>
              </tr>
            ) : (
              cases.map((c) => (
                <tr key={c.id} className="hover:bg-primary-subtle/30">
                  <td className="px-4 py-3 font-mono text-xs">{c.id.slice(0, 8)}</td>
                  <td className="px-4 py-3">{c.kind}</td>
                  <td className="px-4 py-3">{c.status}</td>
                  <td className="px-4 py-3">{c.priority}</td>
                  <td className="px-4 py-3">{c.insurer ?? '—'}</td>
                  <td className="px-4 py-3 text-right">
                    {c.amountClaimed != null ? (c.amountClaimed / 100).toLocaleString('en-IN') : '—'}
                  </td>
                  <td className="px-4 py-3">{c.deadlineAt?.toISOString().slice(0, 10) ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
