import 'server-only';
import { invokeAgent } from '@suraksha/agent-sdk';
import { loadAgentDefinition, makePersistRun } from '@/server/analyse/agent-runs';
import type { EnrichedExtractor } from '@/server/policies/categorise';
import { CANONICAL_SECTION_ORDER } from './types';
import type { Band, PolicyScore, ScoreComponent, Severity, UserScoringProfile } from './types';

/**
 * Calls the `policy-scorer` agent with profile + extractor. The full scoring
 * rubric (8 sections, weights, band thresholds, OOP penalties) lives in the
 * agent's system prompt — admin-edited at /agents/policy-scorer.
 * Rubric was reduced from 12 → 8 sections on 2026-05-07; see prompt header
 * for rationale.
 *
 * Throws on failure (network, parse, schema mismatch). Caller in
 * computeAndStoreScore swallows the throw so a scoring failure doesn't block
 * the rest of the analysis pipeline; the analysis row just lacks a score.
 */
export async function computePolicyScoreLLM(args: {
  extractor: EnrichedExtractor;
  profile: UserScoringProfile;
  tenantId: string;
  /** policy_analysis.id when scoring is invoked from the analyse pipeline.
   *  Threaded into agent_run.analysis_id so the scorer call shows up in the
   *  admin trace alongside intake / extractor / coverage. */
  analysisId?: string | null;
}): Promise<PolicyScore> {
  const def = await loadAgentDefinition('policy-scorer');
  if (!def.enabled) throw new Error('policy-scorer agent is disabled');

  const userMessage = JSON.stringify(
    { profile: args.profile, extractor: args.extractor },
    null,
    0,
  );

  const result = await invokeAgent({
    def,
    invocation: {
      agentId: '' as never,
      tenantId: args.tenantId as never,
      userId: null,
      caseId: null,
      analysisId: args.analysisId ?? null,
      parentRunId: null,
      userMessage,
      attachments: [],
      locale: 'en',
      extraContext: { agent_version: def.version },
    },
    persist: makePersistRun(),
    inlineAttachments: [],
    provider: (def as { provider?: 'gemini' | 'anthropic' | null }).provider ?? undefined,
    modelCandidatesOverride: (def as { modelOverride?: string | null }).modelOverride
      ? [(def as { modelOverride?: string | null }).modelOverride!]
      : undefined,
  });

  const parsed = parseScore(result.outputJson);
  if (!parsed) {
    const preview =
      typeof result.outputJson === 'object' && result.outputJson !== null
        ? JSON.stringify(result.outputJson).slice(0, 300)
        : String(result.outputJson).slice(0, 300);
    throw new Error(`policy-scorer returned non-conforming JSON. Preview: ${preview}`);
  }
  return parsed;
}

const BANDS: ReadonlySet<Band> = new Set(['claim_ready', 'mostly_covered', 'gaps_to_close', 'high_risk']);
const SEVS: ReadonlySet<Severity> = new Set(['info', 'low', 'medium', 'high', 'critical']);

/**
 * Expected section roster — must match the prompt's section table. Reduced
 * from 12 → 8 on 2026-05-07: deductible_mismatch, network_hospitals,
 * renewal_portability, insurer_trust are no longer scored. If the prompt
 * evolves, update this list (and the reverse).
 */
const EXPECTED_SECTIONS = [
  'sum_insured',
  'room_rent_icu',
  'copay',
  'sub_limits',
  'exclusions',
  'boosters',
  'waits',
  'additional_benefits',
];

