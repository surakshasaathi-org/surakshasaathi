import { NextResponse } from 'next/server';
import { resetDailySpend } from '@suraksha/eval-lab/runtime';

export const dynamic = 'force-dynamic';

/**
 * Daily reset of eval_sampling_policy.spend_today_paise. Runs at IST
 * midnight. Triggered by Supabase pg_cron (or any scheduler that can
 * POST). Bearer-token gated via EVAL_CRON_SECRET so only the scheduler
 * can hit this — the admin UI doesn't need it.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const auth = req.headers.get('authorization') ?? '';
  const expected = process.env.EVAL_CRON_SECRET;
  if (!expected || auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const result = await resetDailySpend();
  return NextResponse.json({ ok: true, resetCount: result.resetCount });
}
