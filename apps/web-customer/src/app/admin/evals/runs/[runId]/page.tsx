import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@suraksha/ui';
import { AdminShell } from '@/components/admin/admin-shell';
import { JsonViewer } from '@/components/admin/json-viewer';
import { requireAdminSession } from '@/lib/admin/auth';
import { getEvalRunDetail } from '@/server/admin/evals/golden-actions';

interface Props {
  params: Promise<{ runId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function EvalRunDetailPage({ params }: Props) {
  const { runId } = await params;
  const session = await requireAdminSession([
    'super_admin',
    'admin',
    'content_editor',
    'viewer',
  ]);
  const detail = await getEvalRunDetail(runId);
  if (!detail) notFound();

  const { evalRun, goldenCase, agent, rubric, agentRun, judgeRun } = detail;
  const isError = evalRun.errorMessage !== null;
  const verdict = isError
    ? { tone: 'danger' as const, label: 'error', Icon: AlertTriangle }
    : evalRun.passed === true
      ? { tone: 'success' as const, label: 'passed', Icon: CheckCircle2 }
      : evalRun.passed === false
        ? { tone: 'warn' as const, label: 'failed', Icon: XCircle }
        : { tone: 'neutral' as const, label: 'no verdict', Icon: AlertTriangle };

  return (
    <AdminShell role={session.role} email={session.email}>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        <Link
          href="/admin/evals"
          className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-4" />
          All eval runs
        </Link>
        {agent && (
          <Link
            href={`/agents/${agent.slug}/golden-cases`}
            className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink"
          >
            · {agent.displayName} cases
          </Link>
        )}
      </div>

      <header className="mb-6">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          Eval run
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          {goldenCase?.name ?? 'Unknown case'}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Badge tone={verdict.tone}>
            <verdict.Icon className="mr-1 size-3" />
            {verdict.label}
            {evalRun.qualityScore !== null && ` · ${evalRun.qualityScore}/100`}
          </Badge>
          <span className="text-xs text-ink-subtle">
            {new Date(evalRun.createdAt).toLocaleString('en-IN')} ·{' '}
            trigger: <strong className="text-ink">{evalRun.trigger}</strong>
            {evalRun.ranBy && ` · ran by ${evalRun.ranBy}`}
          </span>
        </div>
      </header>

      {evalRun.errorMessage && (
        <section className="mb-6 rounded-xl border border-danger/30 bg-danger/5 p-4">
          <div className="text-xs font-semibold uppercase tracking-wider text-danger">
            Error
          </div>
          <p className="mt-2 whitespace-pre-wrap break-words text-sm text-danger">
            {evalRun.errorMessage}
          </p>
        </section>
      )}

      {/* Tracing strip */}
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total cost" value={`₹${(evalRun.costPaise / 100).toFixed(2)}`} />
        <Stat
          label="Total latency"
          value={evalRun.latencyMs !== null ? `${(evalRun.latencyMs / 1000).toFixed(1)}s` : '—'}
        />
        <Stat
          label="Agent model"
          value={agentRun?.modelUsed ?? '—'}
          detail={agent ? `${agent.modelTier} · v${agent.version}` : undefined}
        />
        <Stat
          label="Judge model"
          value={judgeRun?.modelUsed ?? '—'}
          detail={rubric ? `${rubric.judgeModelTier} · rubric v${rubric.version}` : undefined}
        />
      </section>

      {/* Agent under test */}
      <section className="mb-8 rounded-xl border border-border bg-card shadow-card">
        <SectionHeader title="Agent under test" subtitle={agent?.slug} />
        <div className="space-y-4 px-4 pb-4">
          {agentRun ? (
            <>
              <RunMetadata r={agentRun} />
              <JsonViewer label="System prompt (current default)" value={agent?.systemPrompt} />
              <JsonViewer label="Input summary" value={agentRun.inputSummary} />
              <JsonViewer label="Agent output JSON" value={agentRun.outputJson} defaultOpen />
              <JsonViewer
                label="Attached document IDs"
                value={agentRun.attachedDocumentIds}
              />
            </>
          ) : (
            <p className="px-1 text-sm text-ink-muted">No agent_run row linked.</p>
          )}
        </div>
      </section>

      {/* Judge */}
      <section className="mb-8 rounded-xl border border-border bg-card shadow-card">
        <SectionHeader
          title="Judge"
          subtitle={rubric ? `${agent?.slug}-judge · rubric v${rubric.version}` : undefined}
        />
        <div className="space-y-4 px-4 pb-4">
          {judgeRun ? (
            <>
              <RunMetadata r={judgeRun} />
              <JsonViewer label="Judge prompt (current default rubric)" value={rubric?.judgePrompt} />
              <JsonViewer label="Judge input summary" value={judgeRun.inputSummary} />
              <JsonViewer
                label="Judge output JSON (verdict)"
                value={evalRun.judgeScoreJson}
                defaultOpen
              />
            </>
          ) : (
            <p className="px-1 text-sm text-ink-muted">
              No judge_run row linked. Judge call may have failed before persistence.
            </p>
          )}
        </div>
      </section>

      {/* Golden case */}
      {goldenCase && (
        <section className="mb-8 rounded-xl border border-border bg-card shadow-card">
          <SectionHeader title="Golden case" subtitle={goldenCase.id} />
          <div className="space-y-3 px-4 pb-4">
            {goldenCase.description && (
              <p className="text-sm text-ink-muted">{goldenCase.description}</p>
            )}
            <div className="flex flex-wrap gap-1.5">
              {goldenCase.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-background px-2 py-0.5 text-[10px] font-medium text-ink-muted"
                >
                  {t}
                </span>
              ))}
            </div>
            <JsonViewer label="expectedExtraction" value={goldenCase.expectedExtraction} />
            <JsonViewer label="expectedCoverage" value={goldenCase.expectedCoverage} />
            <JsonViewer label="expectedChatQa" value={goldenCase.expectedChatQa} />
            <JsonViewer label="demographicsJson" value={goldenCase.demographicsJson} />
            <Link
              href={`/agents/${agent?.slug ?? 'unknown'}/golden-cases/${goldenCase.id}`}
              className="inline-flex text-xs font-medium text-primary hover:underline"
            >
              Open case editor →
            </Link>
          </div>
        </section>
      )}

      <div className="mt-8 text-[10px] text-ink-subtle">
        eval_run.id <code className="font-mono">{evalRun.id}</code>
      </div>
    </AdminShell>
  );
}

