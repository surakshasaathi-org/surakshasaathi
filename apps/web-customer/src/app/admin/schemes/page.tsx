import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdminSession } from '@/lib/admin/auth';
import { serviceDb, schema } from '@suraksha/db';
import { asc } from 'drizzle-orm';
import { resolveI18n } from '@suraksha/i18n';

export default async function SchemesPage() {
  const session = await requireAdminSession(['super_admin', 'content_editor', 'viewer']);
  const db = serviceDb();
  const rows = await db.select().from(schema.scheme).orderBy(asc(schema.scheme.slug));

  return (
    <AdminShell role={session.role} email={session.email}>
      <h1 className="font-display text-2xl font-semibold tracking-tight">Government schemes</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Versioned catalog for Idea-3 Scheme Navigator + Idea-7 Senior Portal. Inline editor lands in Week-3.
      </p>

      <div className="mt-8 grid gap-4 md:grid-cols-2">
        {rows.map((s) => (
          <div key={s.id} className="rounded-lg border border-border bg-card p-5 shadow-card">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">{resolveI18n(s.nameI18n as Record<string, string>, 'en')}</h3>
              <span className="text-xs uppercase tracking-wide text-ink-subtle">v{s.version}</span>
            </div>
            <p className="mt-2 text-xs text-ink-muted">{resolveI18n(s.summaryI18n as Record<string, string>, 'en')}</p>
            <div className="mt-3 flex flex-wrap gap-1 text-xs text-ink-subtle">
              <span className="rounded bg-primary-subtle px-2 py-0.5 text-primary">{s.level}</span>
              {s.stateCode ? <span className="rounded bg-primary-subtle px-2 py-0.5">{s.stateCode}</span> : null}
              <span className="rounded bg-primary-subtle px-2 py-0.5">
                ₹{((s.coveragePaise ?? 0) / 100).toLocaleString('en-IN')}
              </span>
            </div>
          </div>
        ))}
      </div>
    </AdminShell>
  );
}
