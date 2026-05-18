import 'server-only';
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import { supabaseServer } from '@/lib/supabase-server';
import { isReportV2, type ReportV2 } from '@/server/analyse/report-v2-types';

/**
 * Dashboard data aggregation. Everything fetched in one pass so /my doesn't
 * N+1 when a user has many policies. Tuned for the common case of 1–5
 * policies, 10–20 analyses.
 */

export interface DashboardData {
  healthScore: {
    value: number; // 0–100
    tone: 'success' | 'warn' | 'danger' | 'neutral';
    components: {
      coverageBreadth: number;
      hasNominee: boolean;
      renewalRunway: number;
      recentAnalysis: boolean;
      familyLogged: boolean;
    };
    narrative: string;
  } | null;
  renewals: Array<{
    policyId: string;
    insurerName: string;
    planName: string | null;
    daysUntilRenewal: number;
    endDate: string;
  }>;
  topGaps: Array<{
    analysisId: string;
    policyId: string | null;
    insurerName: string | null;
    title: string;
    severity: 'high' | 'medium' | 'low';
    action: string;
  }>;
  counts: {
    policies: number;
    analyses: number;
    familyMembers: number;
    activeCases: number;
    eligibleSchemes: number;
  };
  recentActivity: Array<{
    kind: string;
    subject: string;
    detail: string | null;
    occurredAt: string;
  }>;
}

export async function loadDashboard(): Promise<DashboardData | null> {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const userId = auth.user.id;
  const db = serviceDb();

  const [policies, latestAnalyses, family, schemes, activity] = await Promise.all([
    db.select().from(schema.policy).where(eq(schema.policy.userId, userId)),
    db
      .select()
      .from(schema.policyAnalysis)
      .where(
        and(
          eq(schema.policyAnalysis.userId, userId),
          eq(schema.policyAnalysis.status, 'ready'),
          isNotNull(schema.policyAnalysis.reportJson),
        ),
      )
      .orderBy(desc(schema.policyAnalysis.createdAt))
      .limit(20),
    db.select().from(schema.familyMember).where(eq(schema.familyMember.userId, userId)),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.userScheme)
      .where(
        and(
          eq(schema.userScheme.userId, userId),
          eq(schema.userScheme.matchStatus, 'eligible'),
        ),
      ),
    // db.execute() with raw SQL returns timestamp columns as ISO *strings* —
    // not Date objects the typed .select() path returns. Declare that shape
    // so we don't trip over .toISOString() on a string below.
    db.execute<{ kind: string; subject: string; detail: string | null; occurred_at: string | Date }>(sql`
      select kind, subject, detail, occurred_at
      from v_user_activity
      where user_id = ${userId}
      order by occurred_at desc
      limit 8
    `),
  ]);

  // Active cases — the `case` table is reserved in postgres so we need to
  // quote it. Skip if the user has no cases (most do right now).
  const activeCases = await db.execute<{ count: string }>(sql`
    select count(*)::int as count
    from "case"
    where user_id = ${userId}
      and status not in (
        'resolved_in_favour',
        'resolved_against',
        'withdrawn',
        'abandoned'
      )
  `);

  const renewals = policies
    .filter((p) => p.endDate)
    .map((p) => ({
      policyId: p.id,
      insurerName: p.insurerName,
      planName: (p.metadata as Record<string, unknown>)?.plan_name as string | null,
      endDate: p.endDate!,
      daysUntilRenewal: daysBetween(p.endDate!),
    }))
    .filter((r) => r.daysUntilRenewal >= -30) // hide renewals >30 days in the past
    .sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal)
    .slice(0, 4);

  const topGaps = extractTopGaps(latestAnalyses);
  const healthScore = computeHealthScore({
    policies,
    latestAnalyses,
    familyCount: family.length,
    renewals,
  });

  const recentActivity = (activity as Array<{ kind: string; subject: string; detail: string | null; occurred_at: string | Date }>).map(
    (row) => ({
      kind: row.kind,
      subject: row.subject,
      detail: row.detail,
      occurredAt: toIso(row.occurred_at),
    }),
  );

  return {
    healthScore,
    renewals,
    topGaps,
    counts: {
      policies: policies.length,
      analyses: latestAnalyses.length,
      familyMembers: family.length,
      activeCases: Number((activeCases as Array<{ count: number | string }>)[0]?.count ?? 0),
      eligibleSchemes: Number(schemes[0]?.count ?? 0),
    },
    recentActivity,
  };
}

/* ────────── Derivations ────────── */

function daysBetween(iso: string): number {
  const d = new Date(iso);
  return Math.ceil((d.getTime() - Date.now()) / (24 * 3600 * 1000));
}

/**
 * Cross-policy gap extraction: looks at the latest 3 analyses' red_flags and
 * returns the 5 most severe. Falls back gracefully for legacy v1 reports.
 */
