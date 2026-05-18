import { NextResponse } from 'next/server';
import { desc, eq } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import { runAnalysisPipeline } from '@/server/analyse/pipeline';

/**
 * Admin-only re-run trigger. Resets the analysis row's report state, then
 * fires the pipeline against the same uploaded document. Used by the admin
 * portal to test prompt iterations against a known input.
 *
 * Auth: shared bearer token (`ADMIN_INTERNAL_TOKEN`, defaults to the Supabase
 *       service-role key in dev). NOT a customer-facing endpoint.
 *
 * Query params:
 *   force_digitize=1  Also clear policy_document.extracted.digitizedText so
 *                     the digitizer agent runs again on the next pass. Use
 *                     when iterating on the digitizer's own prompt; leave
 *                     unset to skip the cached digitization (cheaper, faster).
 */

interface ExtractedColumnShape extends Record<string, unknown> {
  filename?: string;
  digitizedText?: string;
  digitizedTotalPages?: number;
  digitizedCharCount?: number;
  digitizedQualityFlags?: string[];
  digitizedAt?: string;
  digitizerRunId?: string;
}

function expectedToken(): string | null {
  return (
    process.env.ADMIN_INTERNAL_TOKEN?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    null
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const expected = expectedToken();
  if (!expected) {
    return NextResponse.json(
      { ok: false, error: 'admin_token_not_configured' },
      { status: 500 },
    );
  }
  const got = request.headers.get('x-admin-token')?.trim();
  if (!got || got !== expected) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const forceDigitize = url.searchParams.get('force_digitize') === '1';

  const db = serviceDb();
  // Accept full UUIDs OR the 8-char prefix used in the admin list view.
  let row: typeof schema.policyAnalysis.$inferSelect | undefined;
  if (id.length >= 32) {
    const rows = await db
      .select()
      .from(schema.policyAnalysis)
      .where(eq(schema.policyAnalysis.id, id))
      .limit(1);
    row = rows[0];
  } else {
    const recent = await db
      .select()
      .from(schema.policyAnalysis)
      .orderBy(desc(schema.policyAnalysis.createdAt))
      .limit(200);
    row = recent.find((r) => r.id.startsWith(id));
  }
  if (!row) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  const fullId = row.id;

  // Reset the analysis state. Keep documentId / sessionToken / userId / locale
  // / demographics — the upload + identity is unchanged. Status starts at
  // 'queued' and the pipeline transitions through digitizing → intake →
  // extracting → analysing → ready as it runs.
  await db
    .update(schema.policyAnalysis)
    .set({
      status: 'queued',
      progressStep: 'Re-run requested by admin — restarting…',
      reportJson: null,
      readinessScore: null,
      redFlagsCount: null,
      confidenceOverall: null,
      agentRunIds: [],
      costPaise: 0,
      errorCode: null,
      errorMessage: null,
      startedAt: null,
      readyAt: null,
    })
    .where(eq(schema.policyAnalysis.id, fullId));

  // Optionally bust the digitizer cache. The digitizer is verbatim
  // transcription — its prompt rarely changes — so by default we keep the
  // cached text and only re-run the downstream agents (intake, extractor,
  // coverage, scorer). Pass ?force_digitize=1 to also re-run the vision pass.
  if (forceDigitize) {
    const [doc] = await db
      .select({ extracted: schema.policyDocument.extracted })
      .from(schema.policyDocument)
      .where(eq(schema.policyDocument.id, row.documentId))
      .limit(1);
    if (doc) {
      const prev = (doc.extracted as ExtractedColumnShape | null) ?? {};
      const next: ExtractedColumnShape = { ...prev };
      delete next.digitizedText;
      delete next.digitizedTotalPages;
      delete next.digitizedCharCount;
      delete next.digitizedQualityFlags;
      delete next.digitizedAt;
      delete next.digitizerRunId;
      await db
        .update(schema.policyDocument)
        .set({ extracted: next })
        .where(eq(schema.policyDocument.id, row.documentId));
    }
  }

  // Fire-and-forget — pipeline writes its own status updates. We return
  // immediately so the admin button doesn't block waiting for ~60-120s.
  void runAnalysisPipeline(fullId).catch((err) => {
    console.error(`[admin-rerun] pipeline failed for ${fullId}:`, err);
  });

  return NextResponse.json({ ok: true, analysisId: fullId, forceDigitize });
}
