import {
  pgTable,
  text,
  uuid,
  integer,
  jsonb,
  boolean,
  numeric,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { createdAt, tenantIdCol, updatedAt } from './_shared';

/**
 * Readiness-score rule set. Copies the versioning pattern from agentDefinition —
 * one row per (slug, version), `isDefault=true` on exactly one row per slug at
 * any time. Editing rules = insert a new version row + flip isDefault.
 *
 * `rulesJson` carries the full scoring payload: 11 section weights + scoring
 * curves + city-tier → rupee-band tables + insurer trust static lookup +
 * exclusion penalties + band thresholds. The scoring module consumes this
 * shape; admin UI edits it as JSON in slice 3.
 */
export const readinessRule = pgTable(
  'readiness_rule',
  {
    slug: text('slug').notNull(),                 // 'readiness' — reserved for future lines (e.g. 'readiness_motor')
    version: integer('version').notNull(),
    isDefault: boolean('is_default').notNull().default(false),
    rulesJson: jsonb('rules_json').$type<Record<string, unknown>>().notNull(),
    notes: text('notes'),
    createdAt,
    updatedAt,
  },
  (t) => ({
    pk: uniqueIndex('readiness_rule_slug_version_idx').on(t.slug, t.version),
    byDefault: index('readiness_rule_default_idx').on(t.slug, t.isDefault),
  }),
);

/**
 * Per-analysis score record. One row per policy_analysis.
 *
 * Computed in the background by the scoring module after an analysis completes.
 * `isInternal=true` hides the row from end-users until the calibration month
 * ends (product decision #7). RLS enforces that too — admin role sees all rows,
 * non-admin JWT filters to is_internal=false.
 *
 * `components` holds the drill-down: one object per section with
 * { weight, achieved, reason, severity, action?, missing? }. Also used to
 * derive the ranked risk list on the UI.
 */
export const policyScore = pgTable(
  'policy_score',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    analysisId: uuid('analysis_id').notNull(),
    userId: uuid('user_id'),                      // null for anonymous analyses
    rulesSlug: text('rules_slug').notNull(),
    rulesVersion: integer('rules_version').notNull(),
    totalScore: integer('total_score').notNull(),
    denominator: integer('denominator').notNull(),    // <100 when sections were skipped
    band: text('band').notNull(),                     // 'claim_ready' | 'mostly_covered' | 'gaps_to_close' | 'high_risk'
    outOfPocketPct: numeric('out_of_pocket_pct', { precision: 4, scale: 1 }).notNull(),
    gapCount: integer('gap_count').notNull(),
    components: jsonb('components').$type<unknown[]>().notNull(),
    isInternal: boolean('is_internal').notNull().default(true),
    createdAt,
    updatedAt,
  },
  (t) => ({
    byAnalysis: uniqueIndex('policy_score_analysis_idx').on(t.analysisId),
    byUser: index('policy_score_user_idx').on(t.userId, t.createdAt),
    byRules: index('policy_score_rules_idx').on(t.rulesSlug, t.rulesVersion),
    byBand: index('policy_score_band_idx').on(t.band),
  }),
);

/**
 * Admin audit log — shared with Feature B (agent prompt editor).
 * Records every draft/publish/rollback action on versioned admin-owned
 * resources. Built once here; Feature B reuses the same table.
 */
export const adminAuditLog = pgTable(
  'admin_audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    actorId: uuid('actor_id'),                    // null for system actions (e.g. seed)
    entity: text('entity').notNull(),             // 'readiness_rule' | 'agent_definition' | ...
    entityId: text('entity_id').notNull(),        // slug or composite key as text
    action: text('action').notNull(),             // 'draft' | 'publish' | 'rollback'
    fromVersion: integer('from_version'),
    toVersion: integer('to_version'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt,
  },
  (t) => ({
    byEntity: index('admin_audit_log_entity_idx').on(t.entity, t.entityId, t.createdAt),
    byActor: index('admin_audit_log_actor_idx').on(t.actorId, t.createdAt),
  }),
);
