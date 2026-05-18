import { pgTable, text, integer, boolean, jsonb, date, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { authLevelEnum, clusterEnum, moduleStatusEnum, pricingModelEnum, schemeLevelEnum, slugCol, createdAt, updatedAt, localeEnum } from './_shared';

/**
 * Reference table of insurance lines. NEW LINES ARE ROW INSERTS, NOT CODE CHANGES.
 * See CLAUDE.md section 4 and ADR-0003.
 */
export const insuranceLine = pgTable('insurance_line', {
  id: slugCol(),                                  // e.g. "health", "life", "motor"
  displayNameI18n: jsonb('display_name_i18n').$type<Record<string, string>>().notNull(),
  category: text('category').notNull(),           // "general", "life", "commercial"
  enabled: boolean('enabled').notNull().default(true),
  orderIndex: integer('order_index').notNull().default(0),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt,
});

/**
 * Product module = one idea on the landing page. See ADR-0003.
 * Adding a 9th idea = INSERT into this table + write intake_flow + register agents.
 */
export const productModule = pgTable(
  'product_module',
  {
    id: slugCol(),                                // slug like "claims-advocacy"
    cluster: clusterEnum('cluster').notNull(),
    nameI18n: jsonb('name_i18n').$type<Record<string, string>>().notNull(),
    taglineI18n: jsonb('tagline_i18n').$type<Record<string, string>>().notNull(),
    heroHeadlineI18n: jsonb('hero_headline_i18n').$type<Record<string, string>>().notNull(),
    heroSubheadI18n: jsonb('hero_subhead_i18n').$type<Record<string, string>>().notNull(),
    landingRoute: text('landing_route').notNull(),
    pricingModel: pricingModelEnum('pricing_model').notNull(),
    authRequired: authLevelEnum('auth_required').notNull(),
    launchLocales: text('launch_locales').array().notNull().default([]),
    status: moduleStatusEnum('status').notNull().default('concept'),
    intakeFlowId: text('intake_flow_id'),         // FK handled on `intake_flow` side
    agentDefinitionIds: text('agent_definition_ids').array().notNull().default([]),
    orderIndex: integer('order_index').notNull().default(0),
    iconSlug: text('icon_slug'),
    createdAt,
    updatedAt,
  },
  (t) => ({
    byStatus: index('product_module_status_idx').on(t.status),
    byOrder: index('product_module_order_idx').on(t.orderIndex),
  }),
);

/**
 * Versioned scheme definitions. Powers Idea 3 (Scheme Navigator) and Idea 7 (Senior Portal).
 */
export const scheme = pgTable(
  'scheme',
  {
    id: text('id').primaryKey(),                  // e.g. "pm-jay@v3"
    slug: text('slug').notNull(),                 // e.g. "pm-jay"
    level: schemeLevelEnum('level').notNull(),
    stateCode: text('state_code'),                // null for central
    nameI18n: jsonb('name_i18n').$type<Record<string, string>>().notNull(),
    summaryI18n: jsonb('summary_i18n').$type<Record<string, string>>().notNull(),
    eligibilityRules: jsonb('eligibility_rules').$type<Record<string, unknown>>().notNull(),
    coveragePaise: integer('coverage_paise'),
    lineIds: text('line_ids').array().notNull().default([]),
    applicationChannels: text('application_channels').array().notNull().default([]),
    version: integer('version').notNull(),
    effectiveFrom: date('effective_from').notNull(),
    deprecatedFrom: date('deprecated_from'),
    createdAt,
    updatedAt,
  },
  (t) => ({
    bySlug: index('scheme_slug_idx').on(t.slug),
    byState: index('scheme_state_idx').on(t.stateCode),
    uniqVersion: uniqueIndex('scheme_slug_version_idx').on(t.slug, t.version),
  }),
);

/**
 * Intake flow = versioned JSON/DSL describing the intake form and routing rules for a module.
 * Editing an intake flow is an admin-portal action, not a code deploy.
 */
export const intakeFlow = pgTable(
  'intake_flow',
  {
    id: text('id').primaryKey(),                  // e.g. "claims-advocacy-v1"
    moduleId: text('module_id').notNull().references(() => productModule.id),
    version: integer('version').notNull(),
    steps: jsonb('steps').$type<unknown>().notNull(),
    routingAgentId: text('routing_agent_id'),     // slug of agent_definition for IntakeAgent override
    isDefault: boolean('is_default').notNull().default(false),
    enabled: boolean('enabled').notNull().default(true),
    createdAt,
    updatedAt,
  },
  (t) => ({
    uniqVersion: uniqueIndex('intake_flow_module_version_idx').on(t.moduleId, t.version),
  }),
);

/** Locale table — kept as a reference so we can display a friendly name + script family in UI. */
export const localeMeta = pgTable('locale_meta', {
  code: localeEnum('code').primaryKey(),
  nativeName: text('native_name').notNull(),      // "हिन्दी", "ಕನ್ನಡ"
  englishName: text('english_name').notNull(),    // "Hindi", "Kannada"
  scriptFamily: text('script_family').notNull(),  // "Devanagari", "Kannada", "Latin"
  rtl: boolean('rtl').notNull().default(false),
  launchPhase: integer('launch_phase').notNull(), // 1/2/3
  enabled: boolean('enabled').notNull().default(false),
});
