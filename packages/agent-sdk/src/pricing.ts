import type { ModelTier } from '@suraksha/types';

/**
 * Per-million-token pricing in USD, converted to paise at a conservative FX rate.
 * These values MUST be kept in sync with Anthropic's published pricing — update when rates change.
 *
 * We store cost in paise (integer) on every agent_run so unit economics and rupee math
 * don't suffer from floating-point drift.
 *
 * As of 2026 (subject to change — update via admin portal):
 *   opus:   $15 input / $75 output / $1.50 cached input per 1M tokens
 *   sonnet: $3  input / $15 output / $0.30 cached input per 1M tokens
 *   haiku:  $0.80 input / $4 output / $0.08 cached input per 1M tokens
 *
 * INR conversion: 1 USD = 86 INR = 8,600 paise (conservative, update via env).
 */

const USD_TO_PAISE = Number(process.env.USD_TO_PAISE ?? '8600');

type PricePerMillion = { input: number; output: number; cached: number };

const PRICING: Record<ModelTier, PricePerMillion> = {
  opus: { input: 15, output: 75, cached: 1.5 },
  sonnet: { input: 3, output: 15, cached: 0.3 },
  haiku: { input: 0.8, output: 4, cached: 0.08 },
};

export function costPaiseFor(
  tier: ModelTier,
  tokens: { prompt: number; completion: number; cached: number },
): number {
  const p = PRICING[tier];
  const uncachedInput = Math.max(0, tokens.prompt - tokens.cached);
  const usd =
    (uncachedInput / 1_000_000) * p.input +
    (tokens.cached / 1_000_000) * p.cached +
    (tokens.completion / 1_000_000) * p.output;
  return Math.round(usd * USD_TO_PAISE);
}
