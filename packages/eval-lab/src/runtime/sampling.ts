import 'server-only';
import { sql } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';

/**
 * DB-backed prod sampling policy reader. Replaces the env-var-driven
 * fallback in apps/web-customer/src/server/eval/prod-sampling.ts.
 *
 *   * `eval_sampling_policy` row per agent_slug controls sampling rate +
 *     daily-cost cap. The admin UI edits these rows via /evals/sampling.
 *   * Reads are cached in-process for SAMPLING_CACHE_TTL_MS so we don't
 *     round-trip Postgres on every prod agent_run.
 *   * The "should we sample now?" decision is split from "we did sample"
 *     because we want to (a) decide cheaply, then (b) atomically charge
 *     the cap so concurrent requests don't all decide yes once we've hit
 *     the budget. shouldSample() = decide; chargeSampleCost() = atomic
 *     conditional UPDATE; rollbackSampleReservation() if the eval fails.
 *
 *  Scalability: the policy table is keyed on agent_slug — adding a new
 *  product line / agent only requires inserting a row, no code change.
 */

export interface SamplingPolicy {
  agentSlug: string;
  ratePct: number;             // 0..100
  dailyCapPaise: number;
  spendTodayPaise: number;
  spendDayKey: string;         // 'YYYY-MM-DD' (IST)
  enabled: boolean;
}

const SAMPLING_CACHE_TTL_MS = 60_000;
interface CacheEntry {
  policy: SamplingPolicy | null;
  fetchedAt: number;
}
const G = globalThis as unknown as { __ss_sampling_cache?: Map<string, CacheEntry> };
G.__ss_sampling_cache ??= new Map();
const cache = G.__ss_sampling_cache;

/**
 * IST date key, 'YYYY-MM-DD'. Daily-reset cron flips spend_day_key forward
 * at IST midnight; this is the same key the policy row uses.
 */
function istDateKey(now: Date = new Date()): string {
  // IST = UTC+5:30. Build the key from the IST clock so a sample taken at
  // 23:30 UTC (05:00 IST next day) attributes correctly.
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000);
  return ist.toISOString().slice(0, 10);
}

export async function loadPolicy(agentSlug: string): Promise<SamplingPolicy | null> {
  const cached = cache.get(agentSlug);
  if (cached && Date.now() - cached.fetchedAt < SAMPLING_CACHE_TTL_MS) {
    return cached.policy;
  }
  const db = serviceDb();
  const [row] = await db
    .select()
    .from(schema.evalSamplingPolicy)
    .where(sql`${schema.evalSamplingPolicy.agentSlug} = ${agentSlug}`)
    .limit(1);
  const policy: SamplingPolicy | null = row
    ? {
        agentSlug: row.agentSlug,
        ratePct: Number(row.ratePct),
        dailyCapPaise: row.dailyCapPaise,
        spendTodayPaise: row.spendTodayPaise,
        spendDayKey: typeof row.spendDayKey === 'string'
          ? row.spendDayKey
          : new Date(row.spendDayKey as unknown as Date).toISOString().slice(0, 10),
        enabled: row.enabled,
      }
    : null;
  cache.set(agentSlug, { policy, fetchedAt: Date.now() });
  return policy;
}

/** Force-evict the cache for an agent. Called by the admin sampling UI's
 *  save action so a rate change takes effect on the next prod request,
 *  not 60s later. */
export function invalidateSamplingCache(agentSlug?: string): void {
  if (agentSlug) cache.delete(agentSlug);
  else cache.clear();
}

/**
 * Decide whether to fire a sample for THIS prod agent_run. Cheap path: a
 * single in-process random draw + cache read. Returns false when the
 * policy is missing/disabled, the rate gate fails, or today's cap is
 * already exhausted (without touching the DB).
 */
export async function shouldSample(agentSlug: string): Promise<boolean> {
  const policy = await loadPolicy(agentSlug);
  if (!policy || !policy.enabled || policy.ratePct <= 0) return false;
  if (policy.spendDayKey === istDateKey() && policy.spendTodayPaise >= policy.dailyCapPaise) {
    return false;
  }
  return Math.random() * 100 < policy.ratePct;
}

/**
 * Atomically charge the budget. Used right before kicking off a judge run
 * so concurrent samples don't all proceed past an exhausted cap. The
 * UPDATE WHERE clause double-checks today's spend hasn't already hit
 * daily_cap_paise; if it has, the row count is 0 and we skip the eval.
 *
 * Also rotates spend_day_key when this is the first charge of a new IST
 * day (the daily-reset cron does the same; this is a belt-and-braces
 * fallback when the cron is late).
 */
export async function chargeSampleCost(
  agentSlug: string,
  estimatedCostPaise: number,
): Promise<{ charged: boolean; spendNow: number }> {
  const today = istDateKey();
  const db = serviceDb();
  // Rotate day if needed.
  await db.execute(sql`
    UPDATE eval_sampling_policy
       SET spend_today_paise = 0,
           spend_day_key = ${today}::date
     WHERE agent_slug = ${agentSlug}
       AND spend_day_key <> ${today}::date
  `);
  // Conditional charge — only succeeds if the new total stays at or below
  // the cap. RETURNING gives us the post-charge spend for telemetry.
  const result = await db.execute<{ spend_today_paise: number }>(sql`
    UPDATE eval_sampling_policy
       SET spend_today_paise = spend_today_paise + ${estimatedCostPaise}
     WHERE agent_slug = ${agentSlug}
       AND enabled = true
       AND spend_today_paise + ${estimatedCostPaise} <= daily_cap_paise
     RETURNING spend_today_paise
  `);
  // pg returns rows; postgres-js returns array directly — handle both.
  const rows = Array.isArray(result) ? result : (result as unknown as { rows?: Array<{ spend_today_paise: number }> }).rows ?? [];
  invalidateSamplingCache(agentSlug);
  if (rows.length === 0) {
    return { charged: false, spendNow: 0 };
  }
  return { charged: true, spendNow: rows[0]!.spend_today_paise };
}

/**
 * Refund a previously-charged sample. Called when the judge run failed
 * before producing an eval_run row, so the cap accounts for actual cost,
 * not estimated. Best-effort; never throws into the caller.
 */
export async function rollbackSampleReservation(
  agentSlug: string,
  estimatedCostPaise: number,
): Promise<void> {
  const db = serviceDb();
  try {
    await db.execute(sql`
      UPDATE eval_sampling_policy
         SET spend_today_paise = GREATEST(spend_today_paise - ${estimatedCostPaise}, 0)
       WHERE agent_slug = ${agentSlug}
    `);
    invalidateSamplingCache(agentSlug);
  } catch (err) {
    console.warn(
      `[eval-lab/sampling] rollback failed agent=${agentSlug} amount=${estimatedCostPaise} err=${(err as Error).message.slice(0, 200)}`,
    );
  }
}

/**
 * Reset spend_today_paise across every agent at IST midnight. Called by
 * the daily-reset cron endpoint. Idempotent — running twice on the same
 * day is a no-op for rows that already match today's key.
 */
export async function resetDailySpend(): Promise<{ resetCount: number }> {
  const today = istDateKey();
  const db = serviceDb();
  const result = await db.execute(sql`
    UPDATE eval_sampling_policy
       SET spend_today_paise = 0,
           spend_day_key = ${today}::date
     WHERE spend_day_key <> ${today}::date
  `);
  invalidateSamplingCache();
  // postgres-js: result.count; node-pg: result.rowCount.
  const count =
    (result as unknown as { count?: number }).count ??
    (result as unknown as { rowCount?: number }).rowCount ??
    0;
  return { resetCount: count };
}
