import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { serviceDb } from '@suraksha/db';

export const dynamic = 'force-dynamic';

/**
 * 90-day purge of agent_run_step rows. Trace data carries redacted
 * prompt/completion blobs that are sensitive even after redaction; the
 * PRD pins retention to 90 days (matches DPDP session-log policy).
 *
 * Idempotent — running multiple times in a day is a no-op for already-
 * purged rows. Returns the count deleted for ops visibility.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const auth = req.headers.get('authorization') ?? '';
  const expected = process.env.EVAL_CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const db = serviceDb();
  const result = await db.execute(sql`
    DELETE FROM agent_run_step
     WHERE started_at < now() - interval '90 days'
  `);
  const count =
    (result as unknown as { count?: number }).count ??
    (result as unknown as { rowCount?: number }).rowCount ??
    0;
  return NextResponse.json({ ok: true, purged: count });
}
