import type { AgentDefinition } from '@suraksha/types';

/**
 * In-process cache of the default agent_definition row per slug.
 * The admin-portal `agents.refresh` action publishes a cache-bust via a broadcast
 * channel (Supabase Realtime) — or, on Vercel, via a Redis pub/sub when we add it.
 *
 * Until then, cache TTL is 60 seconds and `getAgent` re-reads from DB on expiry.
 */
const cache = new Map<string, { def: AgentDefinition; fetchedAt: number }>();
const CACHE_TTL_MS = 60_000;

export async function getAgent(
  slug: string,
  fetchFromDb: (slug: string) => Promise<AgentDefinition | null>,
): Promise<AgentDefinition> {
  const cached = cache.get(slug);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.def;
  }
  const def = await fetchFromDb(slug);
  if (!def) {
    throw new Error(`agent not found: ${slug}`);
  }
  if (!def.enabled) {
    throw new Error(`agent disabled: ${slug}`);
  }
  cache.set(slug, { def, fetchedAt: Date.now() });
  return def;
}

export function invalidateAgentCache(slug?: string) {
  if (slug) cache.delete(slug);
  else cache.clear();
}
