import 'server-only';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import { supabaseServer } from '@/lib/supabase-server';
import { isReportV2 } from '@/server/analyse/report-v2-types';
import type { ExtractorOutput } from '@/server/analyse/report-v2-types';

/**
 * Compare two policies side-by-side. Pulls each policy + its latest v2-shape
 * analysis and returns a pre-computed delta structure the UI can render as a
 * table of differences (A / B / delta).
 */

export interface ComparedPolicy {
  policyId: string;
  insurerName: string;
  planName: string | null;
  policyNumber: string;
  sumAssuredPaise: number | null;
  premiumPaise: number | null;
  startDate: string | null;
  endDate: string | null;
  nomineeName: string | null;
  latestAnalysisId: string | null;
  extractor: ExtractorOutput | null;
}

export interface PolicyDiff {
  a: ComparedPolicy;
  b: ComparedPolicy;
  delta: {
    premiumPaise: number | null;
    premiumPercent: number | null;
    sumAssuredPaise: number | null;
    exclusionOnlyInA: string[];
    exclusionOnlyInB: string[];
    waitingPeriodDifferences: Array<{
      condition: string;
      daysA: number | null;
      daysB: number | null;
    }>;
    coverageOnlyInA: string[];
    coverageOnlyInB: string[];
  };
}

export async function compareTwoPolicies(
  policyIdA: string,
  policyIdB: string,
): Promise<PolicyDiff | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const userId = data.user.id;

  const db = serviceDb();
  const policies = await db
    .select()
    .from(schema.policy)
    .where(
      and(inArray(schema.policy.id, [policyIdA, policyIdB]), eq(schema.policy.userId, userId)),
    );
  if (policies.length !== 2) return null;

  // Fetch each policy's latest analysis.
  const analyses = await db
    .select()
    .from(schema.policyAnalysis)
    .where(
      and(
        inArray(schema.policyAnalysis.policyId, [policyIdA, policyIdB]),
        eq(schema.policyAnalysis.userId, userId),
      ),
    )
    .orderBy(desc(schema.policyAnalysis.createdAt));

  const latestByPolicy = new Map<string, (typeof analyses)[number]>();
  for (const a of analyses) {
    if (a.policyId && !latestByPolicy.has(a.policyId)) latestByPolicy.set(a.policyId, a);
  }

  const byId = new Map(policies.map((p) => [p.id, p]));
  const pa = byId.get(policyIdA);
  const pb = byId.get(policyIdB);
  if (!pa || !pb) return null;

  const a = toComparedPolicy(pa, latestByPolicy.get(pa.id) ?? null);
  const b = toComparedPolicy(pb, latestByPolicy.get(pb.id) ?? null);

  const delta = computeDelta(a, b);
  return { a, b, delta };
}

function toComparedPolicy(
  row: typeof schema.policy.$inferSelect,
  analysis: typeof schema.policyAnalysis.$inferSelect | null,
): ComparedPolicy {
  const meta = (row.metadata as Record<string, unknown>) ?? {};
  let extractor: ExtractorOutput | null = null;
  if (analysis && analysis.reportJson && isReportV2(analysis.reportJson)) {
    extractor = (analysis.reportJson as { extractor: ExtractorOutput }).extractor;
  }
  return {
    policyId: row.id,
    insurerName: row.insurerName,
    planName: (meta.plan_name as string) ?? null,
    policyNumber: row.policyNumber,
    sumAssuredPaise: row.sumAssured,
    premiumPaise: row.premium,
    startDate: row.startDate,
    endDate: row.endDate,
    nomineeName: row.nomineeName,
    latestAnalysisId: analysis?.id ?? null,
    extractor,
  };
}

function computeDelta(a: ComparedPolicy, b: ComparedPolicy): PolicyDiff['delta'] {
  const premiumPaise =
    a.premiumPaise != null && b.premiumPaise != null ? b.premiumPaise - a.premiumPaise : null;
  const premiumPercent =
    a.premiumPaise && b.premiumPaise && a.premiumPaise > 0
      ? Math.round(((b.premiumPaise - a.premiumPaise) / a.premiumPaise) * 100)
      : null;
  const sumAssuredPaise =
    a.sumAssuredPaise != null && b.sumAssuredPaise != null
      ? b.sumAssuredPaise - a.sumAssuredPaise
      : null;

  // Exclusion + coverage diffs. Normalise by lowercased clause text — policies
  // often say the same thing with slightly different casing.
  const exclusionsA = setOf(a.extractor?.exclusions?.map((e) => e.text) ?? []);
  const exclusionsB = setOf(b.extractor?.exclusions?.map((e) => e.text) ?? []);
  const coverageA = setOf(a.extractor?.coverage_sections?.map((c) => c.name) ?? []);
  const coverageB = setOf(b.extractor?.coverage_sections?.map((c) => c.name) ?? []);

  // Waiting-period differences — match by condition (lower).
  const waitingA = new Map(
    (a.extractor?.waiting_periods ?? []).map((w) => [w.condition.trim().toLowerCase(), w.wait_days]),
  );
  const waitingB = new Map(
    (b.extractor?.waiting_periods ?? []).map((w) => [w.condition.trim().toLowerCase(), w.wait_days]),
  );
  const allConditions = new Set([...waitingA.keys(), ...waitingB.keys()]);
  const waitingPeriodDifferences: PolicyDiff['delta']['waitingPeriodDifferences'] = [];
  for (const cond of allConditions) {
    const da = waitingA.get(cond) ?? null;
    const db2 = waitingB.get(cond) ?? null;
    if (da !== db2) {
      waitingPeriodDifferences.push({ condition: cond, daysA: da, daysB: db2 });
    }
  }

  return {
    premiumPaise,
    premiumPercent,
    sumAssuredPaise,
    exclusionOnlyInA: Array.from(exclusionsA).filter((x) => !exclusionsB.has(x)).slice(0, 8),
    exclusionOnlyInB: Array.from(exclusionsB).filter((x) => !exclusionsA.has(x)).slice(0, 8),
    waitingPeriodDifferences: waitingPeriodDifferences.slice(0, 12),
    coverageOnlyInA: Array.from(coverageA).filter((x) => !coverageB.has(x)).slice(0, 8),
    coverageOnlyInB: Array.from(coverageB).filter((x) => !coverageA.has(x)).slice(0, 8),
  };
}

function setOf(list: string[]): Set<string> {
  return new Set(list.map((s) => s.trim().toLowerCase()).filter(Boolean));
}
