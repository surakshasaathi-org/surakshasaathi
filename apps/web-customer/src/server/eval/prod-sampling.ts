import 'server-only';
import { runJudge } from './judge';
import {
  shouldSample as dbShouldSample,
  chargeSampleCost,
  rollbackSampleReservation,
  loadPolicy,
} from '@suraksha/eval-lab/runtime';

/**
 * Sample a fraction of production agent_runs for nightly-quality visibility.
 * Called in a fire-and-forget manner after a real user-triggered agent run
 * completes; never blocks the user's response.
 *
 * Migrated to DB-backed `eval_sampling_policy` on 2026-04-25. Per-agent
 * rate + daily cap are admin-editable from /evals/sampling. Env vars
 * remain as a fallback for agents with no DB row.
 */

const FALLBACK_RATES: Record<string, number> = {
  'policy-extractor': 0.02,
  'policy-coverage': 0.02,
  'customer-explainer': 0.05,
};

const FALLBACK_ESTIMATE_PAISE = 200;

function envRate(agentSlug: string): number | null {
  const envKey = `PROD_SAMPLE_RATE_${agentSlug.toUpperCase().replace(/-/g, '_')}`;
  const override = process.env[envKey];
  if (!override) return null;
  const n = Number(override);
  if (Number.isNaN(n) || n < 0 || n > 1) return null;
  return n;
}

// Lightweight in-process counters for ops visibility. Survives HMR via globalThis
// so dev reloads don't reset them. In prod this won't aggregate across server
// instances — swap to Sentry / OTEL metrics for a real fleet.
interface SampleCounters {
  sampled: number;
  failed: number;
  lastFailureAt: number;
  lastFailureMsg: string | null;
  capDeclined: number;
}
const G = globalThis as unknown as { __ss_eval_counters?: SampleCounters };
if (!G.__ss_eval_counters) {
  G.__ss_eval_counters = {
    sampled: 0,
    failed: 0,
    lastFailureAt: 0,
    lastFailureMsg: null,
    capDeclined: 0,
  };
}

export function getEvalSamplerCounters(): Readonly<SampleCounters> {
  return { ...(G.__ss_eval_counters as SampleCounters) };
}

export function maybeSampleForEval(agentRunId: string, agentSlug: string): void {
  const counters = G.__ss_eval_counters as SampleCounters;

  // Async path — but the caller (makePersistRun) treats this as fire-and-
  // forget, so wrapping in an IIFE is fine. Errors surface via the counter
  // and console.warn, never into the customer-facing request.
  void (async () => {
    try {
      // 1. Decide whether to sample using the DB policy. When the row is
      //    missing for this agent, fall back to env-var rate (legacy path).
      const policy = await loadPolicy(agentSlug);
      let shouldFire: boolean;
      if (policy) {
        shouldFire = await dbShouldSample(agentSlug);
      } else {
        const rate = envRate(agentSlug) ?? FALLBACK_RATES[agentSlug] ?? 0;
        shouldFire = rate > 0 && Math.random() < rate;
      }
      if (!shouldFire) return;

      // 2. Atomically charge the daily cap (DB path only — fallback skips
      //    cap checks because there's no row to track spend on).
      const estimate = FALLBACK_ESTIMATE_PAISE;
      if (policy) {
        const result = await chargeSampleCost(agentSlug, estimate);
        if (!result.charged) {
          counters.capDeclined += 1;
          return;
        }
      }

      counters.sampled += 1;

      // 3. Fire the judge. On failure, refund the cap reservation so a
      //    flaky judge doesn't slowly drain today's budget.
      try {
        await runJudge({ agentRunId, trigger: 'prod_sample', ranBy: 'prod_sampler' });
      } catch (err) {
        if (policy) await rollbackSampleReservation(agentSlug, estimate);
        throw err;
      }
    } catch (err) {
      const msg = (err as Error).message;
      counters.failed += 1;
      counters.lastFailureAt = Date.now();
      counters.lastFailureMsg = msg.slice(0, 240);
      console.warn(
        `[eval/prod-sample] judge failed agentRunId=${agentRunId} agent=${agentSlug} err=${msg} counters=${JSON.stringify(counters)}`,
      );
    }
  })();
}
