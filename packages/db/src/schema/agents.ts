import { pgTable, text, uuid, integer, jsonb, boolean, real, timestamp, index } from 'drizzle-orm/pg-core';
import {
  agentOutcomeEnum,
  createdAt,
  modelTierEnum,
  tenantIdCol,
} from './_shared';

/**
 * Agent registry. One row per (slug, version). See ADR-0005.
 * Editing a prompt = insert a new version row, flip `isDefault` when promoting.
 */
export const agentDefinition = pgTable(
  'agent_definition',
  {
    slug: text('slug').notNull(),                 // e.g. "rejection-classifier"
    version: integer('version').notNull(),
    displayName: text('display_name').notNull(),
    purpose: text('purpose').notNull(),
    modelTier: modelTierEnum('model_tier').notNull(),
    /** Optional override of the LLM provider for this agent.
     *  null → 'gemini' (default). 'anthropic' routes through the Claude SDK
     *  path. Settable from the admin per-agent editor — see /agents/[slug]. */
    provider: text('provider'),
    /** Optional pinned model id for this agent (e.g. `gemini-2.5-flash`,
     *  `claude-sonnet-4-6`). When set, bypasses the modelTier → models
     *  mapping in router.ts and pins the agent to exactly this model.
     *  null → use the tier default. Admin-editable. */
    modelOverride: text('model_override'),
    systemPrompt: text('system_prompt').notNull(),
    tools: text('tools').array().notNull().default([]),
    temperature: real('temperature').notNull().default(0.2),
    maxTokens: integer('max_tokens').notNull().default(4096),
    reviewRequired: boolean('review_required').notNull().default(false),
    enabled: boolean('enabled').notNull().default(true),
    isDefault: boolean('is_default').notNull().default(false),
    localesSupported: text('locales_supported').array().notNull().default([]),
    /** JSON Schema describing the shape of an expected golden-case output for
     *  this agent. Read by the synthetic-dataset builder to auto-generate
     *  expected-fields forms. Optional during rollout. */
    expectedOutputSchema: jsonb('expected_output_schema').$type<Record<string, unknown>>(),
    createdAt,
  },
  (t) => ({
    pk: index('agent_definition_slug_version_idx').on(t.slug, t.version),
    byDefault: index('agent_definition_default_idx').on(t.slug, t.isDefault),
  }),
);

/**
 * Every agent invocation persists here. Full audit + cost accounting + replay.
 *
 * Two independent dimensions classify each run:
 *   * runSource — 'customer_upload' (real or UAT-test customer) | 'eval_lab'
 *                 (admin Run/Run-batch/Run-judge in the Eval Lab). The Eval
 *                 Lab UI badges + filters on this.
 *   * deployEnv — 'prod' | 'uat' | 'local'. Resolved from APP_ENV /
 *                 VERCEL_ENV at insert time.
 *
 * batchRunId / goldenCaseId are populated only for runSource='eval_lab' runs.
 */
export const agentRun = pgTable(
  'agent_run',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    userId: uuid('user_id'),                      // null = system-initiated
    caseId: uuid('case_id'),
    /** policy_analysis.id when the run came from the analyse flow. Lets
     *  the admin UI list every agent_run that contributed to one analysis
     *  without time-window heuristics. Null for cases-only runs. */
    analysisId: uuid('analysis_id'),
    agentSlug: text('agent_slug').notNull(),
    agentVersion: integer('agent_version').notNull(),
    parentRunId: uuid('parent_run_id'),
    /** 'customer_upload' | 'eval_lab' — see file header. */
    runSource: text('run_source').notNull().default('customer_upload'),
    /** 'prod' | 'uat' | 'local' — see file header. */
    deployEnv: text('deploy_env').notNull().default('prod'),
    batchRunId: uuid('batch_run_id'),
    goldenCaseId: uuid('golden_case_id'),
    inputSummary: text('input_summary').notNull(),
    attachedDocumentIds: uuid('attached_document_ids').array().notNull().default([]),
    outputJson: jsonb('output_json').$type<unknown>(),
    confidence: real('confidence'),
    outcome: agentOutcomeEnum('outcome').notNull(),
    modelUsed: text('model_used').notNull(),      // full model id
    promptTokens: integer('prompt_tokens').notNull(),
    completionTokens: integer('completion_tokens').notNull(),
    cachedTokens: integer('cached_tokens').notNull().default(0),
    costPaise: integer('cost_paise').notNull(),
    latencyMs: integer('latency_ms').notNull(),
    userVisibleSummary: text('user_visible_summary'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }).notNull(),
    createdAt,
  },
  (t) => ({
    byCase: index('agent_run_case_idx').on(t.caseId, t.startedAt),
    byAnalysis: index('agent_run_analysis_idx').on(t.analysisId, t.startedAt),
    byTenant: index('agent_run_tenant_idx').on(t.tenantId, t.startedAt),
    byAgent: index('agent_run_agent_idx').on(t.agentSlug, t.startedAt),
    bySourceStarted: index('agent_run_source_started_idx').on(t.runSource, t.startedAt),
    bySourceAgent: index('agent_run_source_agent_idx').on(t.runSource, t.agentSlug, t.startedAt),
    byBatch: index('agent_run_batch_idx').on(t.batchRunId),
    byGolden: index('agent_run_golden_idx').on(t.goldenCaseId),
  }),
);

/**
 * Human-in-the-loop review queue for agent outputs. See ADR-0005.
 * Any agent with `reviewRequired=true` generates a row here; the admin portal renders the queue.
 */
export const reviewTask = pgTable(
  'review_task',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    agentRunId: uuid('agent_run_id').notNull().references(() => agentRun.id, { onDelete: 'cascade' }),
    caseId: uuid('case_id'),
    status: text('status').notNull().default('pending'), // pending | approved | changes_requested | rejected
    assignedTo: uuid('assigned_to'),
    decision: jsonb('decision').$type<Record<string, unknown>>(),
    decidedBy: uuid('decided_by'),
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    createdAt,
  },
  (t) => ({
    byStatus: index('review_task_status_idx').on(t.status, t.createdAt),
    byAssignee: index('review_task_assignee_idx').on(t.assignedTo),
  }),
);
