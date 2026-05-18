import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Activity, DollarSign, Clock, ShieldCheck, Flag } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import { requireAdminSession } from '@/lib/auth';
import { Badge, buttonVariants } from '@suraksha/ui';
import type { AnalysisStatus } from '@/lib/analyses-fixture';
import { getAnalysisForAdmin as getAnalysis, getAgentRunsForAnalysis } from '@/lib/analyses-live';
import { RerunAnalysisButton } from '@/components/rerun-analysis-button';

const STATUS_TONE: Record<AnalysisStatus, 'success' | 'primary' | 'warn' | 'danger' | 'neutral'> = {
  ready: 'success',
  failed: 'danger',
  queued: 'neutral',
  digitizing: 'primary',
  ocr_running: 'primary',
  intake_running: 'primary',
  extracting: 'primary',
  analysing: 'primary',
  translating: 'primary',
  reviewing: 'primary',
};

interface Props {
  params: Promise<{ id: string }>;
}

export default async function AnalysisDetailPage({ params }: Props) {
  const { id } = await params;
  const session = await requireAdminSession(['super_admin', 'admin', 'case_manager', 'viewer']);
  // getAnalysisForAdmin is an async server fn — without await, `a` was a
  // Promise and every field access below returned undefined → the render
  // crashed on `a.locale.toUpperCase()`. Await it.
  const a = await getAnalysis(id);
  if (!a) notFound();

  // Real agent_run rows persisted by the analyse pipeline (linked via
  // agent_run.analysis_id). Each row = one model invocation in the chain
  // (intake → extractor → coverage → refine → chat → coverage-check).
  const agentRuns = await getAgentRunsForAnalysis(id);

  const totalMs = agentRuns.reduce((acc, r) => acc + r.latencyMs, 0);
  const totalCost = agentRuns.reduce((acc, r) => acc + r.costPaise, 0);
  const totalTokensIn = agentRuns.reduce((acc, r) => acc + r.promptTokens, 0);
  const totalTokensOut = agentRuns.reduce((acc, r) => acc + r.completionTokens, 0);

  return (
    <AdminShell role={session.role} email={session.email}>
      <Link
        href="/analyses"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden />
        Back to analyses
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Analysis {a.id}</h1>
          <div className="mt-1 text-sm text-ink-muted">
            Tenant {a.tenantId} · Locale {(a.locale ?? '—').toString().toUpperCase()} · {a.fileKind ?? '—'} · {a.pageCount ?? '—'} pages
          </div>
        </div>
        <Badge tone={STATUS_TONE[a.status]}>{a.status}</Badge>
      </div>

      {/* Summary tiles */}
      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          icon={<ShieldCheck className="size-4 text-primary" />}
          label="Readiness"
          value={a.readinessScore != null ? `${a.readinessScore}/100` : '—'}
        />
        <Tile
          icon={<Flag className="size-4 text-warn" />}
          label="Red flags"
          value={a.redFlagsCount != null ? String(a.redFlagsCount) : '—'}
        />
        <Tile
          icon={<Activity className="size-4 text-ink-muted" />}
          label="Confidence"
          value={a.confidenceOverall != null ? `${Math.round(a.confidenceOverall * 100)}%` : '—'}
        />
        <Tile
          icon={<DollarSign className="size-4 text-success" />}
          label="Agent cost"
          value={`₹${(a.costPaise / 100).toFixed(2)}`}
        />
      </div>

      {/* Policy context */}
      <section className="mt-8 rounded-lg border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-ink">Policy</h2>
        <dl className="mt-3 grid grid-cols-2 gap-y-2 text-sm sm:grid-cols-4">
          <dt className="text-xs text-ink-subtle">Insurer</dt>
          <dd>{a.insurerName ?? '—'}</dd>
          <dt className="text-xs text-ink-subtle">Plan</dt>
          <dd>{a.planName ?? '—'}</dd>
          <dt className="text-xs text-ink-subtle">Created</dt>
          <dd>{new Date(a.createdAt).toLocaleString('en-IN')}</dd>
          <dt className="text-xs text-ink-subtle">Ready at</dt>
          <dd>{a.readyAt ? new Date(a.readyAt).toLocaleString('en-IN') : '—'}</dd>
        </dl>
      </section>

      {/* Agent runs */}
      <section className="mt-6">
        <div className="mb-3 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-ink">Agent runs</h2>
          <div className="flex items-center gap-3 text-xs text-ink-subtle">
            <span>
              <Clock className="mr-1 inline size-3.5" aria-hidden />
              {(totalMs / 1000).toFixed(1)}s total
            </span>
            <span>₹{(totalCost / 100).toFixed(2)}</span>
            <span>{totalTokensIn.toLocaleString()} in · {totalTokensOut.toLocaleString()} out</span>
            <Link
              href={`/analyses/${id}/trace`}
              className="ml-2 rounded-md border border-border bg-card px-2 py-1 text-xs font-medium text-primary hover:bg-primary-subtle/30"
            >
              Full trace →
            </Link>
          </div>
        </div>
        <div className="overflow-hidden rounded-lg border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="border-b border-border bg-primary-subtle/40 text-left text-xs uppercase tracking-wide text-ink-muted">
              <tr>
                <th className="px-4 py-2.5">Agent</th>
                <th className="px-4 py-2.5">Model</th>
                <th className="px-4 py-2.5 text-right">Duration</th>
                <th className="px-4 py-2.5 text-right">Tokens in</th>
                <th className="px-4 py-2.5 text-right">Tokens out</th>
                <th className="px-4 py-2.5 text-right">Cost (₹)</th>
                <th className="px-4 py-2.5 text-right">Confidence</th>
                <th className="px-4 py-2.5">Outcome</th>
                <th className="px-4 py-2.5 text-right">Trace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {agentRuns.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-sm text-ink-subtle">
                    No agent runs linked to this analysis.
                  </td>
                </tr>
              ) : (
                agentRuns.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2.5">
                      <Link href={`/agent-runs/${r.id}`} className="text-primary hover:underline">
                        {r.agentSlug}
                      </Link>
                      <span className="ml-1 text-xs text-ink-subtle">v{r.agentVersion}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-xs text-ink">{r.modelUsed}</span>
                    </td>
                    <td className="px-4 py-2.5 text-right">{(r.latencyMs / 1000).toFixed(1)}s</td>
                    <td className="px-4 py-2.5 text-right">{r.promptTokens.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">{r.completionTokens.toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-right">{(r.costPaise / 100).toFixed(2)}</td>
                    <td className="px-4 py-2.5 text-right">
                      {r.confidence != null ? `${Math.round(r.confidence * 100)}%` : '—'}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={r.outcome === 'success' ? 'success' : r.outcome === 'low_confidence' ? 'warn' : 'danger'}>
                        {r.outcome}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <Link
                        href={`/evals/traces/${r.id}`}
                        className="text-xs font-medium text-primary hover:underline"
                        title="Open the per-LLM-call trace in the Eval Lab"
                      >
                        Trace →
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Actions — `id` is the full UUID from the URL; a.id is the 8-char
          display prefix and isn't a valid lookup key for the rerun API. */}
      <section className="mt-8 flex flex-wrap items-center gap-3">
        <RerunAnalysisButton analysisId={id} />
        <button className={buttonVariants({ variant: 'outline', size: 'sm' })} type="button" disabled>
          Flag for quality review
        </button>
        <button className={buttonVariants({ variant: 'ghost', size: 'sm' })} type="button" disabled>
          Delete analysis
        </button>
      </section>

      <p className="mt-6 text-xs text-ink-subtle">
        Actions above are placeholders in dev mode. Live when the DB is connected.
      </p>
    </AdminShell>
  );
}

function Tile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-md border border-border bg-card p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-ink-subtle">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-display text-xl font-semibold text-ink">{value}</div>
    </div>
  );
}
