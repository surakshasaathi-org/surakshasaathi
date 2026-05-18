import Link from 'next/link';
import { ArrowLeft, FlaskConical, Database } from 'lucide-react';
import { desc } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import { listAllTemplates } from '@suraksha/eval-lab';
import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdminSession } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

/**
 * /evals/datasets — admin list of synthetic golden-case datasets. The
 * dataset row records the template_mix + seed; the detail page shows the
 * generated cases. Day-1 read-only with pointers to the template registry;
 * dataset creation lands in milestone 2 (POST /api/eval-lab/datasets).
 */
export default async function AdminEvalDatasetsPage() {
  const session = await requireAdminSession(['super_admin', 'admin']);
  const db = serviceDb();

  const datasets = await db
    .select()
    .from(schema.evalDataset)
    .orderBy(desc(schema.evalDataset.createdAt));

  const templates = listAllTemplates();

  return (
    <AdminShell role={session.role} email={session.email}>
      <header className="mb-8">
        <Link
          href="/admin/evals"
          className="mb-2 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-3.5" /> Back to Evals
        </Link>
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <FlaskConical className="size-3.5" />
          Datasets
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          Synthetic golden-case datasets
        </h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Datasets group synthetic cases generated from the same template mix + seed. Re-running
          with the same seed regenerates identical PDFs + expected outputs (deterministic).
        </p>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Datasets
        </h2>
        {datasets.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-ink-muted">
            No datasets yet. The dataset creation surface ships in the next milestone — for now,
            insert rows directly into <code className="rounded bg-background px-1.5 py-0.5">eval_dataset</code> and
            invoke <code className="rounded bg-background px-1.5 py-0.5">generateDataset()</code> from a
            server action.
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <table className="w-full text-sm">
              <thead className="bg-background/60 text-left text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Insurance line</th>
                  <th className="px-4 py-3 text-right">Cases</th>
                  <th className="px-4 py-3 text-right">Seed</th>
                  <th className="px-4 py-3">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {datasets.map((d) => (
                  <tr key={d.id}>
                    <td className="px-4 py-3 font-medium text-ink">{d.name}</td>
                    <td className="px-4 py-3 text-xs text-ink-muted">{d.insuranceLine}</td>
                    <td className="px-4 py-3 text-right">{d.caseCount}</td>
                    <td className="px-4 py-3 text-right font-mono text-xs">{d.seed}</td>
                    <td className="px-4 py-3 text-xs text-ink-muted">
                      {new Date(d.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Template registry
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {templates.map((t) => (
            <div
              key={t.slug}
              className="rounded-xl border border-border bg-card p-4 shadow-card"
            >
              <div className="flex items-center gap-2">
                <Database className="size-3.5 text-ink-subtle" />
                <span className="font-mono text-xs text-ink-subtle">{t.slug}</span>
              </div>
              <div className="mt-1 font-medium text-ink">{t.displayName}</div>
              <div className="mt-1 text-xs text-ink-muted">Insurance line: {t.insuranceLine}</div>
            </div>
          ))}
        </div>
      </section>
    </AdminShell>
  );
}
