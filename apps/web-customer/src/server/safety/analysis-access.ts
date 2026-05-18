import 'server-only';
import { timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { supabaseServer } from '@/lib/supabase-server';
import { getAnalysisStore } from '@/server/analyse/store';

/**
 * Unified access-control for per-analysis resources (chat, feedback, retry).
 *
 * Access is granted if ANY of these holds:
 *   1. Signed-in user and `analysis.user_id === auth.user.id`
 *   2. An HttpOnly cookie `ss_token_<analysisId>` whose value constant-time
 *      equals `analysis.session_token` (the upload-time secret)
 *
 * The legacy `ss_analyses` cookie — a plaintext list of analysis IDs — is
 * *insufficient* on its own. It's still useful for UI affordances like "claim
 * on sign-in", but it never grants read/write access.
 */

export type AnalysisAccess =
  | { ok: true; rec: Awaited<ReturnType<ReturnType<typeof getAnalysisStore>['get']>> & object }
  | { ok: false; code: 'not_found' | 'forbidden' | 'expired'; message: string };

export const ANALYSIS_TOKEN_COOKIE_PREFIX = 'ss_token_';

export async function assertAnalysisAccess(analysisId: string): Promise<AnalysisAccess> {
  const store = getAnalysisStore();
  const rec = await store.get(analysisId);
  if (!rec) {
    // Fuzz the response: non-existent + forbidden look identical to callers
    // that haven't been issued a token. This prevents UUID probing from
    // confirming existence — they get 'not_found' either way.
    //
    // We peek at the raw row to distinguish *expired* from *never-existed* —
    // expired rows get a specific 410 so the UI can prompt re-upload rather
    // than falsely claiming the analysis never existed.
    const expired = await store.getExpired(analysisId);
    if (expired) return { ok: false, code: 'expired', message: 'Analysis expired' };
    return { ok: false, code: 'not_found', message: 'Analysis not found' };
  }

  // Path 1: signed-in owner
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (data.user && rec.userId && rec.userId === data.user.id) {
    return { ok: true, rec };
  }

  // Path 2: per-analysis session token cookie
  const cookieStore = await cookies();
  const presented = cookieStore.get(ANALYSIS_TOKEN_COOKIE_PREFIX + analysisId)?.value ?? '';
  if (presented && constantTimeEqual(presented, rec.sessionToken)) {
    return { ok: true, rec };
  }

  return { ok: false, code: 'not_found', message: 'Analysis not found' };
}

/**
 * Issued once at upload time; subsequent chat/feedback requests present it.
 * HttpOnly so JS can't read it, SameSite=lax so links from email work.
 */
export async function issueAnalysisTokenCookie(analysisId: string, sessionToken: string) {
  const cookieStore = await cookies();
  cookieStore.set({
    name: ANALYSIS_TOKEN_COOKIE_PREFIX + analysisId,
    value: sessionToken,
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60, // matches analysis 7-day TTL
  });
}

function constantTimeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return timingSafeEqual(ab, bb);
}
