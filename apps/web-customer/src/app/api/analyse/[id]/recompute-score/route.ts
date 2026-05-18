import { NextResponse } from 'next/server';
import { getAnalysisStore } from '@/server/analyse/store';
import { isReportV2 } from '@/server/analyse/report-v2-types';
import { computeAndStoreScore, getPolicyScore } from '@/server/scoring';
import { enrichExtractor } from '@/server/policies/categorise';

export const dynamic = 'force-dynamic';

/**
 * Re-run the policy-scorer for an existing analysis.
 *
 * The scorer is otherwise triggered only as a fire-and-forget background
 * task at the end of the analyse pipeline. When that task fails (parse
 * error, transient LLM 5xx, dev-server restart mid-run), the analysis ends
 * up with no policy_score row and the customer Score tab shows the empty
 * state. This endpoint lets the customer (or admin) trigger a fresh
 * scorer run on demand.
 *
 * Idempotent — writePolicyScore deletes any prior row for the analysis
 * before inserting, so calling twice produces one final row.
 */
export async function POST(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const store = getAnalysisStore();
  const rec = await store.get(id);
  if (!rec) {
    return NextResponse.json({ error: 'analysis_not_found' }, { status: 404 });
  }
  if (rec.status !== 'ready' || !rec.report) {
    return NextResponse.json({ error: 'analysis_not_ready' }, { status: 409 });
  }
  if (!isReportV2(rec.report) || !rec.report.extractor) {
    return NextResponse.json({ error: 'incompatible_report_shape' }, { status: 409 });
  }

  try {
    await computeAndStoreScore({
      tenantId: rec.tenantId,
      analysisId: rec.id,
      userId: rec.userId,
      extractor: enrichExtractor(rec.report.extractor),
    });
  } catch (err) {
    // Surface a stable error code so the client can render the right
    // message; never leak the raw provider error to the customer.
    const msg = (err as Error).message;
    const isUpstream = /503|service unavailable|overloaded|high demand|fetch failed|ETIMEDOUT/i.test(msg);
    return NextResponse.json(
      {
        error: isUpstream ? 'upstream_unavailable' : 'scorer_failed',
        debug: msg.slice(0, 240),
      },
      { status: isUpstream ? 503 : 500 },
    );
  }

  const score = await getPolicyScore(id);
  if (!score) {
    return NextResponse.json(
      { error: 'score_not_persisted', detail: 'Scorer ran but policy_score row was not written.' },
      { status: 500 },
    );
  }
  return NextResponse.json({ ok: true, score });
}
