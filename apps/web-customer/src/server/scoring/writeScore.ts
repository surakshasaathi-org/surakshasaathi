import 'server-only';
import { and, eq } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import type { PolicyScore } from './types';
import { CANONICAL_SECTION_ORDER } from './types';

/**
 * Idempotent upsert of a PolicyScore. Keyed on (analysisId, rulesSlug,
 * rulesVersion) — re-running the scorer against the same analysis with the
 * same rules version is a no-op; a rules-version bump creates a new row and
 * supersedes the prior one via the unique index on analysis_id (we DELETE
 * the prior rows for this analysis before insert to keep exactly one row
 * per analysis).
 */
export async function writePolicyScore(args: {
  tenantId: string;
  analysisId: string;
  userId: string | null;
  score: PolicyScore;
}): Promise<void> {
  const { tenantId, analysisId, userId, score } = args;
  const db = serviceDb();

  await db.transaction(async (tx) => {
    // Remove any prior score row for this analysis — keeps the unique
    // `policy_score_analysis_idx` clean while letting us re-score with new rules.
    await tx.delete(schema.policyScore).where(eq(schema.policyScore.analysisId, analysisId));

    await tx.insert(schema.policyScore).values({
      tenantId,
      analysisId,
      userId,
      rulesSlug: score.rulesSlug,
      rulesVersion: score.rulesVersion,
      totalScore: score.totalScore,
      denominator: score.denominator,
      band: score.band,
      outOfPocketPct: score.outOfPocketPct.toFixed(1),
      gapCount: score.gapCount,
      components: score.components,
      isInternal: false,                // user-visible by default; admin can flip via rollout toggle
    });
  });
}

/**
 * Convenience: fetch the current policy score for an analysis (if any).
 * Returns null when no score exists or the analysis hasn't been scored yet.
 */
export async function getPolicyScore(analysisId: string): Promise<PolicyScore | null> {
  const db = serviceDb();
  const [row] = await db
    .select()
    .from(schema.policyScore)
    .where(eq(schema.policyScore.analysisId, analysisId))
    .limit(1);
  if (!row) return null;

  // Defensive canonical sort on READ — older policy_score rows were written
  // before parseScore enforced canonical order, so they may be alphabetical
  // on disk. Sorting here means every UI consumer sees the rubric's 1 → 8
  // sequence regardless of when the row was persisted. (2026-05-07.)
  const orderIndex: Record<string, number> = {};
  CANONICAL_SECTION_ORDER.forEach((s, i) => {
    orderIndex[s] = i;
  });
  const components = (row.components as PolicyScore['components']).slice().sort((a, b) => {
    const ai = orderIndex[a.sectionSlug] ?? 999;
    const bi = orderIndex[b.sectionSlug] ?? 999;
    if (ai !== bi) return ai - bi;
    return a.sectionSlug.localeCompare(b.sectionSlug);
  });

  return {
    totalScore: row.totalScore,
    denominator: row.denominator,
    band: row.band as PolicyScore['band'],
    outOfPocketPct: Number(row.outOfPocketPct),
    gapCount: row.gapCount,
    components,
    rulesSlug: row.rulesSlug,
    rulesVersion: row.rulesVersion,
  };
}
