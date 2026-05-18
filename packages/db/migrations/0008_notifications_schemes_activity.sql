-- 0008_notifications_schemes_activity.sql
--
-- Wave 2/3 foundations:
--
--   1. notification — queue of outbound emails/WhatsApp/SMS. Rows start as
--      'pending' and a worker flips them to 'sent' / 'failed'. Deduplication
--      key prevents the renewal cron from sending the same reminder twice
--      if the cron runs twice on the same day.
--   2. user_scheme — per-user cached match + enrollment tracking for govt
--      schemes (Idea 3). One row per (user_id, scheme_slug). Status is a
--      free-form column (not enum) so ops can coin statuses without a
--      migration dance.
--   3. v_user_activity — unioned timeline over analyses/policies/chat/
--      notifications/feedback, normalised so /my/activity can render one
--      ordered list without N+1.

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. notification
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists notification (
  id                uuid primary key default gen_random_uuid(),
  tenant_id         text not null,
  user_id           uuid not null references app_user(id) on delete cascade,
  /* 'email' | 'whatsapp' | 'sms' */
  channel           text not null,
  /* 'renewal_reminder' | 'analysis_ready' | 'claim_deadline' | 'new_scheme' | 'welcome' */
  kind              text not null,
  /* toAddress is resolved per-channel: email for 'email', phone for SMS/WA.
     Snapshotted so later profile edits don't retroactively change history. */
  to_address        text not null,
  subject           text,
  body_text         text not null,
  body_html         text,
  /* Deduplication key — set by the sender based on the action, e.g.
     "renewal:<policy_id>:14d". UNIQUE constraint below makes second sends
     a no-op which keeps cron safe to re-run. */
  dedupe_key        text,
  status            text not null default 'pending' check (status in ('pending', 'sent', 'failed', 'skipped')),
  sent_at           timestamptz,
  attempts          int not null default 0,
  last_error        text,
  related_policy_id uuid references policy(id) on delete set null,
  related_analysis_id uuid references policy_analysis(id) on delete set null,
  related_case_id   uuid references "case"(id) on delete set null,
  metadata          jsonb not null default '{}'::jsonb,
  scheduled_for     timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index if not exists notification_pending_idx
  on notification (scheduled_for) where status = 'pending';
create index if not exists notification_user_idx on notification (user_id, created_at desc);
create unique index if not exists notification_dedupe_idx
  on notification (user_id, dedupe_key) where dedupe_key is not null;

alter table notification enable row level security;
create policy notification_read on notification for select
  using (user_id = auth_user_id() or auth_role() in ('super_admin', 'admin'));
create policy notification_insert on notification for insert with check (true); -- service role only in practice
create policy notification_update on notification for update
  using (auth_role() in ('super_admin', 'admin'));

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. user_scheme — per-user scheme match + enrollment
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists user_scheme (
  id                 uuid primary key default gen_random_uuid(),
  tenant_id          text not null,
  user_id            uuid not null references app_user(id) on delete cascade,
  /* FK is text because scheme.id is a slug like 'pm-jay' */
  scheme_id          text not null references scheme(id) on delete cascade,
  /* 'eligible' | 'possibly_eligible' | 'not_eligible' — mirrors agent output */
  match_status       text not null,
  match_reason       text,
  /* 'not_started' | 'in_progress' | 'enrolled' | 'renewed' | 'lapsed' */
  enrollment_status  text not null default 'not_started',
  enrollment_notes   text,
  last_matched_at    timestamptz not null default now(),
  last_reviewed_at   timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index if not exists user_scheme_user_scheme_idx on user_scheme (user_id, scheme_id);
create index if not exists user_scheme_status_idx on user_scheme (user_id, enrollment_status);

alter table user_scheme enable row level security;
create policy user_scheme_owner on user_scheme for all
  using (user_id = auth_user_id() or auth_role() = 'super_admin')
  with check (user_id = auth_user_id() or auth_role() = 'super_admin');

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. v_user_activity — unioned timeline
-- ─────────────────────────────────────────────────────────────────────────────
-- Source-agnostic row shape: (kind, occurred_at, subject, detail, ref_id).
-- /my/activity just orders by occurred_at desc and renders.
create or replace view v_user_activity as
  select
    pa.user_id,
    'analysis_created'::text as kind,
    pa.created_at             as occurred_at,
    concat('Analysed policy: ', coalesce(pa.report_json->'extractor'->'basic_facts'->>'insurer_name', 'unknown insurer')) as subject,
    coalesce(pa.error_message, pa.progress_step, pa.status::text) as detail,
    pa.id::text                as ref_id
  from policy_analysis pa
  where pa.user_id is not null

  union all

  select
    p.user_id,
    'policy_linked'::text,
    p.created_at,
    concat('Linked policy: ', p.insurer_name, coalesce(' · ' || (p.metadata->>'plan_name'), '')),
    concat('Policy #', p.policy_number),
    p.id::text
  from policy p

  union all

  select
    cm.user_id,
    'chat_message'::text,
    cm.created_at,
    concat(initcap(cm.role), ' asked about an analysis'),
    left(cm.content, 200),
    cm.id::text
  from chat_message cm
  where cm.user_id is not null

  union all

  select
    n.user_id,
    'notification_sent'::text,
    coalesce(n.sent_at, n.created_at),
    concat(initcap(n.channel), ': ', n.kind),
    coalesce(n.subject, n.body_text),
    n.id::text
  from notification n
  where n.status = 'sent'

  union all

  select
    uf.user_id,
    'feedback_given'::text,
    uf.created_at,
    concat('Rated ', replace(uf.target, '_', ' ')),
    coalesce(uf.note, case when uf.rating = 1 then '👍' when uf.rating = -1 then '👎' else '—' end),
    uf.id::text
  from user_feedback uf
  where uf.user_id is not null;
