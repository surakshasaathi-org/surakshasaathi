-- 0005_upload_event.sql
--
-- Per-IP / per-user upload events for anonymous rate limiting. Signed-in users
-- are already gated via policy_analysis.user_id counts; anonymous users have
-- no identity, so we record (ip, user_agent, created_at) per upload and count
-- within a rolling window.
--
-- Not a replacement for a proper WAF — a motivated abuser can cycle IPs. But
-- it raises the cost of casual spray and gives us ops visibility into bursts.

create table if not exists upload_event (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   text not null,
  user_id     uuid references app_user(id) on delete set null,
  analysis_id uuid references policy_analysis(id) on delete cascade,
  ip          inet,
  user_agent  text,
  created_at  timestamptz not null default now()
);

create index if not exists upload_event_ip_idx on upload_event (ip, created_at desc);
create index if not exists upload_event_user_idx on upload_event (user_id, created_at desc) where user_id is not null;

-- RLS: only super_admin + ops roles can read; inserts always allowed because
-- the service role writes during every upload, bypassing RLS.
alter table upload_event enable row level security;

create policy upload_event_read on upload_event for select
  using (auth_role() in ('super_admin', 'admin', 'viewer'));
create policy upload_event_insert on upload_event for insert with check (true);
