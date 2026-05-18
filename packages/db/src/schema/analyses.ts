import { pgTable, text, uuid, integer, real, jsonb, timestamp, index } from 'drizzle-orm/pg-core';
import { createdAt, ocrStatusEnum, tenantIdCol } from './_shared';
import { pgEnum } from 'drizzle-orm/pg-core';
import { appUser } from './tenancy';

/**
 * Analyse-My-Policy pipeline tables. Anonymous flow — keyed by an opaque
 * `session_token` cookie instead of `user_id`. No PII. 7-day TTL.
 *
 * Access model (RLS):
 *   - insert: anyone can create a document + analysis during their session
 *   - select/update: the caller's cookie must match `policy_analysis.session_token`
 *   - service role (background pipeline + admin) bypasses RLS and logs to audit_log
 *
 * See docs/prd/01a-analyse-my-policy.md §6–7.
 */

export const analysisStatusEnum = pgEnum('analysis_status', [
  'queued',
  'digitizing',
  'ocr_running',
  'intake_running',
  'extracting',
  'analysing',
  'translating',
  'reviewing',
  'ready',
  'failed',
]);

export const policyDocument = pgTable(
  'policy_document',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    storagePath: text('storage_path').notNull(),
    contentSha256: text('content_sha256').notNull(),
    mime: text('mime').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    pageCount: integer('page_count'),
    ocrStatus: ocrStatusEnum('ocr_status').notNull().default('pending'),
    ocrText: text('ocr_text'),
    ocrPages: jsonb('ocr_pages').$type<Array<{ page: number; text: string }>>(),
    extracted: jsonb('extracted').$type<Record<string, unknown>>(),
    extractedAt: timestamp('extracted_at', { withTimezone: true }),
    createdAt,
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    expiryIdx: index('policy_document_expiry_idx').on(t.expiresAt),
    shaIdx: index('policy_document_sha_idx').on(t.contentSha256),
  }),
);

export const policyAnalysis = pgTable(
  'policy_analysis',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    documentId: uuid('document_id').notNull().references(() => policyDocument.id, { onDelete: 'cascade' }),
    /**
     * Opaque access key. Set on creation, stored as signed HTTP-only cookie on the
     * user's browser. RLS policy matches request cookie = row token.
     */
    sessionToken: text('session_token').notNull(),
    /** Signed-in user who owns this analysis. NULL for anonymous uploads (claimed on sign-in). */
    userId: uuid('user_id').references(() => appUser.id, { onDelete: 'set null' }),
    locale: text('locale').notNull(),
    status: analysisStatusEnum('status').notNull().default('queued'),
    /** Human-visible message like "Extracting page 4 of 30" */
    progressStep: text('progress_step'),
    /** Full 10-section report from PolicyAnalyzer + TranslationAgent + ReviewAgent */
    reportJson: jsonb('report_json').$type<Record<string, unknown>>(),
    /** User-supplied family / demographic context used by coverage agent. */
    demographicsJson: jsonb('demographics_json').$type<Record<string, unknown>>(),
    /**
     * Link to the canonical `policy` row this analysis describes. Set by the
     * pipeline after a successful extractor run: we look up-or-insert a row
     * keyed on (user_id, insurer_name, policy_number) so re-uploads of the
     * same policy (e.g. next year's renewal) share a stable parent.
     * NULL for anonymous uploads (no user) and for legacy pre-link rows.
     */
    policyId: uuid('policy_id'),
    readinessScore: integer('readiness_score'),
    readinessComponents: jsonb('readiness_components').$type<Record<string, number>>(),
    redFlagsCount: integer('red_flags_count'),
    confidenceOverall: real('confidence_overall'),
    agentRunIds: uuid('agent_run_ids').array().notNull().default([]),
    costPaise: integer('cost_paise').notNull().default(0),
    errorCode: text('error_code'),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    readyAt: timestamp('ready_at', { withTimezone: true }),
    createdAt,
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    statusIdx: index('policy_analysis_status_idx').on(t.status, t.createdAt),
    expiryIdx: index('policy_analysis_expiry_idx').on(t.expiresAt),
    tokenIdx: index('policy_analysis_token_idx').on(t.sessionToken),
    userIdx: index('policy_analysis_user_idx').on(t.userId),
    policyIdx: index('policy_analysis_policy_idx').on(t.policyId),
  }),
);
