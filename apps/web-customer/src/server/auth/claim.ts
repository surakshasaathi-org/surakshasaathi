import 'server-only';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * Link a list of anonymous analyses to the currently-signed-in user.
 * Only unclaimed (user_id IS NULL) rows are touched — this is idempotent.
 *
 * Returns how many rows were actually claimed.
 */
export async function claimRecentAnalyses(analysisIds: string[]): Promise<number> {
  if (analysisIds.length === 0) return 0;

  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return 0;

  const db = serviceDb();
  const rows = await db
    .update(schema.policyAnalysis)
    .set({ userId: user.id })
    .where(
      and(
        inArray(schema.policyAnalysis.id, analysisIds),
        isNull(schema.policyAnalysis.userId),
      ),
    )
    .returning({ id: schema.policyAnalysis.id });

  return rows.length;
}

export async function listMyAnalyses(
  userId: string,
  opts: { policyId?: string | null; archivedSinceDays?: number } = {},
) {
  const db = serviceDb();
  const whereClauses = [eq(schema.policyAnalysis.userId, userId)];
  if (opts.policyId) {
    whereClauses.push(eq(schema.policyAnalysis.policyId, opts.policyId));
  }
  const rows = await db
    .select()
    .from(schema.policyAnalysis)
    .where(and(...whereClauses))
    .orderBy(schema.policyAnalysis.createdAt);
  const sorted = rows.reverse(); // newest first

  // Soft-archive cutoff: analyses older than N days are hidden by default. A
  // UI toggle re-runs this function with archivedSinceDays=Infinity to see
  // everything. Keeps the default view tight for long-time users.
  if (opts.archivedSinceDays !== undefined && Number.isFinite(opts.archivedSinceDays)) {
    const cutoff = Date.now() - opts.archivedSinceDays * 24 * 3600 * 1000;
    return sorted.filter((r) => r.createdAt.getTime() >= cutoff);
  }
  return sorted;
}
