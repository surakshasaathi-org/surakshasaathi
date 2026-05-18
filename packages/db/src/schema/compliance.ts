import { pgTable, text, uuid, jsonb, timestamp, boolean, index } from 'drizzle-orm/pg-core';
import { createdAt, tenantIdCol } from './_shared';

/**
 * DPDP Act consent records. Granular — one row per purpose per grant.
 * Withdrawing consent inserts a new row with `granted=false`. The timeline is auditable.
 */
export const consent = pgTable(
  'consent',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    userId: uuid('user_id').notNull(),
    purpose: text('purpose').notNull(),             // "document_ocr", "agent_analysis", "affiliate_referral", ...
    granted: boolean('granted').notNull(),
    grantedAt: timestamp('granted_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    sourceIp: text('source_ip'),
    userAgent: text('user_agent'),
    policyVersion: text('policy_version').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt,
  },
  (t) => ({
    byUser: index('consent_user_idx').on(t.userId, t.purpose, t.createdAt),
  }),
);

/**
 * Immutable audit log. Every sensitive action — admin data access, service-role query,
 * payment state change, regulatory filing — writes a row here.
 * Retention: 7 years (financial-record standard). Enforced by migration-time policy, not app.
 */
export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    actorUserId: uuid('actor_user_id'),             // null = system
    actorKind: text('actor_kind').notNull(),        // "user" | "admin" | "agent" | "system" | "webhook"
    action: text('action').notNull(),               // "case.filed", "payment.captured", "review.approved"
    subjectType: text('subject_type').notNull(),    // "case", "payment", "document", ...
    subjectId: text('subject_id').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt,
  },
  (t) => ({
    byTenant: index('audit_log_tenant_idx').on(t.tenantId, t.createdAt),
    bySubject: index('audit_log_subject_idx').on(t.subjectType, t.subjectId),
    byActor: index('audit_log_actor_idx').on(t.actorUserId, t.createdAt),
  }),
);

/**
 * DPDP data subject requests (access / erasure / portability).
 * Must resolve within 72 hours (see CLAUDE.md section 7).
 */
export const dpdpRequest = pgTable(
  'dpdp_request',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    userId: uuid('user_id').notNull(),
    kind: text('kind').notNull(),                   // "access" | "erasure" | "portability" | "correction"
    status: text('status').notNull().default('received'), // received | in_progress | fulfilled | rejected
    fulfilledAt: timestamp('fulfilled_at', { withTimezone: true }),
    assignedTo: uuid('assigned_to'),
    rejectionReason: text('rejection_reason'),
    fulfilledPayloadPath: text('fulfilled_payload_path'), // storage path of export if access/portability
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt,
  },
  (t) => ({
    byStatus: index('dpdp_request_status_idx').on(t.status, t.createdAt),
    byUser: index('dpdp_request_user_idx').on(t.userId),
  }),
);