function Stat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 shadow-card">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
        {label}
      </div>
      <div className="mt-1 font-display text-lg font-semibold text-ink">{value}</div>
      {detail && <div className="text-[10px] text-ink-muted">{detail}</div>}
    </div>
  );
}

function SectionHeader({ title, subtitle }: { title: string; subtitle?: string | null }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-3 border-b border-border px-4 py-3">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
        {title}
      </h2>
      {subtitle && <span className="font-mono text-[10px] text-ink-subtle">{subtitle}</span>}
    </div>
  );
}

function RunMetadata({ r }: { r: { modelUsed: string; promptTokens: number; completionTokens: number; cachedTokens: number; costPaise: number; latencyMs: number; outcome: string; confidence: number | null } }) {
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
      <Meta k="model" v={r.modelUsed} />
      <Meta k="outcome" v={r.outcome} />
      <Meta k="latency" v={`${(r.latencyMs / 1000).toFixed(2)}s`} />
      <Meta k="cost" v={`₹${(r.costPaise / 100).toFixed(3)}`} />
      <Meta k="prompt tokens" v={r.promptTokens.toLocaleString()} />
      <Meta k="completion tokens" v={r.completionTokens.toLocaleString()} />
      <Meta k="cached tokens" v={r.cachedTokens.toLocaleString()} />
      <Meta k="confidence" v={r.confidence !== null ? r.confidence.toFixed(2) : '—'} />
    </dl>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-ink-subtle">{k}</dt>
      <dd className="font-mono text-xs text-ink">{v}</dd>
    </div>
  );
}
