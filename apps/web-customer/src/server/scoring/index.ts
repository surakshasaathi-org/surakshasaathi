import 'server-only';
import { eq } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import type { EnrichedExtractor } from '@/server/policies/categorise';
import { computePolicyScoreLLM } from './llm';
import { writePolicyScore } from './writeScore';
import type { UserScoringProfile } from './types';

export { writePolicyScore, getPolicyScore } from './writeScore';
export type {
  PolicyScore,
  ScoreComponent,
  Band,
  CityTier,
  Severity,
  UserScoringProfile,
  CanonicalSectionSlug,
} from './types';
export { CANONICAL_SECTION_ORDER } from './types';

/**
 * End-to-end: load the user's profile → invoke the policy-scorer agent →
 * persist the structured JSON. The scoring rubric (sections, weights, band
 * thresholds, OOP penalties, insurer-CSR map) is fully prompt-driven and
 * admin-editable at /agents/policy-scorer.
 *
 * Caller invokes best-effort: failures don't block the rest of the analysis
 * pipeline; the analysis row simply lacks a score until a manual rescore.
 */
export async function computeAndStoreScore(args: {
  tenantId: string;
  analysisId: string;
  userId: string | null;
  extractor: EnrichedExtractor;
}): Promise<void> {
  const { tenantId, analysisId, userId, extractor } = args;

  const profile = await loadUserProfile(userId);

  const score = await computePolicyScoreLLM({
    tenantId,
    extractor,
    profile,
    analysisId,
  });

  await writePolicyScore({ tenantId, analysisId, userId, score });
}

async function loadUserProfile(userId: string | null): Promise<UserScoringProfile> {
  if (!userId) return { cityTier: null };
  const db = serviceDb();
  const [row] = await db
    .select({ profile: schema.appUser.scoringProfileJson })
    .from(schema.appUser)
    .where(eq(schema.appUser.id, userId))
    .limit(1);
  const cityTier = row?.profile?.cityTier ?? null;
  return { cityTier: cityTier ?? null };
}
