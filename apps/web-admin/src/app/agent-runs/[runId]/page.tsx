import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Badge } from '@suraksha/ui';
import { AdminShell } from '@/components/admin-shell';
import { JsonViewer } from '@/components/json-viewer';
import { requireAdminSession } from '@/lib/auth';
import { getAgentRunDetail } from '@/lib/analyses-live';

interface Props {
  params: Promise<{ runId: string }>;
}

export const dynamic = 'force-dynamic';

export default async function AgentRunDetailPage({ params }: Props) {
  const { runId } = await params;
  const session = await requireAdminSession([
    'super_admin',
    'admin',
    'case_manager',
    'content_editor',
    'viewer',
  ]);
  const r = await getAgentRunDetail(runId);
  if (!r) notFound();

  const verdict =
    r.outcome === 'success'
      ? { tone: 'success' as const, label: r.outcome, Icon: CheckCircle2 }
      : r.outcome === 'low_confidence'
        ? { tone: 'warn' as const, label: r.outcome, Icon: AlertTriangle }
        : { tone: 'danger' as const, label: r.outcome, Icon: XCircle };

  return (
    <AdminShell role={session.role} email={session.email}>
      <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
        {r.analysisId && (
          <Link
            href={`/analyses/${r.analysisId}`}
            className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink"
          >
            <ArrowLeft className="size-4" />
            Back to analysis
          </Link>
        )}
        <Link
          href={`/agents/${r.agentSlug}`}
          className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink"
        >
          · {r.agentDisplayName ?? r.agentSlug}
        </Link>
        {r.analysisId && (
          <Link
            href={`/analyses/${r.analysisId}/trace`}
            className="inline-flex items-center gap-1.5 text-ink-muted hover:text-ink"
          >
            · full trace
          </Link>
        )}
      </div>

      <header className="mb-6">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          Agent run
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          {r.agentDisplayName ?? r.agentSlug}{' '}
          <span className="text-ink-muted">v{r.agentVersion}</span>
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Badge tone={verdict.tone}>
            <verdict.Icon className="mr-1 size-3" />
            {verdict.label}
            {r.confidence !== null && ` · conf ${Math.round(r.confidence * 100)}%`}
          </Badge>
          <span className="font-mono text-xs text-ink-muted">{r.modelUsed}</span>
          <span className="text-xs text-ink-subtle">
            {new Date(r.startedAt).toLocaleString('en-IN')} ·{' '}
            <strong className="text-ink">{r.runSource}</strong> · env {r.deployEnv}
          </span>
        </div>
      </header>

      {/* Tracing strip */}
      <section className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Latency" value={`${(r.latencyMs / 1000).toFixed(2)}s`} />
        <Stat label="Cost" value={`₹${(r.costPaise / 100).toFixed(3)}`} />
        <Stat
          label="Tokens"
          value={`${r.promptTokens.toLocaleString()} → ${r.completionTokens.toLocaleString()}`}
          detail={r.cachedTokens > 0 ? `${r.cachedTokens.toLocaleString()} cached` : undefined}
        />
        <Stat label="Model" value={r.modelUsed} />
      </section>

      <section className="mb-8 rounded-xl border border-border bg-card shadow-card">
        <SectionHeader title="Input" subtitle={r.agentSlug} />
        <div className="space-y-4 px-4 pb-4">
          <JsonViewer label="System prompt (current default)" value={r.agentSystemPrompt} />
          <JsonViewer label="Input summary" value={r.inputSummary} defaultOpen />
          <div className="rounded-md border border-border bg-background">
            <div className="flex items-center justify-between border-b border-border px-2.5 py-1.5 text-[11px] font-medium text-ink-muted">
              <span>Attached documents</span>
              <span className="text-[10px] text-ink-subtle">
                {r.attachedDocuments.length} of {r.attachedDocumentIds.length}
              </span>
            </div>
            {r.attachedDocumentIds.length === 0 ? (
              <p className="px-3 py-3 text-xs text-ink-subtle">
                None — this run did not receive any documents (e.g. it reasons over
                already-extracted JSON or a chat message).
              </p>
            ) : r.attachedDocuments.length === 0 ? (
              <p className="px-3 py-3 text-xs text-ink-subtle">
                {r.attachedDocumentIds.length} ID{r.attachedDocumentIds.length === 1 ? '' : 's'} on this run, but the
                policy_document row{r.attachedDocumentIds.length === 1 ? '' : 's'} could not be loaded (expired or RLS).
                <pre className="mt-2 overflow-x-auto font-mono text-[10px] text-ink">
                  {r.attachedDocumentIds.join('\n')}
                </pre>
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {r.attachedDocuments.map((d) => (
                  <li key={d.id} className="px-3 py-2 text-xs">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-medium text-ink">
                        {d.filename ?? d.id.slice(0, 8)}
                      </span>
                      <span className="font-mono text-[10px] text-ink-subtle">{d.id}</span>
                    </div>
                    <div className="mt-0.5 text-[11px] text-ink-muted">
                      {d.mime} · {(d.sizeBytes / 1024).toFixed(1)} KB
                      {d.pageCount !== null && ` · ${d.pageCount} pages`}
                      {d.storagePath && ` · ${d.storagePath}`}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="mb-8 rounded-xl border border-border bg-card shadow-card">
        <SectionHeader title="Output" subtitle={r.modelUsed} />
        <div className="space-y-4 px-4 pb-4">
          <JsonViewer label="Output JSON" value={r.outputJson} defaultOpen />
          {r.userVisibleSummary !== null && (
            <JsonViewer label="User-visible summary" value={r.userVisibleSummary} />
          )}
        </div>
      </section>

      {/* Linkage */}
      <section className="mb-8 rounded-xl border border-border bg-card shadow-card">
        <SectionHeader title="Linkage" />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 px-4 pb-4 text-xs sm:grid-cols-3">
          <Meta k="run id" v={r.id} />
          <Meta k="analysis id" v={r.analysisId ?? '—'} />
          <Meta k="case id" v={r.caseId ?? '—'} />
          <Meta k="parent run id" v={r.parentRunId ?? '—'} />
          <Meta k="tenant id" v={r.tenantId} />
          <Meta
            k="started → ended"
            v={`${new Date(r.startedAt).toLocaleTimeString('en-IN')} → ${new Date(r.endedAt).toLocaleTimeString('en-IN')}`}
          />
        </dl>
      </section>

      <div className="mt-8 text-[10px] text-ink-subtle">
        agent_run.id <code className="font-mono">{r.id}</code>
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
      <div className="mt-1 truncate font-display text-lg font-semibold text-ink">{value}</div>
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

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-ink-subtle">{k}</dt>
      <dd className="break-all font-mono text-xs text-ink">{v}</dd>
    </div>
  );
}
