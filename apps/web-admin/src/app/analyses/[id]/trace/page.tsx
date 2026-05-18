import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Badge } from '@suraksha/ui';
import { AdminShell } from '@/components/admin-shell';
import { JsonViewer } from '@/components/json-viewer';
import { requireAdminSession } from '@/lib/auth';
import { getAnalysisForAdmin, getAnalysisTrace } from '@/lib/analyses-live';

interface Props {
  params: Promise<{ id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function AnalysisTracePage({ params }: Props) {
  const { id } = await params;
  const session = await requireAdminSession([
    'super_admin',
    'admin',
    'case_manager',
    'content_editor',
    'viewer',
  ]);
  const analysis = await getAnalysisForAdmin(id);
  if (!analysis) notFound();
  const runs = await getAnalysisTrace(id);

  const totalCost = runs.reduce((acc, r) => acc + r.costPaise, 0);
  const totalLatency = runs.reduce((acc, r) => acc + r.latencyMs, 0);
  const totalIn = runs.reduce((acc, r) => acc + r.promptTokens, 0);
  const totalOut = runs.reduce((acc, r) => acc + r.completionTokens, 0);

  return (
    <AdminShell role={session.role} email={session.email}>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Link
          href={`/analyses/${id}`}
          className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          Back to analysis
        </Link>
      </div>

      <header className="mb-6">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          Full trace
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          Analysis {analysis.id}
        </h1>
        <div className="mt-1 text-sm text-ink-muted">
          {runs.length} agent {runs.length === 1 ? 'run' : 'runs'} ·{' '}
          {(totalLatency / 1000).toFixed(1)}s ·{' '}
          ₹{(totalCost / 100).toFixed(2)} ·{' '}
          {totalIn.toLocaleString()} in / {totalOut.toLocaleString()} out
        </div>
      </header>

      {runs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center text-sm text-ink-muted">
          No agent runs are linked to this analysis.
          <div className="mt-2 text-[10px] text-ink-subtle">
            (Runs from before agent_run.analysis_id was added show as unlinked.)
          </div>
        </div>
      ) : (
        <ol className="space-y-4">
          {runs.map((r, i) => {
            const tone =
              r.outcome === 'success'
                ? ('success' as const)
                : r.outcome === 'low_confidence'
                  ? ('warn' as const)
                  : ('danger' as const);
            return (
              <li
                key={r.id}
                className="rounded-xl border border-border bg-card p-4 shadow-card"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                      step {i + 1}
                    </span>
                    <Link
                      href={`/agents/${r.agentSlug}`}
                      className="font-display text-base font-semibold text-ink hover:text-primary hover:underline"
                    >
                      {r.agentSlug}
                    </Link>
                    <span className="text-xs text-ink-subtle">v{r.agentVersion}</span>
                    <span className="font-mono text-xs text-ink-muted">{r.modelUsed}</span>
                    <Badge tone={tone}>{r.outcome}</Badge>
                  </div>
                  <Link
                    href={`/agent-runs/${r.id}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Open run <ArrowRight className="size-3" />
                  </Link>
                </div>

                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] sm:grid-cols-5">
                  <Meta k="model" v={r.modelUsed} />
                  <Meta k="latency" v={`${(r.latencyMs / 1000).toFixed(2)}s`} />
                  <Meta k="cost" v={`₹${(r.costPaise / 100).toFixed(3)}`} />
                  <Meta k="tokens" v={`${r.promptTokens.toLocaleString()} → ${r.completionTokens.toLocaleString()}`} />
                  <Meta
                    k="confidence"
                    v={r.confidence !== null ? `${Math.round(r.confidence * 100)}%` : '—'}
                  />
                </dl>

                <div className="mt-3 space-y-2">
                  <JsonViewer label="Input summary" value={r.inputSummary} />
                  <JsonViewer label="Output JSON" value={r.outputJson} />
                </div>

                <div className="mt-2 text-[10px] text-ink-subtle">
                  {new Date(r.startedAt).toLocaleString('en-IN')}
                  {r.parentRunId && (
                    <>
                      {' · parent '}
                      <Link
                        href={`/agent-runs/${r.parentRunId}`}
                        className="font-mono hover:text-primary hover:underline"
                      >
                        {r.parentRunId.slice(0, 8)}
                      </Link>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </AdminShell>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="uppercase tracking-wider text-ink-subtle">{k}</dt>
      <dd className="truncate font-mono text-ink">{v}</dd>
    </div>
  );
}
