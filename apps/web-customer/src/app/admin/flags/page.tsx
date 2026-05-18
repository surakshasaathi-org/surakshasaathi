import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdminSession } from '@/lib/admin/auth';
import { serviceDb, schema } from '@suraksha/db';
import { asc } from 'drizzle-orm';
import { Badge } from '@suraksha/ui';

export default async function FlagsPage() {
  const session = await requireAdminSession(['super_admin', 'admin']);
  const db = serviceDb();
  const rows = await db.select().from(schema.featureFlag).orderBy(asc(schema.featureFlag.key));

  return (
    <AdminShell role={session.role} email={session.email}>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Feature flags</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Server-side only. Evaluation order: for-all → tenants → roles → users. Toggle UI in Week-3.
      </p>
      <div className="mt-8 overflow-hidden rounded-lg border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-primary-subtle/50 text-left text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-3">Key</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">For all</th>
              <th className="px-4 py-3">Tenants</th>
              <th className="px-4 py-3">Roles</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((f) => (
              <tr key={f.key}>
                <td className="px-4 py-3 font-mono text-xs">{f.key}</td>
                <td className="px-4 py-3 text-ink-muted">{f.description}</td>
                <td className="px-4 py-3">
                  {f.enabledForAll ? (
                    <Badge tone="success">on</Badge>
                  ) : (
                    <Badge tone="neutral">off</Badge>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-ink-muted">
                  {f.enabledTenants.length ? f.enabledTenants.join(', ') : '—'}
                </td>
                <td className="px-4 py-3 text-xs text-ink-muted">
                  {f.enabledRoles.length ? f.enabledRoles.join(', ') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
