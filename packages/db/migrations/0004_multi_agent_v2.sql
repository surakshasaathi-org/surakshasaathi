-- 0004_multi_agent_v2.sql
--
-- Migration for the v2 multi-agent pipeline.
--
-- Additions:
--   1. policy_analysis.demographics_json — supplemental form input that refines Coverage
--   2. chat_message — persistent conversation history per analysis
--   3. user_feedback — thumbs/notes on analyses, coverage cards, chat messages
--   4. eval_golden_case — admin-curated test cases with expected outputs
--   5. eval_rubric — editable LLM-judge prompts per agent
--   6. eval_run — records every golden-set / prod-sample / manual eval execution
--
-- Intentionally NOT in this migration:
--   - ideal_coverage_rubric (scoring agent dropped; qualitative only)
--
-- RLS mirrors the analysis pattern: session-token OR user_id OR super_admin.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. policy_analysis.demographics_json
-- ─────────────────────────────────────────────────────────────────────────────
alter table policy_analysis
  add column if not exists demographics_json jsonb;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. chat_message
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists chat_message (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       text not null,
  analysis_id     uuid not null references policy_analysis(id) on delete cascade,
  user_id         uuid references app_user(id) on delete cascade,
  session_token   text not null,
  role            text not null check (role in ('user', 'assistant', 'system')),
  content         text not null,
  agent_run_id    uuid,
  token_count     int,
  created_at      timestamptz not null default now()
);

create index if not exists chat_message_analysis_idx on chat_message (analysis_id, created_at);
create index if not exists chat_message_user_idx on chat_message (user_id, created_at desc) where user_id is not null;

alter table chat_message enable row level security;

create policy chat_message_select on chat_message
  for select using (
    session_token() = session_token
    or (user_id is not null and user_id = auth_user_id())
    or auth_role() = 'super_admin'
  );

create policy chat_message_insert on chat_message
  for insert with check (true);

create policy chat_message_update on chat_message
  for update using (
    session_token() = session_token
    or (user_id is not null and user_id = auth_user_id())
    or auth_role() = 'super_admin'
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. user_feedback — thumbs + notes on any AI output
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists user_feedback (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       text not null,
  analysis_id     uuid references policy_analysis(id) on delete cascade,
  chat_message_id uuid references chat_message(id) on delete cascade,
  user_id         uuid references app_user(id) on delete set null,
  session_token   text,
  target          text not null check (target in (
    'analysis_overall',
    'coverage_card',
    'red_flag',
    'chat_message',
    'report_section'
  )),
  target_ref      text,
  rating          smallint not null check (rating in (-1, 0, 1)),
  note            text,
  created_at      timestamptz not null default now()
);

create index if not exists user_feedback_analysis_idx on user_feedback (analysis_id, created_at);
create index if not exists user_feedback_target_idx on user_feedback (target, rating);

alter table user_feedback enable row level security;
create policy user_feedback_insert on user_feedback for insert with check (true);
create policy user_feedback_select on user_feedback
  for select using (
    (user_id is not null and user_id = auth_user_id())
    or auth_role() in ('super_admin', 'admin', 'content_editor')
  );

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. eval_golden_case — admin-curated test set
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists eval_golden_case (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  description            text,
  policy_document_id     uuid references policy_document(id) on delete restrict,
  demographics_json      jsonb,
  expected_extraction    jsonb,
  expected_coverage      jsonb,
  expected_chat_qa       jsonb,
  annotator              text,
  verified_at            timestamptz,
  enabled                boolean not null default true,
  tags                   text[] not null default '{}',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists eval_golden_case_enabled_idx on eval_golden_case (enabled);

alter table eval_golden_case enable row level security;
create policy eval_golden_case_read on eval_golden_case for select
  using (auth_role() in ('super_admin', 'admin', 'content_editor', 'viewer'));
create policy eval_golden_case_write on eval_golden_case for all
  using (auth_role() in ('super_admin', 'admin', 'content_editor'))
  with check (auth_role() in ('super_admin', 'admin', 'content_editor'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. eval_rubric — editable LLM-judge prompts per agent
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists eval_rubric (
  id                uuid primary key default gen_random_uuid(),
  agent_slug        text not null,
  version           int not null,
  judge_model_tier  text not null check (judge_model_tier in ('opus', 'sonnet', 'haiku')),
  judge_prompt      text not null,
  output_schema     jsonb not null,
  enabled           boolean not null default true,
  is_default        boolean not null default false,
  change_note       text,
  created_by        text,
  created_at        timestamptz not null default now(),
  unique (agent_slug, version)
);

create index if not exists eval_rubric_default_idx on eval_rubric (agent_slug, is_default);

alter table eval_rubric enable row level security;
create policy eval_rubric_read on eval_rubric for select
  using (auth_role() in ('super_admin', 'admin', 'content_editor', 'viewer'));
create policy eval_rubric_write on eval_rubric for all
  using (auth_role() in ('super_admin', 'content_editor'))
  with check (auth_role() in ('super_admin', 'content_editor'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 6. eval_run — every eval execution
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists eval_run (
  id                  uuid primary key default gen_random_uuid(),
  tenant_id           text not null,
  trigger             text not null check (trigger in ('nightly_cron', 'manual', 'prod_sample')),
  golden_case_id      uuid references eval_golden_case(id) on delete set null,
  analysis_id         uuid references policy_analysis(id) on delete set null,
  agent_slug          text not null,
  agent_version       int not null,
  agent_run_id        uuid,
  rubric_id           uuid references eval_rubric(id),
  judge_score_json    jsonb,
  quality_score       int check (quality_score between 0 and 100),
  passed              boolean,
  cost_paise          int not null default 0,
  latency_ms          int,
  error_message       text,
  ran_by              text,
  created_at          timestamptz not null default now()
);

create index if not exists eval_run_trigger_idx on eval_run (trigger, created_at desc);
create index if not exists eval_run_agent_idx on eval_run (agent_slug, created_at desc);
create index if not exists eval_run_quality_idx on eval_run (quality_score) where quality_score is not null;

alter table eval_run enable row level security;
create policy eval_run_read on eval_run for select
  using (auth_role() in ('super_admin', 'admin', 'content_editor', 'viewer'));
create policy eval_run_insert on eval_run for insert with check (true);  -- background cron + prod-sample

-- Done.
