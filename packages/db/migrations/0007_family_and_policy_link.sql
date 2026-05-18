-- 0007_family_and_policy_link.sql
--
-- Wave-1 foundation for the logged-in experience:
--
--   1. family_member — persistent per-user family graph. Replaces the
--      per-analysis `demographics_json` as the canonical source. The
--      demographics column stays for historical analyses + anonymous flow.
--   2. policy_analysis.policy_id — links an analysis to the canonical
--      `policy` row (extracted insurer+policy_number, owned by user_id).
--      Enables multi-analysis-per-policy (year-over-year renewal tracking)
--      and the "My Policies" dashboard.
--
-- RLS mirrors the established pattern: owner match OR super_admin.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. family_member
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists family_member (
  id                     uuid primary key default gen_random_uuid(),
  tenant_id              text not null,
  user_id                uuid not null references app_user(id) on delete cascade,
  -- Relation to the account holder. Not an enum — we want "uncle", "ward",
  -- "live-in partner" without migration churn.
  relation               text not null,
  display_name           text not null,
  date_of_birth          date,
  gender                 text,
  pre_existing_conditions text[] not null default '{}',
  chronic_medications    text[] not null default '{}',
  ayushman_card_number   text,
  notes                  text,
  is_primary             boolean not null default false,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists family_member_user_idx on family_member (user_id, created_at);
-- Exactly one primary member per user — the account holder themselves.
create unique index if not exists family_member_primary_idx
  on family_member (user_id) where is_primary = true;

alter table family_member enable row level security;

create policy family_member_read on family_member for select
  using (user_id = auth_user_id() or auth_role() = 'super_admin');
create policy family_member_insert on family_member for insert
  with check (user_id = auth_user_id());
create policy family_member_update on family_member for update
  using (user_id = auth_user_id() or auth_role() = 'super_admin');
create policy family_member_delete on family_member for delete
  using (user_id = auth_user_id() or auth_role() = 'super_admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. policy_analysis.policy_id link
-- ─────────────────────────────────────────────────────────────────────────────
alter table policy_analysis
  add column if not exists policy_id uuid references policy(id) on delete set null;

create index if not exists policy_analysis_policy_idx
  on policy_analysis (policy_id) where policy_id is not null;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. Helper view — policy with latest analysis joined
-- ─────────────────────────────────────────────────────────────────────────────
-- Read-only view. UI can use this to render "My Policies" in one query instead
-- of N+1'ing a join. RLS on underlying tables governs access automatically.
create or replace view v_policy_with_latest_analysis as
select
  p.*,
  pa.id              as latest_analysis_id,
  pa.status          as latest_analysis_status,
  pa.created_at      as latest_analysis_at,
  pa.report_json     as latest_report
from policy p
left join lateral (
  select *
  from policy_analysis
  where policy_id = p.id
  order by created_at desc
  limit 1
) pa on true;
