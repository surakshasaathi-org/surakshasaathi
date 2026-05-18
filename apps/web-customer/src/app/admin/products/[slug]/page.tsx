import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowRight,
  ArrowLeft,
  Briefcase,
  ClipboardList,
  FlaskConical,
  Wand2,
  Gauge,
  AlertTriangle,
} from 'lucide-react';
import { Badge } from '@suraksha/ui';
import { AdminShell } from '@/components/admin/admin-shell';
import { AgentFlow } from '@/components/admin/agent-flow';
import { requireAdminSession } from '@/lib/admin/auth';
import { getProductDetail } from '@/server/admin/products/queries';
import { getProductFlow } from '@/lib/admin/product-flows';

interface Props {
  params: Promise<{ slug: string }>;
}

export const dynamic = 'force-dynamic';

/**
 * Single-product hub. Everything an ops engineer needs for ONE module on one
 * screen: agent list, case queue, eval pass rate, recent analyses.
 */
export default async function ProductHubPage({ params }: Props) {
  const { slug } = await params;
  const session = await requireAdminSession([
    'super_admin',
    'admin',
    'content_editor',
    'viewer',
  ]);
  const detail = await getProductDetail(slug);
  if (!detail) notFound();
  const { module, agents, agentEvals, counts, recentCases, recentAnalyses } = detail;
  const flow = getProductFlow(slug);
  const agentBySlug = new Map(agents.map((a) => [a.slug, a] as const));

  return (
    <AdminShell role={session.role} email={session.email}>
      <Link
        href="/admin/products"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        All products
      </Link>

      <header className="mb-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">{module.name}</h1>
          <Badge
            tone={
              module.status === 'live' || module.status === 'beta'
                ? 'success'
                : module.status === 'skeleton'
                  ? 'warn'
                  : 'neutral'
            }
          >
            {module.status}
          </Badge>
          <span className="text-xs text-ink-subtle">
            · {module.cluster} · {module.pricingModel}
          </span>
        </div>
        <p className="mt-2 max-w-prose text-sm text-ink-muted">{module.tagline}</p>
      </header>

      {/* Stat row */}
      <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Active cases" value={counts.casesActive} detail={`${counts.casesTotal} total`} />
        <Stat label="Agents" value={agents.length} detail="tied to module" />
        <Stat label="Eval runs (7d)" value={counts.evalRuns7d} detail="across agents" />
        <Stat
          label="Recent analyses"
          value={counts.analyses}
          detail={slug === 'policy-health-score' ? 'last 8 shown' : 'n/a for this module'}
        />
      </section>

      {/* Agent flow (visual) */}
      {flow && agents.length > 0 && (
        <section className="mb-8">
          <SectionHeader icon={<Wand2 className="size-4" />} title="Agent flow" />
          <AgentFlow flow={flow} agents={agents} />
        </section>
      )}

      {/* Agents */}
      <section className="mb-8">
        <SectionHeader icon={<Wand2 className="size-4" />} title="Agents" />
        {agents.length === 0 ? (
          <EmptyCard>No agents tied to this module yet.</EmptyCard>
        ) : (
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <table className="min-w-full text-sm">
              <thead className="bg-background/60 text-left text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Slug</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Version</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {agents.map((a) => (
                  <tr key={a.slug} className="hover:bg-primary-subtle/30">
                    <td className="px-4 py-3 font-mono text-xs">{a.slug}</td>
                    <td className="px-4 py-3">{a.displayName}</td>
                    <td className="px-4 py-3 font-mono text-xs text-ink">{a.activeModel}</td>
                    <td className="px-4 py-3 text-ink-muted">v{a.defaultVersion}</td>
                    <td className="px-4 py-3">
                      <Badge tone={a.enabled ? 'success' : 'neutral'}>
                        {a.enabled ? 'enabled' : 'disabled'}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/agents/${a.slug}`}
                        className="text-xs font-medium text-primary hover:underline"
                      >
                        Edit prompt →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Per-agent evals */}
      {agents.length > 0 && (
        <section className="mb-8">
          <SectionHeader icon={<Gauge className="size-4" />} title="Evals" />
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
            <table className="min-w-full text-sm">
              <thead className="bg-background/60 text-left text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Rubric</th>
                  <th className="px-4 py-3">Golden cases</th>
                  <th className="px-4 py-3">Runs (7d)</th>
                  <th className="px-4 py-3">Pass rate</th>
                  <th className="px-4 py-3">Last run</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {agentEvals.map((e) => {
                  const agent = agentBySlug.get(e.agentSlug);
                  const noRubric = e.rubricId === null;
                  const noCases = e.goldenCasesEnabled === 0;
                  return (
                    <tr key={e.agentSlug} className="hover:bg-primary-subtle/30">
                      <td className="px-4 py-3">
                        <div className="font-medium text-ink">
                          {agent?.displayName ?? e.agentSlug}
                        </div>
                        <div className="font-mono text-[10px] text-ink-subtle">{e.agentSlug}</div>
                      </td>
                      <td className="px-4 py-3">
                        {noRubric ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-warn">
                            <AlertTriangle className="size-3" />
                            no rubric
                          </span>
                        ) : (
                          <span className="text-xs text-ink-muted">
                            v{e.rubricVersion} · judge: {e.judgeModelTier}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {noCases ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-warn">
                            <AlertTriangle className="size-3" />
                            none tagged
                          </span>
                        ) : (
                          <span className="text-xs text-ink-muted">
                            {e.goldenCasesEnabled} active
                            {e.goldenCasesTotal > e.goldenCasesEnabled && (
                              <span className="text-ink-subtle"> · {e.goldenCasesTotal} total</span>
                            )}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-muted">{e.runs7d}</td>
                      <td className="px-4 py-3">
                        {e.passRate7d === null ? (
                          <span className="text-xs text-ink-subtle">—</span>
                        ) : (
                          <Badge tone={e.passRate7d >= 80 ? 'success' : e.passRate7d >= 60 ? 'warn' : 'danger'}>
                            {e.passRate7d}%
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-ink-subtle">
                        {e.lastRunAt
                          ? new Date(e.lastRunAt).toLocaleString('en-IN', {
                              day: 'numeric',
                              month: 'short',
                              hour: 'numeric',
                              minute: '2-digit',
                            })
                          : 'never'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-3 text-xs font-medium">
                          <Link
                            href={`/agents/${e.agentSlug}/rubric`}
                            className="text-primary hover:underline"
                          >
                            Rubric →
                          </Link>
                          <Link
                            href={`/agents/${e.agentSlug}/golden-cases`}
                            className="text-primary hover:underline"
                          >
                            Cases →
                          </Link>
                          <Link
                            href={`/agents/${e.agentSlug}/regressions`}
                            className="text-primary hover:underline"
                          >
                            Compare →
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Recent cases */}
      <section className="mb-8">
        <SectionHeader icon={<Briefcase className="size-4" />} title="Recent cases" />
        {recentCases.length === 0 ? (
          <EmptyCard>No cases filed under this module yet.</EmptyCard>
        ) : (
          <ul className="space-y-2">
            {recentCases.map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-card"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">
                      {humanize(c.kind)}
                      {c.insurerName ? ` · ${c.insurerName}` : ''}
                    </span>
                    <Badge tone="primary">{humanize(c.status)}</Badge>
                  </div>
                  <div className="mt-0.5 text-xs text-ink-subtle">
                    {new Date(c.createdAt).toLocaleString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                      hour: 'numeric',
                      minute: '2-digit',
                    })}
                  </div>
                </div>
                <Link
                  href={`/cases/${c.id}`}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Open →
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent analyses (Analyse-My-Policy flow belongs to policy-health-score) */}
      {slug === 'policy-health-score' && (
        <section className="mb-8">
          <SectionHeader icon={<ClipboardList className="size-4" />} title="Recent analyses" />
          {recentAnalyses.length === 0 ? (
            <EmptyCard>No recent analyses.</EmptyCard>
          ) : (
            <ul className="space-y-2">
              {recentAnalyses.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 shadow-card"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-ink">{a.id.slice(0, 8)}</span>
                      <Badge tone={a.status === 'ready' ? 'success' : 'primary'}>{a.status}</Badge>
                    </div>
                    <div className="mt-0.5 text-xs text-ink-subtle">
                      {new Date(a.createdAt).toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {a.userId ? ' · signed-in user' : ' · anonymous'}
                    </div>
                  </div>
                  <Link
                    href={`/analyses/${a.id}`}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    Inspect →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Quick links out to the platform-level views, scoped to this product */}
      <section>
        <SectionHeader icon={<FlaskConical className="size-4" />} title="Related" />
        <div className="grid gap-3 sm:grid-cols-3">
          <QuickLink href="/admin/evals" label="Eval dashboard" detail="Cross-agent pass rates" />
          <QuickLink href="/admin/reviews" label="Review queue" detail="Human-in-loop items" />
          <QuickLink href="/admin/audit" label="Audit log" detail="Who changed what, when" />
        </div>
      </section>
    </AdminShell>
  );
}

function Stat({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold text-ink">{value}</div>
      <div className="text-xs text-ink-muted">{detail}</div>
    </div>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
        {title}
      </h2>
    </div>
  );
}

function EmptyCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center text-sm text-ink-muted">
      {children}
    </div>
  );
}

function QuickLink({ href, label, detail }: { href: string; label: string; detail: string }) {
  return (
    <Link
      href={href}
      className="group flex items-start justify-between gap-2 rounded-lg border border-border bg-card p-3 text-sm shadow-card transition hover:border-primary/40"
    >
      <div>
        <div className="font-medium text-ink">{label}</div>
        <div className="mt-0.5 text-xs text-ink-muted">{detail}</div>
      </div>
      <ArrowRight className="size-4 shrink-0 text-ink-subtle transition group-hover:translate-x-0.5 group-hover:text-primary" />
    </Link>
  );
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
