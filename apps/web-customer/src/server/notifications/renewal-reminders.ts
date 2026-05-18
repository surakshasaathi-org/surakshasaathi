import 'server-only';
import { and, eq, isNotNull, sql } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import { enqueueNotification } from './queue';

/**
 * Renewal-reminder enqueue worker. Finds policies whose end_date is N days
 * away for N ∈ {14, 7, 1} and pushes one email per (policy, N) into the
 * queue. The dedupe key makes this idempotent — running it multiple times
 * on the same day is a no-op.
 */

const REMINDER_WINDOWS_DAYS = [14, 7, 1];

export interface ReminderRunResult {
  policiesScanned: number;
  reminders: number;
  skipped: number;
}

export async function enqueueRenewalReminders(): Promise<ReminderRunResult> {
  const db = serviceDb();
  // Find policies expiring in the next 14 days, with an owner email on file.
  const candidates = await db.execute<{
    policy_id: string;
    insurer_name: string;
    plan_name: string | null;
    end_date: string;
    user_id: string;
    email: string | null;
    tenant_id: string;
  }>(sql`
    select
      p.id as policy_id,
      p.insurer_name,
      (p.metadata->>'plan_name') as plan_name,
      p.end_date::text,
      p.user_id,
      u.email,
      p.tenant_id
    from policy p
    join app_user u on u.id = p.user_id
    where p.end_date is not null
      and p.end_date between current_date and (current_date + interval '15 days')
      and u.email is not null
  `);

  const rows = candidates as unknown as Array<{
    policy_id: string;
    insurer_name: string;
    plan_name: string | null;
    end_date: string;
    user_id: string;
    email: string | null;
    tenant_id: string;
  }>;

  let reminders = 0;
  let skipped = 0;

  for (const c of rows) {
    if (!c.email) {
      skipped += 1;
      continue;
    }
    const end = new Date(c.end_date);
    const days = Math.ceil((end.getTime() - Date.now()) / (24 * 3600 * 1000));

    // Find the largest matching window. Only send for the EXACT day-match
    // window so we don't double-send across 14 → 7 → 1 windows.
    const match = REMINDER_WINDOWS_DAYS.find((w) => days === w);
    if (!match) {
      skipped += 1;
      continue;
    }

    const planLabel = c.plan_name ? ` — ${c.plan_name}` : '';
    const res = await enqueueNotification({
      userId: c.user_id,
      tenantId: c.tenant_id,
      channel: 'email',
      kind: 'renewal_reminder',
      toAddress: c.email,
      subject: `Renewal in ${match} day${match === 1 ? '' : 's'}: ${c.insurer_name}${planLabel}`,
      bodyText: renewalBody(c.insurer_name, match, end),
      dedupeKey: `renewal:${c.policy_id}:${match}d`,
      relatedPolicyId: c.policy_id,
      metadata: { window_days: match, end_date: c.end_date },
    });
    if (res.ok) reminders += 1;
  }

  return { policiesScanned: rows.length, reminders, skipped };
}

/**
 * Also checks policies recently acquired an analysis: if the latest analysis
 * has high-severity red flags, a one-time "we found things you should know"
 * email goes out. Called from the pipeline when coverage completes — not a
 * cron job.
 */
export async function enqueueAnalysisReadyEmail(args: {
  userId: string;
  tenantId: string;
  analysisId: string;
  insurerName: string;
  highSeverityCount: number;
}): Promise<void> {
  const db = serviceDb();
  const [row] = await db
    .select({ email: schema.appUser.email })
    .from(schema.appUser)
    .where(and(eq(schema.appUser.id, args.userId), isNotNull(schema.appUser.email)))
    .limit(1);
  if (!row?.email) return;

  const gapsLine =
    args.highSeverityCount > 0
      ? `We flagged ${args.highSeverityCount} high-severity item${args.highSeverityCount === 1 ? '' : 's'} worth reviewing.`
      : 'No critical issues — your policy looks solid.';

  await enqueueNotification({
    userId: args.userId,
    tenantId: args.tenantId,
    channel: 'email',
    kind: 'analysis_ready',
    toAddress: row.email,
    subject: `Your ${args.insurerName} policy analysis is ready`,
    bodyText:
      `Your policy analysis is ready.\n\n${gapsLine}\n\n` +
      `Open it here:\n${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/en/policy-health-score/analysis/${args.analysisId}`,
    dedupeKey: `analysis_ready:${args.analysisId}`,
    relatedAnalysisId: args.analysisId,
    metadata: { insurer: args.insurerName, high_severity_count: args.highSeverityCount },
  });
}

function renewalBody(insurer: string, days: number, endDate: Date): string {
  const dateStr = endDate.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const urgency =
    days === 1
      ? 'Your policy renews TOMORROW.'
      : days <= 7
        ? `Your policy renews in ${days} days.`
        : `Your policy is up for renewal in ${days} days.`;
  return [
    `${urgency}`,
    ``,
    `Policy: ${insurer}`,
    `Renewal date: ${dateStr}`,
    ``,
    `Before you pay the premium, we recommend re-analysing your policy to catch any changes in`,
    `exclusions, waiting periods, or sub-limits the insurer may have quietly added.`,
    ``,
    `Re-analyse: ${process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'}/en/policy-health-score/analyse`,
    ``,
    `— Suraksha Saathi`,
  ].join('\n');
}
