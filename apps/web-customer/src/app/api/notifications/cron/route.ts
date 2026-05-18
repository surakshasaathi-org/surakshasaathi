import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { processPendingNotifications } from '@/server/notifications/queue';
import { enqueueRenewalReminders } from '@/server/notifications/renewal-reminders';

/**
 * Notifications cron.
 *
 *   POST /api/notifications/cron   Authorization: Bearer <NOTIFICATIONS_CRON_SECRET>
 *
 * Runs two steps:
 *   1. enqueueRenewalReminders() — scans policies + enqueues fresh reminders
 *      for the 14/7/1-day windows (dedupe keys make it safe to re-run).
 *   2. processPendingNotifications() — drains up to 100 pending rows.
 *
 * Intended trigger: a cron platform (Vercel Cron / Supabase pg_cron / external
 * scheduler) hits this every 15 minutes.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AuthErr = 'secret_unset' | 'forbidden';

function authorise(req: NextRequest): AuthErr | null {
  const expected = process.env.NOTIFICATIONS_CRON_SECRET;
  if (!expected) return 'secret_unset';
  const header = req.headers.get('authorization') ?? '';
  const got = header.replace(/^Bearer\s+/i, '').trim();
  if (!got) return 'forbidden';
  const a = Buffer.from(got);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return 'forbidden';
  if (!timingSafeEqual(a, b)) return 'forbidden';
  return null;
}

export async function POST(req: NextRequest) {
  const authErr = authorise(req);
  if (authErr) {
    const status = authErr === 'secret_unset' ? 503 : 403;
    return NextResponse.json({ error: authErr }, { status });
  }

  const reminderResult = await enqueueRenewalReminders();
  const processResult = await processPendingNotifications(100);

  return NextResponse.json({ ok: true, reminderResult, processResult });
}
