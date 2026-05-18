-- 0009_family_member_status.sql
--
-- Family members can now be auto-proposed from a policy analysis. Those
-- proposals land as drafts (status='draft') so the user can confirm, edit,
-- or reject before the member joins the canonical family graph.
--
--   status : 'draft' | 'confirmed' — only confirmed members feed into
--            coverage / scheme matching / dashboard.
--   source : free-form provenance string — 'manual' for user-added, or
--            'analysis:<policy_analysis_id>' for agent-proposed drafts.
--            Lets the UI show "proposed from your ACKO analysis on 23 Apr".

alter table family_member
  add column if not exists status text not null default 'confirmed',
  add column if not exists source text not null default 'manual',
  add column if not exists source_analysis_id uuid references policy_analysis(id) on delete set null;

-- Index so /my/family can filter drafts fast on page load.
create index if not exists family_member_status_idx on family_member (user_id, status);

-- The primary-member unique index must only apply to confirmed rows —
-- otherwise a draft "self" would collide with an existing confirmed "self".
-- Replace with a tighter partial index.
drop index if exists family_member_primary_idx;
create unique index if not exists family_member_primary_idx
  on family_member (user_id)
  where is_primary = true and status = 'confirmed';
