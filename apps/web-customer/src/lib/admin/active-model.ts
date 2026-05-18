/**
 * Mirrors agent-sdk's modelTier → models mapping for admin UI display only.
 * Returns the model id that the runtime would actually use when invoking the
 * agent — modelOverride if set, otherwise the first candidate from the
 * provider's tier list. Used to replace the abstract "tier" label with the
 * concrete model id in admin tables.
 *
 * Keep aligned with packages/agent-sdk/src/router.ts. Drift only causes a
 * stale-looking label; runtime routing is unaffected.
 */

export interface ResolveArgs {
  provider: 'gemini' | 'anthropic' | null;
  modelTier: 'opus' | 'sonnet' | 'haiku';
  modelOverride: string | null;
}

const GEMINI_BY_TIER: Record<'opus' | 'sonnet' | 'haiku', string> = {
  opus: 'gemini-2.5-pro',
  sonnet: 'gemini-2.5-flash',
  haiku: 'gemini-2.0-flash-lite',
};

const ANTHROPIC_BY_TIER: Record<'opus' | 'sonnet' | 'haiku', string> = {
  opus: 'claude-opus-4-7',
  sonnet: 'claude-sonnet-4-6',
  haiku: 'claude-haiku-4-5',
};

export function resolveActiveModel({ provider, modelTier, modelOverride }: ResolveArgs): string {
  if (modelOverride && modelOverride.trim().length > 0) return modelOverride.trim();
  if (provider === 'anthropic') return ANTHROPIC_BY_TIER[modelTier];
  return GEMINI_BY_TIER[modelTier];
}
