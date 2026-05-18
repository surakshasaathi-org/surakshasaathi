import { NextResponse, type NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import { supabaseServer } from '@/lib/supabase-server';
import { assertAnalysisAccess } from '@/server/safety/analysis-access';

/**
 * Thumbs / notes on AI outputs.
 *
 *   POST /api/feedback
 *   {
 *     target: 'analysis_overall' | 'coverage_card' | 'red_flag' | 'chat_message' | 'report_section',
 *     target_ref?: string,
 *     analysis_id?: string,     // required for analysis-scoped targets
 *     chat_message_id?: string, // required for 'chat_message'
 *     rating: -1 | 0 | 1,
 *     note?: string,            // ≤ 500 chars
 *   }
 *
 * Ownership: the caller must either be signed in as the analysis's user or
 * present the ss_token cookie. Anonymous spray is rejected.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_TARGETS = new Set([
  'analysis_overall',
  'coverage_card',
  'red_flag',
  'chat_message',
  'report_section',
]);

const ANALYSIS_SCOPED_TARGETS = new Set([
  'analysis_overall',
  'coverage_card',
  'red_flag',
  'report_section',
]);

interface FeedbackBody {
  target?: string;
  target_ref?: string;
  analysis_id?: string;
  chat_message_id?: string;
  rating?: number;
  note?: string;
}

export async function POST(req: NextRequest) {
  let body: FeedbackBody;
  try {
    body = (await req.json()) as FeedbackBody;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const target = body.target ?? '';
  const rating = body.rating ?? 0;

  if (!VALID_TARGETS.has(target)) {
    return NextResponse.json({ error: 'invalid_target' }, { status: 400 });
  }
  if (![-1, 0, 1].includes(rating)) {
    return NextResponse.json({ error: 'invalid_rating' }, { status: 400 });
  }
  if (body.note && body.note.length > 500) {
    return NextResponse.json({ error: 'note_too_long' }, { status: 400 });
  }

  // Ownership gating.
  let analysisId = body.analysis_id ?? null;
  let resolvedUserId: string | null = null;

  if (target === 'chat_message') {
    if (!body.chat_message_id) {
      return NextResponse.json({ error: 'chat_message_id_required' }, { status: 400 });
    }
    // Resolve the chat message back to its analysis so we can authorise.
    const db = serviceDb();
    const [row] = await db
      .select({ analysisId: schema.chatMessage.analysisId })
      .from(schema.chatMessage)
      .where(eq(schema.chatMessage.id, body.chat_message_id))
      .limit(1);
    if (!row) return NextResponse.json({ error: 'chat_message_not_found' }, { status: 404 });
    analysisId = row.analysisId;
  }

  if (ANALYSIS_SCOPED_TARGETS.has(target) || target === 'chat_message') {
    if (!analysisId) {
      return NextResponse.json({ error: 'analysis_id_required' }, { status: 400 });
    }
    const access = await assertAnalysisAccess(analysisId);
    if (!access.ok) {
      const status = access.code === 'not_found' ? 404 : 403;
      return NextResponse.json({ error: access.message }, { status });
    }
    resolvedUserId = access.rec.userId;
  } else {
    // Catch-all for future unscoped targets (none today, but keeps the
    // switch explicit rather than falling through to insert).
    return NextResponse.json({ error: 'invalid_target_scope' }, { status: 400 });
  }

  // Re-pull auth to capture the writer's user_id (may differ from the owner
  // if an admin is leaving feedback on someone's analysis; that's fine).
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  const writerUserId = auth.user?.id ?? resolvedUserId ?? null;

  const db = serviceDb();
  const [row] = await db
    .insert(schema.userFeedback)
    .values({
      id: randomUUID(),
      tenantId: 'surakshasaathi',
      analysisId,
      chatMessageId: body.chat_message_id ?? null,
      userId: writerUserId,
      sessionToken: null, // intentionally not persisted — gating already enforced above
      target,
      targetRef: body.target_ref ?? null,
      rating,
      note: body.note ?? null,
    })
    .returning({ id: schema.userFeedback.id });

  return NextResponse.json({ ok: true, id: row!.id });
}
