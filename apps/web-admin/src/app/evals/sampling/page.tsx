import Link from 'next/link';
import { ArrowLeft, FlaskConical } from 'lucide-react';
import { sql } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import { AdminShell } from '@/components/admin-shell';
import { requireAdminSession } from '@/lib/auth';
import { SamplingPolicyEditor } from '@/components/eval-sampling-editor';

/**
 * /evals/sampling — admin surface for the DB-backed prod sampling policy.
 * One row per agent_slug controls:
 *   - rate_pct       — % of prod agent_runs that fire a judge eval
 *   - daily_cap_paise — hard ceiling on judge spend per agent per IST day
 *
 * Editing here updates eval_sampling_policy; the in-process cache is
 * invalidated by the writer so changes take effect on the next prod
 * request, not 60s later.
 */
export default async function AdminEvalSamplingPage() {
  const session = await requireAdminSession(['super_admin', 'admin']);
  const db = serviceDb();

  // Pull every agent_slug we know about (from the rubric table — that's the
  // canonical "agents we have evals for" list) plus any existing sampling
  // policy rows. The right-join lets new agents appear with no policy row
  // yet so the admin can dial them in for the first time.
  const rows = await db.execute<{
    agent_slug: string;
    rate_pct: string | null;
    daily_cap_paise: number | null;
    spend_today_paise: number | null;
    spend_day_key: Date | null;
    enabled: boolean | null;
    updated_at: Date | null;
  }>(sql`
    SELECT
      r.agent_slug,
      p.rate_pct,
      p.daily_cap_paise,
      p.spend_today_paise,
      p.spend_day_key,
      p.enabled,
      p.updated_at
    FROM (
      SELECT DISTINCT agent_slug FROM eval_rubric WHERE enabled = true
    ) r
    LEFT JOIN eval_sampling_policy p ON p.agent_slug = r.agent_slug
    ORDER BY r.agent_slug
  `);
  // Drizzle's `execute` returns either an array (postgres-js) or a
  // QueryResult (node-pg) depending on the driver. Normalise.
  const list = (Array.isArray(rows) ? rows : (rows as { rows?: unknown[] }).rows ?? []) as Array<{
    agent_slug: string;
    rate_pct: string | null;
    daily_cap_paise: number | null;
    spend_today_paise: number | null;
    spend_day_key: Date | null;
    enabled: boolean | null;
    updated_at: Date | null;
  }>;

  const policies = list.map((r) => ({
    agentSlug: r.agent_slug,
    ratePct: r.rate_pct === null ? 0 : Number(r.rate_pct),
    dailyCapPaise: r.daily_cap_paise ?? 50_000,
    spendTodayPaise: r.spend_today_paise ?? 0,
    spendDayKey: r.spend_day_key ? new Date(r.spend_day_key).toISOString().slice(0, 10) : null,
    enabled: r.enabled ?? true,
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : null,
    hasRow: r.rate_pct !== null,
  }));

  return (
    <AdminShell role={session.role} email={session.email}>
      <header className="mb-8">
        <Link
          href="/evals"
          className="mb-2 inline-flex items-center gap-1.5 text-xs text-ink-muted hover:text-ink"
        >
          <ArrowLeft className="size-3.5" /> Back to Evals
        </Link>
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <FlaskConical className="size-3.5" />
          Sampling
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          Prod sampling policy
        </h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          One row per agent. Sampler fires a judge run on this percentage of live customer
          agent_runs, up to the daily cost cap. Resets at IST midnight.
        </p>
      </header>

      <SamplingPolicyEditor policies={policies} />
    </AdminShell>
  );
}
