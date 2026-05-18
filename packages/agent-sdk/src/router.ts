import type { ModelTier } from '@suraksha/types';

/**
 * Tiered model router for Google Gemini.
 *
 *   opus   → gemini-2.5-pro         (high-stakes classifiers, review agent)
 *   sonnet → gemini-2.5-flash       (drafters, extractors, translator)
 *   haiku  → gemini-2.0-flash-lite  (intake triage, routing, simple transforms)
 *
 * `ModelTier` enum stays provider-agnostic (opus/sonnet/haiku) so agent_definition
 * rows don't change when we swap providers. Override with GEMINI_MODEL_* env.
 */
export function modelFor(tier: ModelTier): string {
  return modelsFor(tier)[0]!;
}

/**
 * Ordered list of candidate models per tier. The first is the primary; the
 * rest are fallbacks the retry loop tries on sustained 503s from the primary.
 *
 * We keep fallbacks on the SAME tier-band (capability, not cost) — e.g. Sonnet
 * → Flash → Flash-2.0 → Flash-lite. Going up to Pro on a fallback would work
 * too but doubles cost silently; going down to Flash-lite risks JSON-mode
 * quirks on longer outputs.
 */
export function modelsFor(tier: ModelTier): string[] {
  const env = (k: string) => process.env[k]?.trim() || null;
  switch (tier) {
    case 'opus':
      // Production models on v1beta (Developer API). 1.5-pro is deprecated
      // on this endpoint, so the fallback stays within the 2.x family.
      return [
        env('GEMINI_MODEL_OPUS') ?? 'gemini-2.5-pro',
        env('GEMINI_MODEL_OPUS_FALLBACK') ?? 'gemini-2.5-flash',
      ];
    case 'sonnet':
      // 2.5-flash is primary but gets 503'd during peak. 2.0-flash is the
      // stable cousin (less traffic, different capacity pool). 2.5-flash-lite
      // is the tail — slightly lower quality but rarely congested. All three
      // support vision, JSON mode, and are available on the v1beta endpoint.
      return [
        env('GEMINI_MODEL_SONNET') ?? 'gemini-2.5-flash',
        env('GEMINI_MODEL_SONNET_FALLBACK_1') ?? 'gemini-2.0-flash',
        env('GEMINI_MODEL_SONNET_FALLBACK_2') ?? 'gemini-2.5-flash-lite',
      ];
    case 'haiku':
      return [
        env('GEMINI_MODEL_HAIKU') ?? 'gemini-2.0-flash-lite',
        env('GEMINI_MODEL_HAIKU_FALLBACK') ?? 'gemini-2.5-flash-lite',
      ];
  }
}

/**
 * Curated Gemini candidate list for the policy-digitizer. Best-in-class fast
 * vision model first (gemini-2.5-flash) with a stable cousin fallback, but
 * deliberately NO `gemini-2.5-flash-lite` step — that model mangles tabular
 * content (sub-limit grids, room-rent matrices) and table fidelity is the
 * single most important property of the digitizer's output. Override via
 * GEMINI_MODEL_DIGITIZER / GEMINI_MODEL_DIGITIZER_FALLBACK.
 */
export function digitizerModels(): string[] {
  const env = (k: string) => process.env[k]?.trim() || null;
  return [
    env('GEMINI_MODEL_DIGITIZER') ?? 'gemini-2.5-flash',
    env('GEMINI_MODEL_DIGITIZER_FALLBACK') ?? 'gemini-2.0-flash',
  ];
}

/**
 * Curated Anthropic candidate list for the policy-digitizer when running on
 * Claude. claude-sonnet-4-6 is the speed/intelligence sweet spot for vision
 * PDF transcription. Override via ANTHROPIC_MODEL_DIGITIZER /
 * ANTHROPIC_MODEL_DIGITIZER_FALLBACK.
 */
export function digitizerModelsAnthropic(): string[] {
  const env = (k: string) => process.env[k]?.trim() || null;
  return [env('ANTHROPIC_MODEL_DIGITIZER') ?? 'claude-sonnet-4-6'];
}
