import { pgTable, text, uuid, integer, jsonb, date, timestamp, index } from 'drizzle-orm/pg-core';
import {
  caseKindEnum,
  caseStatusEnum,
  createdAt,
  documentKindEnum,
  ocrStatusEnum,
  priorityEnum,
  tenantIdCol,
  updatedAt,
} from './_shared';
import { appUser } from './tenancy';
import { insuranceLine, productModule } from './catalog';

/**
 * A policy held by a user. Not all 8 ideas need this — Idea 3 (eligibility) is anonymous.
 * For authenticated flows, this is the canonical record. metadata carries line-specific fields.
 */
export const policy = pgTable(
  'policy',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    userId: uuid('user_id').notNull().references(() => appUser.id, { onDelete: 'cascade' }),
    lineId: text('line_id').notNull().references(() => insuranceLine.id),
    insurerName: text('insurer_name').notNull(),
    policyNumber: text('policy_number').notNull(),
    sumAssured: integer('sum_assured'),
    premium: integer('premium'),
    startDate: date('start_date'),
    endDate: date('end_date'),
    nomineeName: text('nominee_name'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => ({
    byUser: index('policy_user_idx').on(t.userId),
    byTenant: index('policy_tenant_idx').on(t.tenantId),
    byLine: index('policy_line_idx').on(t.lineId),
  }),
);

/**
 * Case = unit of work for claims / mis-selling / unclaimed / scheme refusal / advisory.
 * Shared across Ideas 1, 3 (scheme refusal + unclaimed), 7 (mis-selling), 8.
 */
export const caseRow = pgTable(
  'case',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    userId: uuid('user_id').notNull().references(() => appUser.id, { onDelete: 'cascade' }),
    moduleId: text('module_id').notNull().references(() => productModule.id),
    kind: caseKindEnum('kind').notNull(),
    status: caseStatusEnum('status').notNull().default('intake'),
    priority: priorityEnum('priority').notNull().default('normal'),
    amountClaimedPaise: integer('amount_claimed_paise'),
    amountRecoveredPaise: integer('amount_recovered_paise'),
    insurerName: text('insurer_name'),
    policyId: uuid('policy_id'),
    assignedTo: uuid('assigned_to'),
    deadlineAt: timestamp('deadline_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => ({
    byUser: index('case_user_idx').on(t.userId),
    byTenant: index('case_tenant_idx').on(t.tenantId),
    byStatus: index('case_status_idx').on(t.status),
    byDeadline: index('case_deadline_idx').on(t.deadlineAt),
    byAssignee: index('case_assigned_idx').on(t.assignedTo),
  }),
);

/**
 * Case timeline — every state change, agent decision, human action.
 * Powers the admin-portal case view and customer status page.
 */
export const caseEvent = pgTable(
  'case_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    caseId: uuid('case_id').notNull().references(() => caseRow.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id'),           // null = system / agent
    actorKind: text('actor_kind').notNull(),      // "user", "agent", "case_manager", "system"
    type: text('type').notNull(),                 // "status_change", "agent_run", "document_uploaded", etc.
    payload: jsonb('payload').$type<Record<string, unknown>>().default({}).notNull(),
    userVisible: jsonb('user_visible').$type<Record<string, string>>(),
    createdAt,
  },
  (t) => ({
    byCase: index('case_event_case_idx').on(t.caseId, t.createdAt),
  }),
);

export const document = pgTable(
  'document',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    uploaderUserId: uuid('uploader_user_id').notNull().references(() => appUser.id, { onDelete: 'cascade' }),
    kind: documentKindEnum('kind').notNull(),
    storagePath: text('storage_path').notNull(),  // Supabase Storage bucket key
    contentSha256: text('content_sha256').notNull(),
    mime: text('mime').notNull(),
    sizeBytes: integer('size_bytes').notNull(),
    ocrStatus: ocrStatusEnum('ocr_status').notNull().default('pending'),
    ocrText: text('ocr_text'),
    extracted: jsonb('extracted').$type<Record<string, unknown>>(),
    caseId: uuid('case_id'),
    policyId: uuid('policy_id'),
    createdAt,
  },
  (t) => ({
    byCase: index('document_case_idx').on(t.caseId),
    byUploader: index('document_user_idx').on(t.uploaderUserId),
    bySha: index('document_sha_idx').on(t.contentSha256),
  }),
);
