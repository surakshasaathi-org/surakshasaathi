import Link from 'next/link';
import { FolderTree, ArrowRight } from 'lucide-react';
import { Badge } from '@suraksha/ui';
import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdminSession } from '@/lib/admin/auth';
import { listProductModules } from '@/server/admin/products/queries';

export const dynamic = 'force-dynamic';

export default async function ProductsIndexPage() {
  const session = await requireAdminSession([
    'super_admin',
    'admin',
    'content_editor',
    'viewer',
  ]);
  const modules = await listProductModules();

  return (
    <AdminShell role={session.role} email={session.email}>
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <FolderTree className="size-3.5" />
          Products
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          All product modules
        </h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Each product module has its own agents, evals, cases, and analyses. Click a module to
          see everything scoped to it in one view.
        </p>
      </header>

      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {modules.map((m) => (
          <li key={m.id}>
            <Link
              href={`/products/${m.id}`}
              className="group flex h-full flex-col rounded-xl border border-border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-floating"
            >
              <div className="flex items-start justify-between gap-2">
                <h2 className="font-display text-lg font-semibold text-ink">{m.name}</h2>
                <Badge
                  tone={
                    m.status === 'live' || m.status === 'beta'
                      ? 'success'
                      : m.status === 'skeleton'
                        ? 'warn'
                        : 'neutral'
                  }
                >
                  {m.status}
                </Badge>
              </div>
              <p className="mt-2 flex-1 text-sm text-ink-muted">{m.tagline}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-subtle">
                <span>{m.agentIds.length} agent{m.agentIds.length === 1 ? '' : 's'}</span>
                <span>·</span>
                <span>{m.cluster}</span>
                <span>·</span>
                <span>{m.pricingModel}</span>
              </div>
              <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-primary">
                Open hub
                <ArrowRight className="size-4 transition group-hover:translate-x-1" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </AdminShell>
  );
}
