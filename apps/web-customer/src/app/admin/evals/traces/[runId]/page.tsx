import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, AlertTriangle, CheckCircle2, FlaskConical, Clock } from 'lucide-react';
import { and, asc, eq } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdminSession } from '@/lib/admin/auth';
import { TraceStepCard } from '@/components/admin/trace-step-card';

interface Props {
  params: Promise<{ runId: string }>;
}

export const dynamic = 'force-dynamic';

/**
 * /evals/traces/[runId] — Eval Lab trace viewer.
 *
 * Reads:
 *   - agent_run row (parent)
 *   - agent_run_step rows in step_index order
 *   - sibling agent_run rows that share parent_run_id (so a chained run
 *     like extractor → coverage → explainer renders as a tree)
 *
 * Writes:
 *   - one trace_view_audit row per GET (admin id, agent_run_id, viewed_at)
 *
 * Admin-only per PRD §3 RBAC. Other roles 403.
 */
export default async function TraceViewerPage({ params }: Props) {
  const session = await requireAdminSession(['super_admin', 'admin']);
  const { runId } = await params;

  const db = serviceDb();
  const [run] = await db
    .select()
    .from(schema.agentRun)
    .where(eq(schema.agentRun.id, runId))
    .limit(1);
  if (!run) notFound();

  const steps = await db
    .select()
    .from(schema.agentRunStep)
    .where(eq(schema.agentRunStep.agentRunId, runId))
    .orderBy(asc(schema.agentRunStep.stepIndex));

  const siblings = run.parentRunId
    ? await db
        .select({
          id: schema.agentRun.id,
          agentSlug: schema.agentRun.agentSlug,
          outcome: schema.agentRun.outcome,
          startedAt: schema.agentRun.startedAt,
          latencyMs: schema.agentRun.latencyMs,
        })
        .from(schema.agentRun)
        .where(
          and(
            eq(schema.agentRun.parentRunId, run.parentRunId),
          ),
        )
        .orderBy(asc(schema.agentRun.startedAt))
    : [];

  // Audit-log this view. Best-effort; never blocks render.
  void db
    .insert(schema.traceViewAudit)
    .values({ adminId: session.userId as never, agentRunId: runId })
    .catch((err) => {
      console.warn(`[trace-view] audit write failed runId=${runId} err=${(err as Error).message}`);
    });

  return (
    <AdminShell role={session.role} email={session.email}>
      <header className="mb-6">
        <Link
          href="/admin/evals"
          className="mb-2 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-3.5" /> Back to Evals
        </Link>
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <FlaskConical className="size-3.5" />
          Trace
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          {run.agentSlug} <span className="text-ink-muted">v{run.agentVersion}</span>
        </h1>
        <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-ink-muted">
          <Badge tone={run.runSource === 'eval_lab' ? 'primary' : 'success'}>
            {run.runSource === 'eval_lab' ? 'Eval Lab run' : 'Customer upload'}
          </Badge>
          <Badge tone="neutral">{run.deployEnv}</Badge>
          <Outcome outcome={run.outcome} />
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" />
            {run.latencyMs.toLocaleString()}ms
          </span>
          <span>₹{(run.costPaise / 100).toFixed(2)} · {run.modelUsed}</span>
        </div>
      </header>

      {siblings.length > 1 && (
        <section className="mb-6">
          <h2 className="mb-2 font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
            Sibling agents (same parent run)
          </h2>
          <div className="flex flex-wrap gap-2">
            {siblings.map((s) => (
              <Link
                key={s.id}
                href={`/evals/traces/${s.id}`}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  s.id === runId
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-card text-ink hover:border-primary/40'
                }`}
              >
                {s.agentSlug}
                <span className="text-[10px] uppercase tracking-wider opacity-80">
                  {s.outcome}
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Steps
        </h2>
        {steps.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-ink-muted">
            No step rows for this run. Either it predates step recording (added 2026-04-25), or
            the recordStep hook wasn't wired at the call site.
          </div>
        ) : (
          <div className="space-y-3">
            {steps.map((s) => (
              <TraceStepCard key={s.id} step={s} />
            ))}
          </div>
        )}
      </section>
    </AdminShell>
  );
}

function Badge({ tone, children }: { tone: 'primary' | 'success' | 'neutral'; children: React.ReactNode }) {
  const cls =
    tone === 'primary'
      ? 'bg-primary-subtle text-primary'
      : tone === 'success'
        ? 'bg-success-subtle text-success'
        : 'bg-ink/5 text-ink-muted';
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  );
}

function Outcome({ outcome }: { outcome: string }) {
  const ok = outcome === 'success';
  return (
    <span
      className={`inline-flex items-center gap-1 ${ok ? 'text-success' : 'text-warn'}`}
    >
      {ok ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}
      {outcome}
    </span>
  );
}
