-- 0012 — Eval Lab schema
-- Adds platform infrastructure for synthetic dataset management, full agent
-- tracing (per LLM-call + per tool-call), DB-backed prod sampling with daily
-- caps, batch run orchestration, and trace-view audit logging.
--
-- Spec: docs/prd/01c-eval-lab.md (Decided 2026-04-25).
-- Idempotent — safe to re-run against partially-applied DB.
--
-- Two-axis run discriminator (resolved 2026-04-25 in conversation):
--   run_source  — 'customer_upload' | 'eval_lab'
--                  WHO triggered the run. Customer uploading a document
--                  (whether on prod or uat deploy) is 'customer_upload';
--                  admin clicking Run/Run-batch/Run-judge in the Eval Lab
--                  is 'eval_lab'. This is the dimension the Eval Lab UI
--                  filters on by default.
--   deploy_env  — 'prod' | 'uat' | 'local'
--                  WHICH deployment the run executed in. Independent of
--                  source. Useful for cost dashboards and incident triage.

-- ===== eval_dataset =================================================
-- Group of synthetic golden cases generated from the same template mix +
-- seed. Re-running the generator with the same seed reproduces identical
-- PDFs and expected outputs (deterministic).

CREATE TABLE IF NOT EXISTS "eval_dataset" (
  "id"             uuid    PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "name"           text    NOT NULL,
  "description"    text,
  "insurance_line" text    NOT NULL REFERENCES "insurance_line"("id"),
  "template_mix"   jsonb   NOT NULL,
  "seed"           integer NOT NULL,
  "case_count"     integer NOT NULL DEFAULT 0,
  "created_by"     uuid,
  "created_at"     timestamp with time zone NOT NULL DEFAULT now(),
  "updated_at"     timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eval_dataset_line_idx"
  ON "eval_dataset" USING btree ("insurance_line");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "eval_dataset_name_idx"
  ON "eval_dataset" USING btree ("name");
--> statement-breakpoint

-- ===== eval_golden_case column adds =================================

ALTER TABLE "eval_golden_case"
  ADD COLUMN IF NOT EXISTS "dataset_id"     uuid REFERENCES "eval_dataset"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "eval_golden_case"
  ADD COLUMN IF NOT EXISTS "synthetic"      boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "eval_golden_case"
  ADD COLUMN IF NOT EXISTS "seed"           integer;
--> statement-breakpoint
ALTER TABLE "eval_golden_case"
  ADD COLUMN IF NOT EXISTS "template_slug"  text;
--> statement-breakpoint
ALTER TABLE "eval_golden_case"
  ADD COLUMN IF NOT EXISTS "stale"          boolean NOT NULL DEFAULT false;
--> statement-breakpoint
ALTER TABLE "eval_golden_case"
  ADD COLUMN IF NOT EXISTS "insurance_line" text REFERENCES "insurance_line"("id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eval_golden_case_dataset_idx"
  ON "eval_golden_case" USING btree ("dataset_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eval_golden_case_line_idx"
  ON "eval_golden_case" USING btree ("insurance_line");
--> statement-breakpoint

-- ===== agent_run_step ===============================================
-- Per-LLM-call + per-tool-call trace inside an agent_run. Prompt and
-- completion text already PII-scrubbed via redactForModelContext before
-- persistence (see CLAUDE.md §7 DPDP). 50 KB cap enforced at app layer.
--
-- run_source + deploy_env are denormalised from the parent agent_run for
-- fast trace filtering (no join required for "show me only eval_lab
-- traces" or "only uat-deploy traces").

CREATE TABLE IF NOT EXISTS "agent_run_step" (
  "id"                            uuid    PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "tenant_id"                     text    NOT NULL,
  "agent_run_id"                  uuid    NOT NULL REFERENCES "agent_run"("id") ON DELETE CASCADE,
  "step_index"                    integer NOT NULL,
  "kind"                          text    NOT NULL,        -- 'llm_call' | 'tool_call'
  "model_id"                      text,
  "tool_name"                     text,
  "input_tokens"                  integer,
  "output_tokens"                 integer,
  "cache_creation_input_tokens"   integer,
  "cache_read_input_tokens"       integer,
  "cost_paise"                    integer NOT NULL DEFAULT 0,
  "latency_ms"                    integer,
  "prompt_redacted"               text,
  "completion_redacted"           text,
  "tool_args_json"                jsonb,
  "tool_result_json"              jsonb,
  "error_message"                 text,
  "started_at"                    timestamp with time zone NOT NULL,
  "ended_at"                      timestamp with time zone,
  "run_source"                    text    NOT NULL DEFAULT 'customer_upload',
  "deploy_env"                    text    NOT NULL DEFAULT 'prod',
  CONSTRAINT agent_run_step_kind_chk       CHECK (kind IN ('llm_call','tool_call')),
  CONSTRAINT agent_run_step_run_source_chk CHECK (run_source IN ('customer_upload','eval_lab')),
  CONSTRAINT agent_run_step_deploy_env_chk CHECK (deploy_env IN ('prod','uat','local'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "agent_run_step_run_index_idx"
  ON "agent_run_step" USING btree ("agent_run_id", "step_index");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_run_step_run_started_idx"
  ON "agent_run_step" USING btree ("agent_run_id", "started_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_run_step_kind_idx"
  ON "agent_run_step" USING btree ("kind", "started_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_run_step_source_idx"
  ON "agent_run_step" USING btree ("run_source", "started_at");
--> statement-breakpoint

-- ===== eval_sampling_policy =========================================
-- DB-backed replacement for env-var-controlled prod sampling rates.
-- spend_today_paise is reset daily by /api/eval/cron/daily-reset.

CREATE TABLE IF NOT EXISTS "eval_sampling_policy" (
  "agent_slug"          text          PRIMARY KEY,
  "rate_pct"            numeric(5, 2) NOT NULL DEFAULT 0,
  "daily_cap_paise"     integer       NOT NULL DEFAULT 50000,    -- ₹500 default
  "spend_today_paise"   integer       NOT NULL DEFAULT 0,
  "spend_day_key"       date          NOT NULL DEFAULT current_date,
  "enabled"             boolean       NOT NULL DEFAULT true,
  "updated_by"          uuid,
  "updated_at"          timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT eval_sampling_policy_rate_chk CHECK (rate_pct >= 0 AND rate_pct <= 100),
  CONSTRAINT eval_sampling_policy_cap_chk  CHECK (daily_cap_paise >= 0)
);
--> statement-breakpoint

-- ===== eval_batch_run ===============================================
-- One row per "Run dataset on agent" job. Status transitions:
--   queued -> running -> (completed | cancelled | failed)
-- trigger_run_id is null until the runtime (Trigger.dev or local worker)
-- has accepted the job. Batch runs are always run_source='eval_lab'.

CREATE TABLE IF NOT EXISTS "eval_batch_run" (
  "id"                     uuid    PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "dataset_id"             uuid    NOT NULL REFERENCES "eval_dataset"("id") ON DELETE CASCADE,
  "agent_slug"             text    NOT NULL,
  "agent_version"          integer NOT NULL,
  "trigger_run_id"         text,
  "status"                 text    NOT NULL DEFAULT 'queued',
  "total_cases"            integer NOT NULL,
  "completed_cases"        integer NOT NULL DEFAULT 0,
  "failed_cases"           integer NOT NULL DEFAULT 0,
  "estimated_cost_paise"   integer NOT NULL DEFAULT 0,
  "actual_cost_paise"      integer NOT NULL DEFAULT 0,
  "started_by"             uuid,
  "cancellation_requested" boolean NOT NULL DEFAULT false,
  "started_at"             timestamp with time zone NOT NULL DEFAULT now(),
  "ended_at"               timestamp with time zone,
  "deploy_env"             text    NOT NULL DEFAULT 'prod',
  CONSTRAINT eval_batch_run_status_chk     CHECK (status IN ('queued','running','completed','cancelled','failed')),
  CONSTRAINT eval_batch_run_deploy_env_chk CHECK (deploy_env IN ('prod','uat','local'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eval_batch_run_dataset_idx"
  ON "eval_batch_run" USING btree ("dataset_id", "started_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eval_batch_run_status_idx"
  ON "eval_batch_run" USING btree ("status");
--> statement-breakpoint

-- ===== eval_run column adds =========================================
-- batch_run_id binds an eval_run to its parent batch (when applicable).
--
-- run_source materialises the parent agent_run's run_source for the
-- subject of the eval. Drives the dashboard's primary "Customer uploads"
-- vs "Eval-lab runs" split. Constraint: prod_sample evals must be over
-- customer_upload runs; everything else over eval_lab runs.
--
-- deploy_env is the deployment the eval itself ran in. Often differs
-- from the subject's deploy_env (e.g. nightly cron in prod over a
-- customer_upload run captured earlier).

ALTER TABLE "eval_run"
  ADD COLUMN IF NOT EXISTS "batch_run_id" uuid REFERENCES "eval_batch_run"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "eval_run"
  ADD COLUMN IF NOT EXISTS "run_source" text NOT NULL DEFAULT 'eval_lab';
--> statement-breakpoint
ALTER TABLE "eval_run"
  ADD COLUMN IF NOT EXISTS "deploy_env" text NOT NULL DEFAULT 'prod';
--> statement-breakpoint
-- Backfill: trigger='prod_sample' rows are evals over customer_upload runs.
UPDATE "eval_run" SET "run_source" = 'customer_upload'
  WHERE "trigger" = 'prod_sample' AND "run_source" <> 'customer_upload';
--> statement-breakpoint
ALTER TABLE "eval_run"
  ADD CONSTRAINT eval_run_run_source_chk CHECK (run_source IN ('customer_upload','eval_lab'));
--> statement-breakpoint
ALTER TABLE "eval_run"
  ADD CONSTRAINT eval_run_deploy_env_chk CHECK (deploy_env IN ('prod','uat','local'));
--> statement-breakpoint
ALTER TABLE "eval_run"
  ADD CONSTRAINT eval_run_source_trigger_consistency_chk CHECK (
    (trigger = 'prod_sample' AND run_source = 'customer_upload')
    OR (trigger <> 'prod_sample' AND run_source = 'eval_lab')
  );
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eval_run_batch_idx"
  ON "eval_run" USING btree ("batch_run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eval_run_source_created_idx"
  ON "eval_run" USING btree ("run_source", "created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "eval_run_source_agent_idx"
  ON "eval_run" USING btree ("run_source", "agent_slug", "created_at");
--> statement-breakpoint

-- ===== agent_definition column add ==================================
-- Per-agent expected-output JSON Schema. Dataset builder reads this to
-- know which fields a golden case must populate. New agents drop in by
-- registering their schema; the dataset UI auto-generates form fields.

ALTER TABLE "agent_definition"
  ADD COLUMN IF NOT EXISTS "expected_output_schema" jsonb;
--> statement-breakpoint

-- ===== agent_run column adds ========================================
-- run_source is the unambiguous customer-vs-admin discriminator. A
-- customer_upload run was triggered by a real (or UAT-test-) customer
-- uploading a document via any web-customer surface. An eval_lab run
-- came from the admin clicking Run/Run-batch/Run-judge in the Eval Lab.
--
-- deploy_env is independent and captures which deployment executed the
-- run; resolved at insert time from APP_ENV / VERCEL_ENV.
--
-- Existing rows are heuristically backfilled:
--   * parent_run_id IS NOT NULL  -> eval_lab (judge runs)
--   * everything else            -> customer_upload (the safe default)

ALTER TABLE "agent_run"
  ADD COLUMN IF NOT EXISTS "run_source"     text NOT NULL DEFAULT 'customer_upload';
--> statement-breakpoint
ALTER TABLE "agent_run"
  ADD COLUMN IF NOT EXISTS "deploy_env"     text NOT NULL DEFAULT 'prod';
--> statement-breakpoint
ALTER TABLE "agent_run"
  ADD COLUMN IF NOT EXISTS "batch_run_id"   uuid REFERENCES "eval_batch_run"("id") ON DELETE SET NULL;
--> statement-breakpoint
ALTER TABLE "agent_run"
  ADD COLUMN IF NOT EXISTS "golden_case_id" uuid REFERENCES "eval_golden_case"("id") ON DELETE SET NULL;
--> statement-breakpoint
UPDATE "agent_run" SET "run_source" = 'eval_lab'
  WHERE "parent_run_id" IS NOT NULL AND "run_source" = 'customer_upload';
--> statement-breakpoint
ALTER TABLE "agent_run"
  ADD CONSTRAINT agent_run_run_source_chk CHECK (run_source IN ('customer_upload','eval_lab'));
--> statement-breakpoint
ALTER TABLE "agent_run"
  ADD CONSTRAINT agent_run_deploy_env_chk CHECK (deploy_env IN ('prod','uat','local'));
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_run_source_started_idx"
  ON "agent_run" USING btree ("run_source", "started_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_run_source_agent_idx"
  ON "agent_run" USING btree ("run_source", "agent_slug", "started_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_run_batch_idx"
  ON "agent_run" USING btree ("batch_run_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_run_golden_idx"
  ON "agent_run" USING btree ("golden_case_id");
--> statement-breakpoint

-- ===== trace_view_audit =============================================
-- One row per GET /evals/traces/[runId]. Traces contain redacted-but-
-- still-sensitive content; admin-role-only access alone is not enough.

CREATE TABLE IF NOT EXISTS "trace_view_audit" (
  "id"             uuid    PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "admin_id"       uuid    NOT NULL,
  "agent_run_id"   uuid    NOT NULL REFERENCES "agent_run"("id") ON DELETE CASCADE,
  "viewed_at"      timestamp with time zone NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trace_view_audit_run_idx"
  ON "trace_view_audit" USING btree ("agent_run_id", "viewed_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "trace_view_audit_admin_idx"
  ON "trace_view_audit" USING btree ("admin_id", "viewed_at");
--> statement-breakpoint

-- ===== RLS ==========================================================
-- All Eval Lab tables: admin/super_admin read+write only.

ALTER TABLE "eval_dataset" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY eval_dataset_read ON "eval_dataset"
  FOR SELECT USING (auth_role() IN ('super_admin','admin'));
--> statement-breakpoint
CREATE POLICY eval_dataset_write ON "eval_dataset"
  FOR ALL USING (auth_role() IN ('super_admin','admin'))
  WITH CHECK (auth_role() IN ('super_admin','admin'));
--> statement-breakpoint

ALTER TABLE "agent_run_step" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY agent_run_step_read ON "agent_run_step"
  FOR SELECT USING (auth_role() IN ('super_admin','admin'));
--> statement-breakpoint
CREATE POLICY agent_run_step_write ON "agent_run_step"
  FOR ALL USING (auth_role() IN ('super_admin','admin'))
  WITH CHECK (auth_role() IN ('super_admin','admin'));
--> statement-breakpoint

ALTER TABLE "eval_sampling_policy" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY eval_sampling_policy_read ON "eval_sampling_policy"
  FOR SELECT USING (auth_role() IN ('super_admin','admin'));
--> statement-breakpoint
CREATE POLICY eval_sampling_policy_write ON "eval_sampling_policy"
  FOR ALL USING (auth_role() IN ('super_admin','admin'))
  WITH CHECK (auth_role() IN ('super_admin','admin'));
--> statement-breakpoint

ALTER TABLE "eval_batch_run" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY eval_batch_run_read ON "eval_batch_run"
  FOR SELECT USING (auth_role() IN ('super_admin','admin'));
--> statement-breakpoint
CREATE POLICY eval_batch_run_write ON "eval_batch_run"
  FOR ALL USING (auth_role() IN ('super_admin','admin'))
  WITH CHECK (auth_role() IN ('super_admin','admin'));
--> statement-breakpoint

ALTER TABLE "trace_view_audit" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY trace_view_audit_read ON "trace_view_audit"
  FOR SELECT USING (auth_role() IN ('super_admin','admin'));
--> statement-breakpoint
CREATE POLICY trace_view_audit_write ON "trace_view_audit"
  FOR INSERT WITH CHECK (auth_role() IN ('super_admin','admin'));
