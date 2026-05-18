import { AdminShell } from '@/components/admin-shell';
import { requireAdminSession } from '@/lib/auth';
import { serviceDb, schema } from '@suraksha/db';
import { asc } from 'drizzle-orm';
import { resolveI18n } from '@suraksha/i18n';
import { Badge } from '@suraksha/ui';

export default async function ModulesPage() {
  const session = await requireAdminSession(['super_admin', 'content_editor', 'viewer']);
  const db = serviceDb();
  const rows = await db.select().from(schema.productModule).orderBy(asc(schema.productModule.orderIndex));

  return (
    <AdminShell role={session.role} email={session.email}>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Product modules</h1>
      <p className="mt-2 text-sm text-ink-muted">
        All 8 verticals, rendered on the public landing page from these rows. Editing lands in Week-3.
      </p>
      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {rows.map((m) => (
          <div key={m.id} className="rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-ink">
                  {resolveI18n(m.nameI18n as Record<string, string>, 'en')}
                </h3>
                <p className="mt-1 text-xs text-ink-muted">
                  {resolveI18n(m.taglineI18n as Record<string, string>, 'en')}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge tone={m.status === 'live' ? 'success' : m.status === 'beta' ? 'primary' : 'neutral'}>
                  {m.status}
                </Badge>
                <Badge tone="accent">{m.pricingModel}</Badge>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div>
                <dt className="text-ink-subtle">Route</dt>
                <dd className="font-mono">{m.landingRoute}</dd>
              </div>
              <div>
                <dt className="text-ink-subtle">Auth</dt>
                <dd>{m.authRequired}</dd>
              </div>
              <div>
                <dt className="text-ink-subtle">Locales</dt>
                <dd>{m.launchLocales.join(', ')}</dd>
              </div>
              <div>
                <dt className="text-ink-subtle">Agents</dt>
                <dd>{m.agentDefinitionIds.length}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