function extractTopGaps(
  analyses: (typeof schema.policyAnalysis.$inferSelect)[],
): DashboardData['topGaps'] {
  const gaps: DashboardData['topGaps'] = [];
  for (const a of analyses.slice(0, 3)) {
    const report = a.reportJson as unknown;
    if (!report) continue;

    if (isReportV2(report)) {
      const r = report as ReportV2;
      const insurer = r.extractor.basic_facts.insurer_name;
      for (const flag of r.coverage?.red_flags ?? []) {
        gaps.push({
          analysisId: a.id,
          policyId: a.policyId ?? null,
          insurerName: insurer,
          title: flag.title,
          severity: flag.severity,
          action: flag.action,
        });
      }
    } else {
      // v1 shape
      const v1 = report as {
        basic_facts?: { insurer_name?: string };
        red_flags?: Array<{ title: string; severity: 'high' | 'medium' | 'low'; action?: string }>;
      };
      for (const flag of v1.red_flags ?? []) {
        gaps.push({
          analysisId: a.id,
          policyId: a.policyId ?? null,
          insurerName: v1.basic_facts?.insurer_name ?? null,
          title: flag.title,
          severity: flag.severity,
          action: flag.action ?? 'Review this clause carefully.',
        });
      }
    }
  }
  const severityRank = { high: 0, medium: 1, low: 2 };
  gaps.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
  return gaps.slice(0, 5);
}

/**
 * Derived "Policy Health Score" — intentionally lightweight + explainable.
 * We don't claim it's a regulated metric; it's a signal to guide the user's
 * attention toward concrete fixes.
 *
 * Components (each 0-1, weighted):
 *   - coverageBreadth  (0.30) : has at least one active policy → 1.0
 *   - hasNominee       (0.15) : at least one linked policy with nominee_name
 *   - renewalRunway    (0.25) : min days-until-renewal across policies; <14d → 0, ≥90d → 1
 *   - recentAnalysis   (0.15) : any ready analysis in last 90 days
 *   - familyLogged     (0.15) : family has ≥ 2 members (primary + 1 other)
 */
function computeHealthScore(args: {
  policies: (typeof schema.policy.$inferSelect)[];
  latestAnalyses: (typeof schema.policyAnalysis.$inferSelect)[];
  familyCount: number;
  renewals: DashboardData['renewals'];
}): DashboardData['healthScore'] {
  if (args.policies.length === 0 && args.latestAnalyses.length === 0) return null;

  const coverageBreadth = args.policies.length > 0 ? 1 : 0;
  const hasNominee = args.policies.some((p) => !!p.nomineeName);
  const nomineeComponent = hasNominee ? 1 : 0;
  const minDays = args.renewals.length > 0
    ? Math.min(...args.renewals.map((r) => r.daysUntilRenewal))
    : 365;
  const renewalRunway = Math.max(0, Math.min(1, (minDays - 14) / (90 - 14)));
  const last90 = Date.now() - 90 * 24 * 3600 * 1000;
  const recentAnalysis = args.latestAnalyses.some((a) => a.createdAt.getTime() >= last90) ? 1 : 0;
  const familyLogged = args.familyCount >= 2 ? 1 : args.familyCount >= 1 ? 0.5 : 0;

  const value = Math.round(
    100 *
      (0.30 * coverageBreadth +
        0.15 * nomineeComponent +
        0.25 * renewalRunway +
        0.15 * recentAnalysis +
        0.15 * familyLogged),
  );
  const tone: 'success' | 'warn' | 'danger' | 'neutral' =
    value >= 80 ? 'success' : value >= 60 ? 'warn' : value >= 30 ? 'neutral' : 'danger';

  const weak: string[] = [];
  if (!hasNominee) weak.push('none of your policies has a nominee — add one');
  if (minDays < 45 && args.renewals.length > 0) weak.push('a renewal is close, review coverage before paying');
  if (recentAnalysis === 0) weak.push('no recent analysis — re-analyse if anything changed');
  if (familyLogged < 1) weak.push('add at least one family member for accurate coverage cards');

  const narrative =
    weak.length === 0
      ? 'Your protection posture looks solid — keep analysing new policies as they renew.'
      : 'Quick wins: ' + weak.slice(0, 3).join('; ') + '.';

  return {
    value,
    tone,
    components: {
      coverageBreadth,
      hasNominee,
      renewalRunway: Math.round(renewalRunway * 100),
      recentAnalysis: recentAnalysis === 1,
      familyLogged: familyLogged >= 1,
    },
    narrative,
  };
}

/**
 * Normalise the occurred_at column to an ISO string regardless of which
 * drizzle path fetched it. `.select()` gives us Date; `.execute()` with raw
 * SQL gives us the Postgres text representation.
 */
function toIso(v: string | Date): string {
  if (v instanceof Date) return v.toISOString();
  // Postgres emits "YYYY-MM-DD HH:MM:SS.sssZ"-ish; new Date() handles that.
  const parsed = new Date(v);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return String(v);
}
