import Link from 'next/link';
import { AlertTriangle, CheckCircle2, FlaskConical, XCircle, MinusCircle } from 'lucide-react';
import { AdminShell } from '@/components/admin/admin-shell';
import { requireAdminSession } from '@/lib/admin/auth';
import {
  getAgentEvalSummary,
  getGoldenCasesCount,
  listRecentEvalRuns,
} from '@/server/admin/evals/queries';

/**
 * Ops eval dashboard. Two panels:
 *   1. Per-agent 7-day rollup — runs, pass rate, avg quality score, last run,
 *      rubric version in play. Signals regressions at a glance.
 *   2. Recent eval_run list — cross-agent, filter-able later, for drilling
 *      into a specific failure.
 *
 * Empty states are intentional: the cron hasn't run yet in dev; the copy
 * tells ops how to trigger it.
 */
export default async function AdminEvalsPage() {
  const session = await requireAdminSession([
    'super_admin',
    'admin',
    'content_editor',
    'viewer',
  ]);
  const [summary, recent, cases] = await Promise.all([
    getAgentEvalSummary(),
    listRecentEvalRuns(50),
    getGoldenCasesCount(),
  ]);

  return (
    <AdminShell role={session.role} email={session.email}>
      <header className="mb-8">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <FlaskConical className="size-3.5" />
          Evals
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          Agent quality dashboard
        </h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Nightly cron scores live agent runs against the golden set + rubrics. This view rolls up
          the last 7 days and lists every individual eval for drilling.
        </p>
        <nav className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/admin/evals/datasets"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-ink transition hover:border-primary/40"
          >
            Datasets →
          </Link>
          <Link
            href="/admin/evals/sampling"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-ink transition hover:border-primary/40"
          >
            Prod sampling →
          </Link>
        </nav>
      </header>

      {/* Top stats */}
      <section className="mb-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Stat label="Golden cases" value={`${cases.enabled} / ${cases.total}`} detail="enabled / total" />
        <Stat
          label="Agents with evals"
          value={`${summary.filter((s) => s.runs7d > 0).length} / ${summary.length}`}
          detail="exercised last 7d"
        />
        <Stat
          label="Overall pass rate"
          value={overallPassRate(summary)}
          detail="weighted 7d"
        />
        <Stat
          label="Recent runs"
          value={`${recent.length}`}
          detail={`last ${recent.length}`}
        />
      </section>

      {/* Per-agent summary */}
      <section className="mb-8">
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Per-agent (last 7 days)
        </h2>
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
          <table className="min-w-full text-sm">
            <thead className="bg-background/60 text-left text-xs uppercase tracking-wider text-ink-muted">
              <tr>
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Runs</th>
                <th className="px-4 py-3">Pass rate</th>
                <th className="px-4 py-3">Avg score</th>
                <th className="px-4 py-3">Rubric v.</th>
                <th className="px-4 py-3">Last run</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {summary.map((s) => (
                <tr key={s.agentSlug}>
                  <td className="px-4 py-3 font-mono text-xs">{s.agentSlug}</td>
                  <td className="px-4 py-3">{s.runs7d}</td>
                  <td className={`px-4 py-3 font-medium ${passRateTone(s.passRate7d)}`}>
                    {s.passRate7d != null ? `${s.passRate7d}%` : '—'}
                  </td>
                  <td className={`px-4 py-3 ${scoreTone(s.avgScore7d)}`}>
                    {s.avgScore7d != null ? s.avgScore7d : '—'}
                  </td>
                  <td className="px-4 py-3 text-ink-muted">
                    {s.rubricVersion != null ? `v${s.rubricVersion}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {s.lastRunAt ? (
                      <span className="inline-flex items-center gap-1">
                        {s.lastRunPassed === true ? (
                          <CheckCircle2 className="size-3.5 text-success" />
                        ) : s.lastRunPassed === false ? (
                          <XCircle className="size-3.5 text-danger" />
                        ) : (
                          <MinusCircle className="size-3.5 text-ink-subtle" />
                        )}
                        {formatRelative(s.lastRunAt)}
                      </span>
                    ) : (
                      <span className="text-ink-subtle">never</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Recent runs */}
      <section>
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Recent eval runs
        </h2>
        {recent.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border bg-card p-6 text-sm text-ink-muted">
            No eval runs yet. Trigger one by calling{' '}
            <code className="rounded bg-background px-1.5 py-0.5">
              POST /api/eval/nightly
            </code>{' '}
            on the customer app with the EVAL_CRON_SECRET Bearer token, or wait for a sampled
            production run.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
            <table className="min-w-full text-sm">
              <thead className="bg-background/60 text-left text-xs uppercase tracking-wider text-ink-muted">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Agent</th>
                  <th className="px-4 py-3">Trigger</th>
                  <th className="px-4 py-3">Golden case</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Passed</th>
                  <th className="px-4 py-3">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-3 text-xs text-ink-muted">
                      {formatRelative(r.createdAt)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {r.agentSlug} <span className="text-ink-subtle">v{r.agentVersion}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">{r.trigger}</td>
                    <td className="px-4 py-3 text-xs">
                      {r.goldenCaseName ? (
                        <span className="text-ink">{truncate(r.goldenCaseName, 40)}</span>
                      ) : (
                        <span className="text-ink-subtle">—</span>
                      )}
                    </td>
                    <td className={`px-4 py-3 font-medium ${scoreTone(r.qualityScore)}`}>
                      {r.qualityScore ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      {r.passed === true ? (
                        <CheckCircle2 className="size-4 text-success" />
                      ) : r.passed === false ? (
                        <XCircle className="size-4 text-danger" />
                      ) : r.errorMessage ? (
                        <AlertTriangle className="size-4 text-warn" />
                      ) : (
                        <MinusCircle className="size-4 text-ink-subtle" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">
                      ₹{(r.costPaise / 100).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminShell>
  );
}

function Stat({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">{label}</div>
      <div className="mt-1 font-display text-2xl font-semibold text-ink">{value}</div>
      <div className="text-xs text-ink-muted">{detail}</div>
    </div>
  );
}

function overallPassRate(summary: { passRate7d: number | null; runs7d: number }[]): string {
  let totalRuns = 0;
  let weightedPass = 0;
  for (const s of summary) {
    if (s.passRate7d == null) continue;
    totalRuns += s.runs7d;
    weightedPass += s.passRate7d * s.runs7d;
  }
  if (totalRuns === 0) return '—';
  return `${Math.round(weightedPass / totalRuns)}%`;
}

function passRateTone(pct: number | null): string {
  if (pct == null) return 'text-ink-subtle';
  if (pct >= 90) return 'text-success';
  if (pct >= 70) return 'text-warn';
  return 'text-danger';
}

function scoreTone(score: number | null): string {
  if (score == null) return 'text-ink-subtle';
  if (score >= 80) return 'text-success';
  if (score >= 60) return 'text-warn';
  return 'text-danger';
}

function formatRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.round(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  return `${day}d ago`;
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
