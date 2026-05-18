import {
  pgTable,
  text,
  uuid,
  integer,
  smallint,
  boolean,
  jsonb,
  timestamp,
  numeric,
  date,
  unique,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { createdAt, updatedAt, tenantIdCol } from './_shared';
import { appUser } from './tenancy';
import { insuranceLine } from './catalog';
import { policyAnalysis, policyDocument } from './analyses';
import { chatMessage } from './chat';

/**
 * Thumbs / notes on any AI output. Anonymous browsers also write here — so
 * user_id is optional. `target` is a discriminator; `target_ref` carries the
 * sub-object id (e.g. coverage card id, red-flag id) when the rating is
 * narrower than a whole analysis.
 */
export const userFeedback = pgTable(
  'user_feedback',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    analysisId: uuid('analysis_id').references(() => policyAnalysis.id, { onDelete: 'cascade' }),
    chatMessageId: uuid('chat_message_id').references(() => chatMessage.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => appUser.id, { onDelete: 'set null' }),
    sessionToken: text('session_token'),
    /** 'analysis_overall' | 'coverage_card' | 'red_flag' | 'chat_message' | 'report_section' */
    target: text('target').notNull(),
    targetRef: text('target_ref'),
    /** -1 = thumbs-down, 0 = neutral/edited, 1 = thumbs-up */
    rating: smallint('rating').notNull(),
    note: text('note'),
    createdAt,
  },
  (t) => ({
    byAnalysis: index('user_feedback_analysis_idx').on(t.analysisId, t.createdAt),
    byTarget: index('user_feedback_target_idx').on(t.target, t.rating),
  }),
);

/**
 * Synthetic dataset — a group of golden cases generated from the same
 * template mix + seed. Re-running the generator with the same seed
 * deterministically reproduces every case (PDF + expected outputs).
 *
 * Manually-curated cases (uploaded redacted real PDFs) live as
 * eval_golden_case rows with dataset_id = null and synthetic = false.
 */
export const evalDataset = pgTable(
  'eval_dataset',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    insuranceLine: text('insurance_line')
      .notNull()
      .references(() => insuranceLine.id),
    templateMix: jsonb('template_mix').$type<Record<string, number>>().notNull(),
    seed: integer('seed').notNull(),
    caseCount: integer('case_count').notNull().default(0),
    createdBy: uuid('created_by'),
    createdAt,
    updatedAt,
  },
  (t) => ({
    byLine: index('eval_dataset_line_idx').on(t.insuranceLine),
    uniqName: uniqueIndex('eval_dataset_name_idx').on(t.name),
  }),
);

/**
 * Admin-curated + synthetic golden set. Each case carries expected outputs
 * for each agent in the v2 chain, so we can score real runs against them.
 *
 * Synthetic cases bind to an eval_dataset and carry seed + template_slug
 * so the generator can reproduce them deterministically.
 */
export const evalGoldenCase = pgTable(
  'eval_golden_case',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    name: text('name').notNull(),
    description: text('description'),
    datasetId: uuid('dataset_id').references(() => evalDataset.id, { onDelete: 'set null' }),
    insuranceLineId: text('insurance_line').references(() => insuranceLine.id),
    synthetic: boolean('synthetic').notNull().default(false),
    seed: integer('seed'),
    templateSlug: text('template_slug'),
    /** Set true when expected outputs are edited; eval_runs prior are dimmed in UI. */
    stale: boolean('stale').notNull().default(false),
    policyDocumentId: uuid('policy_document_id').references(() => policyDocument.id, {
      onDelete: 'restrict',
    }),
    demographicsJson: jsonb('demographics_json').$type<Record<string, unknown>>(),
    expectedExtraction: jsonb('expected_extraction').$type<Record<string, unknown>>(),
    expectedCoverage: jsonb('expected_coverage').$type<Record<string, unknown>>(),
    expectedChatQa: jsonb('expected_chat_qa').$type<Array<{ question: string; expected_answer: string }>>(),
    annotator: text('annotator'),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    enabled: boolean('enabled').notNull().default(true),
    tags: text('tags').array().notNull().default([]),
    createdAt,
    updatedAt,
  },
  (t) => ({
    byEnabled: index('eval_golden_case_enabled_idx').on(t.enabled),
    byDataset: index('eval_golden_case_dataset_idx').on(t.datasetId),
    byLine: index('eval_golden_case_line_idx').on(t.insuranceLineId),
  }),
);

