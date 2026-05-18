import {
  pgTable,
  text,
  uuid,
  integer,
  jsonb,
  boolean,
  numeric,
  date,
  timestamp,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { tenantIdCol, createdAt } from './_shared';
import { agentRun } from './agents';
import { evalDataset } from './evals';

/**
 * Per-LLM-call + per-tool-call trace inside an agent_run. The trace viewer
 * (admin /evals/traces/[runId]) reads from here. Prompt + completion text
 * is already PII-scrubbed via redactForModelContext before persistence.
 *
 * runSource + deployEnv denormalised from the parent agent_run for fast
 * trace filtering. Set by the step recorder; never edited later.
 */
export const agentRunStep = pgTable(
  'agent_run_step',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    agentRunId: uuid('agent_run_id')
      .notNull()
      .references(() => agentRun.id, { onDelete: 'cascade' }),
    stepIndex: integer('step_index').notNull(),
    /** 'llm_call' | 'tool_call' */
    kind: text('kind').notNull(),
    modelId: text('model_id'),
    toolName: text('tool_name'),
    inputTokens: integer('input_tokens'),
    outputTokens: integer('output_tokens'),
    cacheCreationInputTokens: integer('cache_creation_input_tokens'),
    cacheReadInputTokens: integer('cache_read_input_tokens'),
    costPaise: integer('cost_paise').notNull().default(0),
    latencyMs: integer('latency_ms'),
    promptRedacted: text('prompt_redacted'),
    completionRedacted: text('completion_redacted'),
    toolArgsJson: jsonb('tool_args_json').$type<Record<string, unknown>>(),
    toolResultJson: jsonb('tool_result_json').$type<Record<string, unknown>>(),
    errorMessage: text('error_message'),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    runSource: text('run_source').notNull().default('customer_upload'),
    deployEnv: text('deploy_env').notNull().default('prod'),
  },
  (t) => ({
    uniqIndex: uniqueIndex('agent_run_step_run_index_idx').on(t.agentRunId, t.stepIndex),
    byRunStarted: index('agent_run_step_run_started_idx').on(t.agentRunId, t.startedAt),
    byKind: index('agent_run_step_kind_idx').on(t.kind, t.startedAt),
    bySource: index('agent_run_step_source_idx').on(t.runSource, t.startedAt),
  }),
);

/**
 * DB-backed prod sampling policy. Replaces env-var-controlled
 * PROD_SAMPLE_RATE_* with admin-editable rate% + daily cost cap per agent.
 * `spend_today_paise` is reset daily by /api/eval/cron/daily-reset.
 */
export const evalSamplingPolicy = pgTable('eval_sampling_policy', {
  agentSlug: text('agent_slug').primaryKey(),
  /** 0..100 */
  ratePct: numeric('rate_pct', { precision: 5, scale: 2 }).notNull().default('0'),
  dailyCapPaise: integer('daily_cap_paise').notNull().default(50000),
  spendTodayPaise: integer('spend_today_paise').notNull().default(0),
  /** IST date — set on insert, advanced by daily-reset cron. */
  spendDayKey: date('spend_day_key').notNull(),
  enabled: boolean('enabled').notNull().default(true),
  updatedBy: uuid('updated_by'),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * One row per "Run dataset on agent" job. Status:
 *   queued -> running -> (completed | cancelled | failed)
 * trigger_run_id is null until the runtime accepts the job. Always
 * runSource='eval_lab' (admin-initiated).
 */
export const evalBatchRun = pgTable(
  'eval_batch_run',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    datasetId: uuid('dataset_id')
      .notNull()
      .references(() => evalDataset.id, { onDelete: 'cascade' }),
    agentSlug: text('agent_slug').notNull(),
    agentVersion: integer('agent_version').notNull(),
    /** Trigger.dev run id once accepted (null while queued in-process). */
    triggerRunId: text('trigger_run_id'),
    /** 'queued' | 'running' | 'completed' | 'cancelled' | 'failed' */
    status: text('status').notNull().default('queued'),
    totalCases: integer('total_cases').notNull(),
    completedCases: integer('completed_cases').notNull().default(0),
    failedCases: integer('failed_cases').notNull().default(0),
    estimatedCostPaise: integer('estimated_cost_paise').notNull().default(0),
    actualCostPaise: integer('actual_cost_paise').notNull().default(0),
    startedBy: uuid('started_by'),
    cancellationRequested: boolean('cancellation_requested').notNull().default(false),
    startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
    endedAt: timestamp('ended_at', { withTimezone: true }),
    deployEnv: text('deploy_env').notNull().default('prod'),
  },
  (t) => ({
    byDataset: index('eval_batch_run_dataset_idx').on(t.datasetId, t.startedAt),
    byStatus: index('eval_batch_run_status_idx').on(t.status),
  }),
);

/**
 * One row per GET /evals/traces/[runId]. Traces contain redacted-but-
 * still-sensitive content (model prompts/completions, tool args). Admin-
 * role-only access alone is not sufficient — every view is logged for
 * DPDP audit.
 */
export const traceViewAudit = pgTable(
  'trace_view_audit',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    adminId: uuid('admin_id').notNull(),
    agentRunId: uuid('agent_run_id')
      .notNull()
      .references(() => agentRun.id, { onDelete: 'cascade' }),
    viewedAt: timestamp('viewed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    byRun: index('trace_view_audit_run_idx').on(t.agentRunId, t.viewedAt),
    byAdmin: index('trace_view_audit_admin_idx').on(t.adminId, t.viewedAt),
  }),
);