function parseScore(raw: unknown): PolicyScore | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const o = raw as Record<string, unknown>;

  const totalScore = num(o.totalScore);
  const denominator = num(o.denominator);
  const outOfPocketPct = num(o.outOfPocketPct);
  const gapCount = int(o.gapCount);
  const band = typeof o.band === 'string' && BANDS.has(o.band as Band) ? (o.band as Band) : null;
  const components = Array.isArray(o.components) ? o.components : null;
  const rulesSlug = typeof o.rulesSlug === 'string' ? o.rulesSlug : null;
  const rulesVersion = int(o.rulesVersion);

  if (
    totalScore === null ||
    denominator === null ||
    outOfPocketPct === null ||
    gapCount === null ||
    band === null ||
    components === null ||
    rulesSlug === null ||
    rulesVersion === null
  ) {
    return null;
  }

  const got = new Set<string>();
  const parsedComponents: ScoreComponent[] = [];
  for (const c of components) {
    if (typeof c !== 'object' || c === null) return null;
    const co = c as Record<string, unknown>;
    const slug = typeof co.sectionSlug === 'string' ? co.sectionSlug : null;
    const label = typeof co.sectionLabel === 'string' ? co.sectionLabel : null;
    const weight = num(co.weight);
    const reason = typeof co.reason === 'string' ? co.reason : '';
    const isMissing = co.missing === true;
    // When `missing=true`, the scorer's prompt allows achieved/severity to
    // be null because the section doesn't contribute to total/denominator.
    // The parser used to hard-reject null achieved, dropping the entire
    // PolicyScore — root cause for analyses with no policy_score row when
    // any extractor field couldn't be scored. Now: allow null achieved
    // only when missing=true, default to 0 + severity:info for storage.
    const rawAchieved = num(co.achieved);
    const achieved = rawAchieved === null && isMissing ? 0 : rawAchieved;
    const sev =
      typeof co.severity === 'string' && SEVS.has(co.severity as Severity)
        ? (co.severity as Severity)
        : 'info';
    if (slug === null || label === null || weight === null || achieved === null) return null;
    parsedComponents.push({
      sectionSlug: slug,
      sectionLabel: label,
      weight,
      achieved,
      reason,
      // Positives + negatives are best-effort: the scorer prompt asks for
      // arrays of short bullets; legacy outputs (pre-2026-05-07) lack them.
      // Sanitize to string[] of trimmed non-empty strings, capped at 4 to
      // prevent runaway prompts from blowing up the UI.
      positives: stringArray(co.positives, 4),
      negatives: stringArray(co.negatives, 4),
      severity: sev,
      missing: isMissing ? true : undefined,
    });
    got.add(slug);
  }
  for (const s of EXPECTED_SECTIONS) {
    if (!got.has(s)) return null;
  }

  // Sort components by the canonical rubric order (sum_insured → ... →
  // additional_benefits). The UI renders the Score-tab breakdown in this
  // order so it lines up 1:1 with the prompt's weights table. Unknown
  // slugs (e.g. legacy 12-section rows still in DB) trail at the end.
  const orderIndex: Record<string, number> = {};
  CANONICAL_SECTION_ORDER.forEach((s, i) => {
    orderIndex[s] = i;
  });
  const orderedComponents = parsedComponents.slice().sort((a, b) => {
    const ai = orderIndex[a.sectionSlug] ?? 999;
    const bi = orderIndex[b.sectionSlug] ?? 999;
    if (ai !== bi) return ai - bi;
    return a.sectionSlug.localeCompare(b.sectionSlug);
  });

  return {
    totalScore: Math.round(totalScore),
    denominator: Math.round(denominator),
    band,
    outOfPocketPct: Math.max(0, Math.min(100, outOfPocketPct)),
    gapCount,
    components: orderedComponents,
    rulesSlug,
    rulesVersion,
  };
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function int(v: unknown): number | null {
  const n = num(v);
  return n === null ? null : Math.round(n);
}

/**
 * Defensive parser for the optional positives / negatives arrays produced
 * by the scorer. Returns undefined when input is not an array (so the type
 * stays optional + legacy rows aren't given misleading empty arrays);
 * filters non-strings; trims; drops empties; caps at `max` entries.
 */
function stringArray(v: unknown, max: number): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== 'string') continue;
    const t = x.trim();
    if (t.length === 0) continue;
    out.push(t);
    if (out.length >= max) break;
  }
  return out.length > 0 ? out : undefined;
}