/**
 * Editable LLM-judge prompt per agent. Admins can iterate on the rubric; each
 * edit produces a new version row, and exactly one row per agent_slug is
 * marked is_default = true.
 */
export const evalRubric = pgTable(
  'eval_rubric',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    agentSlug: text('agent_slug').notNull(),
    version: integer('version').notNull(),
    /** 'opus' | 'sonnet' | 'haiku' — provider-agnostic tier, resolved by agent-sdk router */
    judgeModelTier: text('judge_model_tier').notNull(),
    judgePrompt: text('judge_prompt').notNull(),
    outputSchema: jsonb('output_schema').$type<Record<string, unknown>>().notNull(),
    enabled: boolean('enabled').notNull().default(true),
    isDefault: boolean('is_default').notNull().default(false),
    changeNote: text('change_note'),
    createdBy: text('created_by'),
    createdAt,
  },
  (t) => ({
    byAgentVersion: unique('eval_rubric_agent_version_key').on(t.agentSlug, t.version),
    byDefault: index('eval_rubric_default_idx').on(t.agentSlug, t.isDefault),
  }),
);

/**
 * Every eval execution — nightly cron, manual run, or prod sample. Scores and
 * the judge's raw JSON output live here so the eval console can trend them.
 *
 * `runSource` materialises the parent agent_run's source for the subject of
 * the eval. Drives the dashboard's primary "Customer uploads" vs "Eval-lab
 * runs" split. SQL CHECK constraint binds: trigger='prod_sample' iff
 * runSource='customer_upload'.
 *
 * `deployEnv` is the deployment the eval itself ran in.
 */
export const evalRun = pgTable(
  'eval_run',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    /** 'nightly_cron' | 'manual' | 'manual_dataset' | 'manual_replay' | 'prod_sample' */
    trigger: text('trigger').notNull(),
    /** 'customer_upload' (over a real customer upload) | 'eval_lab' (over a synthetic case). */
    runSource: text('run_source').notNull().default('eval_lab'),
    /** 'prod' | 'uat' | 'local'. */
    deployEnv: text('deploy_env').notNull().default('prod'),
    goldenCaseId: uuid('golden_case_id').references(() => evalGoldenCase.id, { onDelete: 'set null' }),
    analysisId: uuid('analysis_id').references(() => policyAnalysis.id, { onDelete: 'set null' }),
    batchRunId: uuid('batch_run_id'),
    agentSlug: text('agent_slug').notNull(),
    agentVersion: integer('agent_version').notNull(),
    agentRunId: uuid('agent_run_id'),
    rubricId: uuid('rubric_id').references(() => evalRubric.id),
    judgeScoreJson: jsonb('judge_score_json').$type<Record<string, unknown>>(),
    qualityScore: integer('quality_score'),
    passed: boolean('passed'),
    costPaise: integer('cost_paise').notNull().default(0),
    latencyMs: integer('latency_ms'),
    errorMessage: text('error_message'),
    ranBy: text('ran_by'),
    createdAt,
  },
  (t) => ({
    byTrigger: index('eval_run_trigger_idx').on(t.trigger, t.createdAt),
    byAgent: index('eval_run_agent_idx').on(t.agentSlug, t.createdAt),
    byQuality: index('eval_run_quality_idx').on(t.qualityScore),
    bySource: index('eval_run_source_created_idx').on(t.runSource, t.createdAt),
    bySourceAgent: index('eval_run_source_agent_idx').on(t.runSource, t.agentSlug, t.createdAt),
    byBatch: index('eval_run_batch_idx').on(t.batchRunId),
  }),
);
