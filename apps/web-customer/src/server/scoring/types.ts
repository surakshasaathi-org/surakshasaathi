/** How the overall readiness score should read to a human. */
export type Band = 'claim_ready' | 'mostly_covered' | 'gaps_to_close' | 'high_risk';

/** Discrete city buckets used for sum-insured adequacy + zone-copay scoring. */
export type CityTier = 'metro' | 'tier_2' | 'tier_3';

/** Severity of a single score component, used to drive the risk list. */
export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';

/**
 * Single input to the scorer — everything except the extractor itself.
 * The scoring module is pure over these three inputs.
 */
export interface UserScoringProfile {
  cityTier: CityTier | null;           // null → scorer defaults to 'metro'
}

/**
 * One scored section. Produced by the policy-scorer agent; consumed by both
 * the UI (drill-down) and the risk list (sorted by weight-achieved desc,
 * filtered to severity >= medium).
 *
 * `missing=true` takes the component OUT of the denominator (skip-and-rescale).
 * Used when the extractor doesn't carry the data the section needs.
 */
export interface ScoreComponent {
  sectionSlug: string;
  sectionLabel: string;
  weight: number;
  achieved: number;
  reason: string;
  /** Bullets of what the policy gets right in THIS section. Both
   *  `positives` and `negatives` may be populated for the same section —
   *  even a high-scoring row can carry a small caveat, and a low-scoring
   *  row can still acknowledge what's working. (2026-05-07.) */
  positives?: string[];
  /** Bullets of what's working against the policy in THIS section. */
  negatives?: string[];
  severity: Severity;
  action?: { label: string; href?: string };
  missing?: boolean;
}

/**
 * Canonical section order — must match the policy-scorer system prompt's
 * weights table (rows 1 → 8). The scorer is required to emit components
 * in this order; the parser re-sorts to enforce it; the UI renders the
 * Score-tab breakdown in this order. Single source of truth so the prompt,
 * parser, and UI never drift. (Resolved 2026-05-07: alphabetical sort was
 * masking which row of the rubric each component refers to.)
 */
export const CANONICAL_SECTION_ORDER = [
  'sum_insured',
  'room_rent_icu',
  'copay',
  'sub_limits',
  'exclusions',
  'boosters',
  'waits',
  'additional_benefits',
] as const;
export type CanonicalSectionSlug = (typeof CANONICAL_SECTION_ORDER)[number];

/** Final shape the pipeline persists + the UI renders. */
export interface PolicyScore {
  totalScore: number;                  // integer sum of `achieved` across non-missing components
  denominator: number;                 // sum of `weight` across non-missing components (≤100)
  band: Band;
  outOfPocketPct: number;              // estimated % on a typical ₹5L claim in the user's city
  gapCount: number;                    // count of components with severity >= medium
  components: ScoreComponent[];        // full breakdown, sorted by CANONICAL_SECTION_ORDER
  rulesSlug: string;
  rulesVersion: number;
}

