import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, GitCompareArrows, TrendingDown, TrendingUp } from 'lucide-react';
import { Badge } from '@suraksha/ui';
import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdminSession } from '@/lib/admin/auth';
import { getAgent } from '@/server/admin/agents/actions';
import { getRegressionReport, listAgentVersions } from '@/server/admin/evals/golden-actions';

interface Props {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ baseline?: string; candidate?: string }>;
}

export const dynamic = 'force-dynamic';

export default async function RegressionsPage({ params, searchParams }: Props) {
  const { slug } = await params;
  const sp = await searchParams;
  const session = await requireAdminSession([
    'super_admin',
    'admin',
    'content_editor',
    'viewer',
  ]);
  const agent = await getAgent(slug);
  if (!agent) notFound();
  const defaultV = agent.versions.find((v) => v.isDefault) ?? agent.versions[0];
  const displayName = defaultV?.displayName ?? slug;

  const versions = await listAgentVersions(slug);
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  // Defaults: candidate = current default; baseline = previous version (if any).
  const candidateDefault = sorted.find((v) => v.isDefault)?.version ?? sorted[0]?.version ?? 1;
  const baselineDefault =
    sorted.find((v) => v.version < candidateDefault)?.version ?? candidateDefault;

  const baselineVersion = Number(sp.baseline ?? baselineDefault);
  const candidateVersion = Number(sp.candidate ?? candidateDefault);

  const report = await getRegressionReport({
    agentSlug: slug,
    baselineVersion,
    candidateVersion,
  });

  const passDelta =
    report.rollupCandidate.passRate !== null && report.rollupBaseline.passRate !== null
      ? report.rollupCandidate.passRate - report.rollupBaseline.passRate
      : null;
  const scoreDelta =
    report.rollupCandidate.avgScore !== null && report.rollupBaseline.avgScore !== null
      ? report.rollupCandidate.avgScore - report.rollupBaseline.avgScore
      : null;

  return (
    <AdminShell role={session.role} email={session.email}>
      <Link
        href={`/agents/${slug}`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        Back to {displayName}
      </Link>

      <header className="mb-6">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <GitCompareArrows className="size-3.5" />
          Regression compare
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          {displayName} — version comparison
        </h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Compare the latest eval-run results between two versions on the same golden cases.
          Use this before promoting a new prompt: any case that flips pass→fail is a hard
          regression.
        </p>
      </header>

      <form className="mb-6 flex flex-wrap items-end gap-3" method="get">
        <Picker name="baseline" label="Baseline" options={sorted} value={baselineVersion} />
        <Picker name="candidate" label="Candidate" options={sorted} value={candidateVersion} />
        <button
          type="submit"
          className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-card hover:bg-primary/90"
        >
          Compare
        </button>
      </form>

      <section className="mb-8 grid gap-3 sm:grid-cols-3">
        <RollupCard
          title={`Baseline · v${report.baselineVersion}`}
          rollup={report.rollupBaseline}
        />
        <RollupCard
          title={`Candidate · v${report.candidateVersion}`}
          rollup={report.rollupCandidate}
        />
        <div className="rounded-xl border border-border bg-card p-4 shadow-card">
          <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
            Delta
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="font-display text-2xl font-semibold text-ink">
              {passDelta !== null
                ? `${passDelta >= 0 ? '+' : ''}${passDelta} pp`
                : '—'}
            </span>
            <span className="text-xs text-ink-muted">pass rate</span>
          </div>
          <div className="mt-1 text-xs text-ink-muted">
            score Δ:{' '}
            {scoreDelta !== null ? (scoreDelta >= 0 ? `+${scoreDelta}` : `${scoreDelta}`) : '—'}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
            <Badge tone="success">
              <TrendingUp className="mr-1 size-3" />
              {report.improved} improved
            </Badge>
            <Badge tone={report.regressed > 0 ? 'danger' : 'neutral'}>
              <TrendingDown className="mr-1 size-3" />
              {report.regressed} regressed
            </Badge>
            <Badge tone="neutral">{report.unchanged} unchanged</Badge>
            <Badge tone="warn">{report.missing} missing data</Badge>
          </div>
        </div>
      </section>

      {/* Per-case grid */}
      <section>
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Per-case comparison
        </h2>
        <div className="overflow-hidden rounded-xl border border-border bg-card shadow-card">
          <table className="min-w-full text-sm">
            <thead className="bg-background/60 text-left text-xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-4 py-3">Case</th>
                <th className="px-4 py-3">v{report.baselineVersion}</th>
                <th className="px-4 py-3">v{report.candidateVersion}</th>
                <th className="px-4 py-3">Delta</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {report.cases.map((c) => (
                <tr key={c.caseId}>
                  <td className="px-4 py-3 font-medium text-ink">{c.caseName}</td>
                  <td className="px-4 py-3">
                    {c.baseline ? <Verdict v={c.baseline.passed} score={c.baseline.qualityScore} /> : <span className="text-xs text-ink-subtle">no run</span>}
                  </td>
                  <td className="px-4 py-3">
                    {c.candidate ? <Verdict v={c.candidate.passed} score={c.candidate.qualityScore} /> : <span className="text-xs text-ink-subtle">no run</span>}
                  </td>
                  <td className="px-4 py-3">
                    <DeltaBadge delta={c.delta} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2 text-[10px]">
                      {c.baseline?.runId && (
                        <Link
                          href={`/evals/runs/${c.baseline.runId}`}
                          className="inline-flex items-center gap-0.5 text-primary hover:underline"
                        >
                          v{report.baselineVersion} trace <ArrowUpRight className="size-3" />
                        </Link>
                      )}
                      {c.candidate?.runId && (
                        <Link
                          href={`/evals/runs/${c.candidate.runId}`}
                          className="inline-flex items-center gap-0.5 text-primary hover:underline"
                        >
                          v{report.candidateVersion} trace <ArrowUpRight className="size-3" />
                        </Link>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {report.cases.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-sm text-ink-muted">
                    No golden cases tagged with{' '}
                    <code className="rounded bg-background px-1 py-0.5 font-mono text-[11px]">
                      {slug}
                    </code>
                    .
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </AdminShell>
  );
}

function Picker({
  name,
  label,
  options,
  value,
}: {
  name: string;
  label: string;
  options: Array<{ version: number; isDefault: boolean }>;
  value: number;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold uppercase tracking-wider text-ink-subtle">{label}</span>
      <select
        name={name}
        defaultValue={value}
        className="rounded-md border border-border bg-background px-2 py-1.5 text-sm text-ink"
      >
        {options.map((o) => (
          <option key={o.version} value={o.version}>
            v{o.version}
            {o.isDefault ? ' · default' : ''}
          </option>
        ))}
      </select>
    </label>
  );
}

function RollupCard({
  title,
  rollup,
}: {
  title: string;
  rollup: { runs: number; passRate: number | null; avgScore: number | null; errors: number };
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
        {title}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-display text-2xl font-semibold text-ink">
          {rollup.passRate !== null ? `${rollup.passRate}%` : '—'}
        </span>
        <span className="text-xs text-ink-muted">pass rate</span>
      </div>
      <div className="mt-1 text-xs text-ink-muted">
        {rollup.runs} runs · avg {rollup.avgScore ?? '—'}/100 · {rollup.errors} errors
      </div>
    </div>
  );
}

function Verdict({ v, score }: { v: boolean | null; score: number | null }) {
  if (v === true) return <Badge tone="success">passed{score !== null && ` · ${score}`}</Badge>;
  if (v === false) return <Badge tone="warn">failed{score !== null && ` · ${score}`}</Badge>;
  return <Badge tone="neutral">no verdict</Badge>;
}

function DeltaBadge({ delta }: { delta: 'improved' | 'regressed' | 'unchanged' | 'missing' }) {
  if (delta === 'improved')
    return (
      <Badge tone="success">
        <TrendingUp className="mr-1 size-3" />
        improved
      </Badge>
    );
  if (delta === 'regressed')
    return (
      <Badge tone="danger">
        <TrendingDown className="mr-1 size-3" />
        regressed
      </Badge>
    );
  if (delta === 'unchanged') return <Badge tone="neutral">unchanged</Badge>;
  return <Badge tone="warn">missing data</Badge>;
}
