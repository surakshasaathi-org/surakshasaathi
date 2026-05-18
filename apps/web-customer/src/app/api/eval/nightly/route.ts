import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { and, eq, desc } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import { runJudge } from '@/server/eval/judge';

/**
 * Nightly regression cron.
 *
 *   POST /api/eval/nightly   Authorization: Bearer <EVAL_CRON_SECRET>
 *
 * For every enabled golden case × every agent with a default rubric, re-runs
 * the judge against the most recent agent_run bound to that golden case (or
 * flags "no_recent_run" so ops knows a case isn't exercised).
 *
 * The actual golden-case *runs* (executing the agents against the case's
 * inputs) aren't triggered here — that belongs in a separate orchestrator
 * because it would cost materially more per night. This cron only scores
 * whatever the system has already produced.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AuthErr = 'eval_cron_secret_unset' | 'forbidden';

function assertAuthorised(req: NextRequest): AuthErr | null {
  const expected = process.env.EVAL_CRON_SECRET;
  if (!expected) return 'eval_cron_secret_unset';
  const header = req.headers.get('authorization') ?? '';
  const got = header.replace(/^Bearer\s+/i, '').trim();
  if (!got) return 'forbidden';
  // Constant-time compare — rejects timing-based secret recovery attempts.
  // timingSafeEqual requires equal-length buffers, so gate on length first.
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return 'forbidden';
  if (!timingSafeEqual(a, b)) return 'forbidden';
  return null;
}

export async function POST(req: NextRequest) {
  const authErr = assertAuthorised(req);
  if (authErr) {
    // 503 = server misconfigured; 403 = caller forbidden. Keeping them distinct
    // so ops alerts can page on 503 without triggering on attacker probes.
    const status = authErr === 'eval_cron_secret_unset' ? 503 : 403;
    return NextResponse.json({ error: authErr }, { status });
  }

  const db = serviceDb();
  const cases = await db
    .select()
    .from(schema.evalGoldenCase)
    .where(eq(schema.evalGoldenCase.enabled, true));

  const rubrics = await db
    .select()
    .from(schema.evalRubric)
    .where(and(eq(schema.evalRubric.enabled, true), eq(schema.evalRubric.isDefault, true)));

  if (cases.length === 0 || rubrics.length === 0) {
    return NextResponse.json({ skipped: 'no_enabled_cases_or_rubrics', cases: cases.length, rubrics: rubrics.length });
  }

  const results: Array<Record<string, unknown>> = [];

  for (const c of cases) {
    for (const r of rubrics) {
      // Find the most recent agent_run for this agent that referenced this
      // golden case. In practice the golden-case-run orchestrator will tag
      // agent_run.caseId with the golden_case_id.
      const [latestRun] = await db
        .select()
        .from(schema.agentRun)
        .where(and(eq(schema.agentRun.agentSlug, r.agentSlug), eq(schema.agentRun.caseId, c.id)))
        .orderBy(desc(schema.agentRun.startedAt))
        .limit(1);

      if (!latestRun) {
        results.push({ golden_case: c.name, agent: r.agentSlug, status: 'no_recent_run' });
        continue;
      }

      try {
        const out = await runJudge({
          agentRunId: latestRun.id,
          trigger: 'nightly_cron',
          goldenCaseId: c.id,
          ranBy: 'nightly_cron',
        });
        results.push({
          golden_case: c.name,
          agent: r.agentSlug,
          status: 'ok',
          quality_score: out.qualityScore,
          passed: out.passed,
          cost_paise: out.costPaise,
        });
      } catch (err) {
        results.push({
          golden_case: c.name,
          agent: r.agentSlug,
          status: 'failed',
          error: (err as Error).message,
        });
      }
    }
  }

  return NextResponse.json({ ran: results.length, results });
}
