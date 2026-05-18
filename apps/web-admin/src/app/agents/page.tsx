import Link from 'next/link';
import { ChevronRight, CheckCircle2, XCircle, Wand2 } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import { requireAdminSession } from '@/lib/auth';
import { Badge } from '@suraksha/ui';
import { listAgents } from '@/server/agents/actions';

/**
 * Live agent registry — reads from the DB (not the pre-seed fixture). Click
 * an agent to edit its prompt, preview against the golden set, and promote
 * a new version.
 */
export default async function AgentsPage() {
  const session = await requireAdminSession(['super_admin', 'content_editor', 'admin', 'viewer']);
  const agents = await listAgents();

  return (
    <AdminShell role={session.role} email={session.email}>
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Wand2 className="size-3.5" />
          Agent registry
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">Prompts & model tiers</h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Every agent is a versioned row. Click one to edit the prompt, preview against the golden
          set, and promote a new version. Version-safe: every edit mints a new row; old versions
          stay linked to their historical agent_run records.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => (
          <Link
            key={a.slug}
            href={`/agents/${a.slug}`}
            className="group rounded-xl border border-border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-floating"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-ink">{a.displayName}</h3>
                <p className="mt-0.5 truncate font-mono text-xs text-ink-subtle">
                  {a.slug}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="font-mono text-[11px] text-ink-muted">
                  {a.activeModel}
                </span>
              </div>
            </div>
            <p className="mt-3 line-clamp-3 text-xs text-ink-muted">{a.purpose}</p>

            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-border pt-3 text-xs text-ink-muted">
              <div>
                <div className="text-ink-subtle">Default</div>
                <div className="text-ink">{a.defaultVersion != null ? `v${a.defaultVersion}` : '—'}</div>
              </div>
              <div>
                <div className="text-ink-subtle">Versions</div>
                <div className="text-ink">{a.versionCount}</div>
              </div>
              <div>
                <div className="text-ink-subtle">Status</div>
                <div className="flex items-center gap-1 text-ink">
                  {a.enabled ? (
                    <>
                      <CheckCircle2 className="size-3 text-success" />
                      enabled
                    </>
                  ) : (
                    <>
                      <XCircle className="size-3 text-ink-subtle" />
                      disabled
                    </>
                  )}
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-1 text-sm font-medium text-primary">
              <span>Open editor</span>
              <ChevronRight className="size-4 transition group-hover:translate-x-0.5" aria-hidden />
            </div>
          </Link>
        ))}
      </div>
    </AdminShell>
  );
}
