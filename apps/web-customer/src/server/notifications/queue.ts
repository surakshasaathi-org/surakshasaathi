import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, lte } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';

/**
 * Notification queue — enqueue, process-pending, mark-sent. Providers are
 * pluggable; today we log-only in dev, and swap in Resend/MSG91/WATI for
 * prod. The queue shape + dedupe key + status flags are stable either way.
 */

export interface EnqueueNotificationInput {
  userId: string;
  tenantId: string;
  channel: 'email' | 'whatsapp' | 'sms';
  kind: string;
  toAddress: string;
  subject?: string;
  bodyText: string;
  bodyHtml?: string;
  /** If set, duplicate (userId, dedupeKey) inserts become no-ops. Safe for cron. */
  dedupeKey?: string;
  scheduledFor?: Date;
  relatedPolicyId?: string | null;
  relatedAnalysisId?: string | null;
  relatedCaseId?: string | null;
  metadata?: Record<string, unknown>;
}

export async function enqueueNotification(
  input: EnqueueNotificationInput,
): Promise<{ ok: true; id: string | null } | { ok: false; code: string; message: string }> {
  const db = serviceDb();
  try {
    const [row] = await db
      .insert(schema.notification)
      .values({
        id: randomUUID(),
        tenantId: input.tenantId,
        userId: input.userId,
        channel: input.channel,
        kind: input.kind,
        toAddress: input.toAddress,
        subject: input.subject ?? null,
        bodyText: input.bodyText,
        bodyHtml: input.bodyHtml ?? null,
        dedupeKey: input.dedupeKey ?? null,
        status: 'pending',
        relatedPolicyId: input.relatedPolicyId ?? null,
        relatedAnalysisId: input.relatedAnalysisId ?? null,
        relatedCaseId: input.relatedCaseId ?? null,
        metadata: input.metadata ?? {},
        scheduledFor: input.scheduledFor ?? new Date(),
      })
      .onConflictDoNothing({ target: [schema.notification.userId, schema.notification.dedupeKey] })
      .returning({ id: schema.notification.id });
    return { ok: true, id: row?.id ?? null };
  } catch (err) {
    return { ok: false, code: 'enqueue_failed', message: (err as Error).message.slice(0, 200) };
  }
}

export interface ProcessResult {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
  details: Array<{ id: string; status: 'sent' | 'failed' | 'skipped'; reason?: string }>;
}

export async function processPendingNotifications(limit = 25): Promise<ProcessResult> {
  const db = serviceDb();
  const now = new Date();
  const pending = await db
    .select()
    .from(schema.notification)
    .where(and(eq(schema.notification.status, 'pending'), lte(schema.notification.scheduledFor, now)))
    .orderBy(asc(schema.notification.scheduledFor))
    .limit(limit);

  const result: ProcessResult = { attempted: pending.length, sent: 0, failed: 0, skipped: 0, details: [] };

  for (const n of pending) {
    try {
      const outcome = await sendViaProvider(n);
      if (outcome.status === 'sent') {
        await db
          .update(schema.notification)
          .set({ status: 'sent', sentAt: new Date(), attempts: n.attempts + 1 })
          .where(eq(schema.notification.id, n.id));
        result.sent += 1;
        result.details.push({ id: n.id, status: 'sent' });
      } else if (outcome.status === 'skipped') {
        await db
          .update(schema.notification)
          .set({ status: 'skipped', attempts: n.attempts + 1, lastError: outcome.reason })
          .where(eq(schema.notification.id, n.id));
        result.skipped += 1;
        result.details.push({ id: n.id, status: 'skipped', reason: outcome.reason });
      } else {
        await db
          .update(schema.notification)
          .set({ status: 'failed', attempts: n.attempts + 1, lastError: outcome.reason })
          .where(eq(schema.notification.id, n.id));
        result.failed += 1;
        result.details.push({ id: n.id, status: 'failed', reason: outcome.reason });
      }
    } catch (err) {
      const reason = (err as Error).message.slice(0, 200);
      await db
        .update(schema.notification)
        .set({ status: 'failed', attempts: n.attempts + 1, lastError: reason })
        .where(eq(schema.notification.id, n.id));
      result.failed += 1;
      result.details.push({ id: n.id, status: 'failed', reason });
    }
  }
  return result;
}

/**
 * Provider dispatch. Today: stubbed log-only so we can exercise the queue in
 * dev without a real SMTP/SMS credential. Production wiring:
 *   - 'email'    → Resend / SES (toAddress = email)
 *   - 'whatsapp' → WATI template
 *   - 'sms'      → MSG91 / Gupshup
 *
 * Returning 'skipped' (vs 'failed') distinguishes "policy: don't send" (e.g.
 * user has opted out) from "provider error". Both flip status but only the
 * failed ones should alert ops.
 */
async function sendViaProvider(
  n: typeof schema.notification.$inferSelect,
): Promise<{ status: 'sent' | 'skipped' | 'failed'; reason?: string }> {
  if (process.env.NOTIFICATIONS_PROVIDER === 'resend' && n.channel === 'email') {
    // Placeholder for future Resend integration — kept minimal so the dev
    // path never accidentally hits a live API. Flip via env var when ready.
    return { status: 'skipped', reason: 'resend_not_wired' };
  }
  // Dev / default: log + treat as sent so downstream UX (activity timeline,
  // dedupe) behaves correctly without mocking a transport layer.
  console.log(
    `[notifications] dev-send channel=${n.channel} kind=${n.kind} to=${redactAddress(n.toAddress)} subject=${
      n.subject ?? '(no subject)'
    }`,
  );
  return { status: 'sent' };
}

function redactAddress(addr: string): string {
  if (addr.includes('@')) {
    const [local, domain] = addr.split('@');
    return `${local!.slice(0, 2)}***@${domain}`;
  }
  return addr.slice(0, 3) + '***';
}
