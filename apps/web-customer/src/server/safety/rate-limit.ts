import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq, gte, isNotNull, sql, sum } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';

/**
 * Safety layer — server-enforced limits. All checks are Postgres-backed so they
 * survive process restarts. When load grows, swap to Redis + sliding-window.
 *
 * The goal is defence-in-depth: chat already has its own per-analysis limits
 * (see server/analyse/chat.ts); these guard the upload + account-level surface
 * area so one abuser can't overwhelm the system or run up our Gemini bill.
 */

export interface LimitIdentity {
  userId: string | null;
  ip: string | null;
  tenantId: string;
}

export type LimitError =
  | 'rate_limit_uploads_hour'
  | 'rate_limit_uploads_day'
  | 'cost_cap_daily';

/**
 * At most 10 uploads / hour and 50 uploads / day per identity.
 * Uploads are identified by policy_analysis rows created_at within the window.
 */
export async function assertUploadRateLimit(id: LimitIdentity): Promise<LimitError | null> {
  const db = serviceDb();
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  if (id.userId) {
    // Signed-in users — counted by policy_analysis rows.
    const userClause = eq(schema.policyAnalysis.userId, id.userId);
    const [hourRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.policyAnalysis)
      .where(and(userClause, gte(schema.policyAnalysis.createdAt, hourAgo)));
    if ((hourRow?.count ?? 0) >= 10) return 'rate_limit_uploads_hour';

    const [dayRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(schema.policyAnalysis)
      .where(and(userClause, gte(schema.policyAnalysis.createdAt, dayAgo)));
    if ((dayRow?.count ?? 0) >= 50) return 'rate_limit_uploads_day';
    return null;
  }

  // Anonymous users — counted by upload_event rows keyed on IP. No IP = no
  // anonymous cap enforceable (likely means we're behind an un-trusted
  // proxy). Log loudly so ops notices.
  if (!id.ip) {
    console.warn('[rate-limit] anonymous upload with no IP — cannot enforce');
    return null;
  }
  const ipClause = sql`upload_event.ip = ${id.ip}::inet`;
  const [hourRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.uploadEvent)
    .where(and(ipClause, gte(schema.uploadEvent.createdAt, hourAgo), isNotNull(schema.uploadEvent.ip)));
  if ((hourRow?.count ?? 0) >= 5) return 'rate_limit_uploads_hour';

  const [dayRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.uploadEvent)
    .where(and(ipClause, gte(schema.uploadEvent.createdAt, dayAgo), isNotNull(schema.uploadEvent.ip)));
  if ((dayRow?.count ?? 0) >= 20) return 'rate_limit_uploads_day';

  return null;
}

/**
 * Record the upload event so subsequent rate-limit checks can see it.
 * Called from actions.ts#startAnalysis after the analysis row is created.
 */
export async function recordUploadEvent(args: {
  tenantId: string;
  userId: string | null;
  analysisId: string;
  ip: string | null;
  userAgent: string | null;
}): Promise<void> {
  const db = serviceDb();
  await db.insert(schema.uploadEvent).values({
    id: randomUUID(),
    tenantId: args.tenantId,
    userId: args.userId,
    analysisId: args.analysisId,
    ip: args.ip ?? null,
    userAgent: args.userAgent?.slice(0, 500) ?? null,
  });
}

/**
 * Daily cost cap per identity across ALL agent runs (pipeline + chat + eval).
 * Free-tier default: ₹200/day. Raise per-user via a future entitlement column.
 */
export async function assertDailyCostCap(id: LimitIdentity): Promise<LimitError | null> {
  if (!id.userId) return null; // anonymous tracking TBD

  const db = serviceDb();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [row] = await db
    .select({ total: sum(schema.agentRun.costPaise).mapWith(Number) })
    .from(schema.agentRun)
    .where(and(eq(schema.agentRun.userId, id.userId), gte(schema.agentRun.startedAt, dayAgo)));

  const capPaise = Number(process.env.FREE_TIER_DAILY_CAP_PAISE ?? '20000'); // ₹200 default
  if ((row?.total ?? 0) >= capPaise) return 'cost_cap_daily';
  return null;
}

export function humanLimitMessage(code: LimitError): string {
  switch (code) {
    case 'rate_limit_uploads_hour':
      return "You've uploaded 10 policies in the last hour. Take a break and try again in a bit.";
    case 'rate_limit_uploads_day':
      return "You've uploaded 50 policies today — the daily limit. Try again tomorrow or contact support.";
    case 'cost_cap_daily':
      return "You've used your daily free analysis budget. Upgrade to continue, or try again tomorrow.";
  }
}
