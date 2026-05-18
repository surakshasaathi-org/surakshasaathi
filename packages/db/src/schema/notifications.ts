import {
  pgTable,
  text,
  uuid,
  integer,
  jsonb,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { createdAt, tenantIdCol } from './_shared';
import { appUser } from './tenancy';
import { policy } from './user-data';
import { policyAnalysis } from './analyses';

/**
 * Outbound communication queue. Renewal reminders, analysis-ready pings,
 * claim-deadline alerts — all flow through here. The row is inserted in
 * 'pending' state; a worker flips to 'sent' or 'failed'. dedupeKey guarantees
 * idempotent cron (same (user_id, dedupe_key) can only be inserted once).
 */
export const notification = pgTable(
  'notification',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull(), // 'email' | 'whatsapp' | 'sms'
    kind: text('kind').notNull(),
    toAddress: text('to_address').notNull(),
    subject: text('subject'),
    bodyText: text('body_text').notNull(),
    bodyHtml: text('body_html'),
    dedupeKey: text('dedupe_key'),
    status: text('status').notNull().default('pending'), // 'pending' | 'sent' | 'failed' | 'skipped'
    sentAt: timestamp('sent_at', { withTimezone: true }),
    attempts: integer('attempts').notNull().default(0),
    lastError: text('last_error'),
    relatedPolicyId: uuid('related_policy_id').references(() => policy.id, {
      onDelete: 'set null',
    }),
    relatedAnalysisId: uuid('related_analysis_id').references(() => policyAnalysis.id, {
      onDelete: 'set null',
    }),
    relatedCaseId: uuid('related_case_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default({}),
    scheduledFor: timestamp('scheduled_for', { withTimezone: true }).notNull().defaultNow(),
    createdAt,
  },
  (t) => ({
    byPending: index('notification_pending_idx').on(t.scheduledFor),
    byUser: index('notification_user_idx').on(t.userId, t.createdAt),
    dedupe: uniqueIndex('notification_dedupe_idx').on(t.userId, t.dedupeKey),
  }),
);
