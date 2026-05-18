import 'server-only';
import { and, desc, eq } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import { supabaseServer } from '@/lib/supabase-server';
import { isReportV2, type ExtractorOutput, type ReportV2 } from '@/server/analyse/report-v2-types';
import {
  buildConditionSummary,
  enrichExtractor,
  type ConditionSummary,
  type EnrichedExtractor,
} from './categorise';
import { getPolicyScore, type PolicyScore } from '@/server/scoring';

/**
 * Full per-policy detail view. Joins the canonical `policy` row with its
 * latest v2 analysis's extractor output so the /my/policies/[id] page has
 * both the owned-policy metadata AND the deep extractor facts (coverage
 * sections, exclusions, waiting periods, etc.) in one shot.
 *
 * Legacy v1 analyses don't carry an extractor object — those policies get
 * `extractor: null` and the detail page falls back to a "re-analyse to see
 * the fine print" nudge.
 */

export interface PolicyDetail {
  policy: {
    id: string;
    insurerName: string;
    policyNumber: string;
    planName: string | null;
    planType: string | null;
    sumAssuredPaise: number | null; // integer rupees (historical field name)
    premiumPaise: number | null;    // integer rupees (historical field name)
    startDate: string | null;
    endDate: string | null;
    nomineeName: string | null;
    networkHospitalCount: number | null;
    createdAt: string;
    updatedAt: string;
  };
  latestAnalysis: {
    id: string;
    status: string;
    createdAt: string;
  } | null;
  /** Raw extractor output from the latest v2 analysis (kept for back-compat). */
  extractor: ExtractorOutput | null;
  /** Extractor enriched with heuristic category tags — this is what the UI consumes. */
  enriched: EnrichedExtractor | null;
  /** Cross-cut "By condition" summary stitched from waits + caps + copays. */
  conditionSummary: ConditionSummary[];
  /** Total analyses run against this policy (for the "see history" link). */
  analysisCount: number;
  /** Readiness score for the latest analysis. Null when not yet computed or
   *  when the viewer isn't authorised to see internal scores (decision #7 —
   *  calibration-month gate). The server-side admin check decides visibility
   *  before this field is populated. */
  score: PolicyScore | null;
  /** Minimal scoring profile for the current viewer — UI uses this to know
   *  whether to prompt for city tier. */
  scoringProfile: { cityTier: 'metro' | 'tier_2' | 'tier_3' | null };
}

export async function getPolicyDetail(policyId: string): Promise<PolicyDetail | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;
  const userId = data.user.id;

  const db = serviceDb();
  const [policy] = await db
    .select()
    .from(schema.policy)
    .where(and(eq(schema.policy.id, policyId), eq(schema.policy.userId, userId)))
    .limit(1);
  if (!policy) return null;

  const analyses = await db
    .select({
      id: schema.policyAnalysis.id,
      status: schema.policyAnalysis.status,
      reportJson: schema.policyAnalysis.reportJson,
      createdAt: schema.policyAnalysis.createdAt,
    })
    .from(schema.policyAnalysis)
    .where(eq(schema.policyAnalysis.policyId, policyId))
    .orderBy(desc(schema.policyAnalysis.createdAt));

  const latest = analyses[0] ?? null;
  let extractor: ExtractorOutput | null = null;
  if (latest?.reportJson && isReportV2(latest.reportJson)) {
    extractor = (latest.reportJson as ReportV2).extractor;
  }
  // Enrich for the UI: fills in missing `category` / `applies_to` tags
  // via heuristics. Forward-compat with agent-tagged categories.
  const enriched = extractor ? enrichExtractor(extractor) : null;
  const conditionSummary = enriched ? buildConditionSummary(enriched) : [];

  // Readiness score — shown to the policy owner whenever a score exists.
  // (Calibration-month admin gating was removed once the scorer was deemed
  // stable enough for end-users. `is_internal` still exists as a kill-switch
  // and is honoured; admin tooling can flip rows back if needed.)
  let score: PolicyScore | null = null;
  if (latest) {
    score = await getPolicyScore(latest.id);
  }

  // Minimal scoring profile for the UI (e.g. to decide whether to prompt).
  const [userRow] = await db
    .select({ profile: schema.appUser.scoringProfileJson })
    .from(schema.appUser)
    .where(eq(schema.appUser.id, userId))
    .limit(1);
  const scoringProfile = {
    cityTier: (userRow?.profile?.cityTier ?? null) as 'metro' | 'tier_2' | 'tier_3' | null,
  };

  const meta = (policy.metadata as Record<string, unknown>) ?? {};
  return {
    policy: {
      id: policy.id,
      insurerName: policy.insurerName,
      policyNumber: policy.policyNumber,
      planName: (meta.plan_name as string) ?? null,
      planType: (meta.plan_type as string) ?? null,
      sumAssuredPaise: policy.sumAssured,
      premiumPaise: policy.premium,
      startDate: policy.startDate,
      endDate: policy.endDate,
      nomineeName: policy.nomineeName,
      networkHospitalCount: (meta.network_hospital_count as number) ?? null,
      createdAt: policy.createdAt.toISOString(),
      updatedAt: policy.updatedAt.toISOString(),
    },
    latestAnalysis: latest
      ? {
          id: latest.id,
          status: latest.status,
          createdAt: latest.createdAt.toISOString(),
        }
      : null,
    extractor,
    enriched,
    conditionSummary,
    analysisCount: analyses.length,
    score,
    scoringProfile,
  };
}

