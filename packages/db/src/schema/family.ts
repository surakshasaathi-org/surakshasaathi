import { pgTable, text, uuid, boolean, date, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { createdAt, updatedAt, tenantIdCol } from './_shared';
import { appUser } from './tenancy';
import { policyAnalysis } from './analyses';

/**
 * Persistent family graph — one row per member per user. Replaces the
 * per-analysis `policy_analysis.demographics_json` as the canonical source
 * (the JSON column stays for historical rows + anonymous uploads).
 *
 * Design notes:
 *   - `relation` is free-form text (not an enum) so we can accept "uncle",
 *     "ward", "live-in partner" without migration churn.
 *   - `is_primary` marks the account-holder's own row; enforced unique per
 *     user by a partial index. Guarantees that dashboards / coverage runs can
 *     always find "the user themselves" without extra heuristics.
 *   - `ayushman_card_number` is nullable — most families won't have one, but
 *     when present it's the key to PM-JAY scheme matching.
 */
export const familyMember = pgTable(
  'family_member',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    relation: text('relation').notNull(),
    displayName: text('display_name').notNull(),
    dateOfBirth: date('date_of_birth'),
    gender: text('gender'),
    preExistingConditions: text('pre_existing_conditions').array().notNull().default([]),
    chronicMedications: text('chronic_medications').array().notNull().default([]),
    ayushmanCardNumber: text('ayushman_card_number'),
    notes: text('notes'),
    isPrimary: boolean('is_primary').notNull().default(false),
    /**
     * 'draft' — proposed by an analysis, awaits user confirm/change/delete.
     * 'confirmed' — user-authored or explicitly confirmed; feeds into coverage,
     *   scheme matching, dashboard. Only confirmed rows count.
     */
    status: text('status').notNull().default('confirmed'),
    /** Provenance — 'manual' for user-added, 'analysis:<id>' for draft proposals. */
    source: text('source').notNull().default('manual'),
    sourceAnalysisId: uuid('source_analysis_id').references(() => policyAnalysis.id, {
      onDelete: 'set null',
    }),
    createdAt,
    updatedAt,
  },
  (t) => ({
    byUser: index('family_member_user_idx').on(t.userId, t.createdAt),
    byStatus: index('family_member_status_idx').on(t.userId, t.status),
    primaryPerUser: uniqueIndex('family_member_primary_idx').on(t.userId),
  }),
);
