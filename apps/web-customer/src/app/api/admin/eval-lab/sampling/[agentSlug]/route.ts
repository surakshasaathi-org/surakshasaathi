import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { serviceDb } from '@suraksha/db';
import { invalidateSamplingCache } from '@suraksha/eval-lab/runtime';
import { requireAdminSession } from '@/lib/admin/auth';

export const dynamic = 'force-dynamic';

/**
 * Update or upsert the prod sampling policy for one agent_slug. Admin
 * tier only. Re-validates input bounds (rate 0-100, cap ≥ 0). Invalidates
 * the in-process cache on success so the new rate takes effect on the
 * next prod request.
 */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ agentSlug: string }> },
): Promise<NextResponse> {
  const session = await requireAdminSession(['super_admin', 'admin']);
  if (session.role !== 'super_admin' && session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { agentSlug } = await ctx.params;
  if (!/^[a-z0-9-]+$/i.test(agentSlug) || agentSlug.length > 64) {
    return NextResponse.json({ error: 'invalid_slug' }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as
    | { ratePct?: number; dailyCapPaise?: number; enabled?: boolean }
    | null;
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const ratePct = Number(body.ratePct);
  const dailyCapPaise = Math.round(Number(body.dailyCapPaise));
  const enabled = body.enabled === true;
  if (!Number.isFinite(ratePct) || ratePct < 0 || ratePct > 100) {
    return NextResponse.json({ error: 'invalid_rate' }, { status: 400 });
  }
  if (!Number.isFinite(dailyCapPaise) || dailyCapPaise < 0) {
    return NextResponse.json({ error: 'invalid_cap' }, { status: 400 });
  }

  const db = serviceDb();
  // ON CONFLICT upsert keyed on agent_slug — both new policies and edits
  // land via the same path. spend_today_paise is preserved on edit so
  // tweaking the rate mid-day doesn't reset the day's running tally.
  await db.execute(sql`
    INSERT INTO eval_sampling_policy
      (agent_slug, rate_pct, daily_cap_paise, spend_today_paise, spend_day_key, enabled, updated_by, updated_at)
    VALUES
      (${agentSlug}, ${ratePct}, ${dailyCapPaise}, 0, current_date, ${enabled}, ${session.userId}::uuid, now())
    ON CONFLICT (agent_slug) DO UPDATE SET
      rate_pct = EXCLUDED.rate_pct,
      daily_cap_paise = EXCLUDED.daily_cap_paise,
      enabled = EXCLUDED.enabled,
      updated_by = EXCLUDED.updated_by,
      updated_at = now()
  `);

  invalidateSamplingCache(agentSlug);
  return NextResponse.json({ ok: true });
}
