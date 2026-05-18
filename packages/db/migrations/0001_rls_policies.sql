-- 0001_rls_policies.sql
--
-- Enable Row-Level Security on every business table and define policies.
-- See ADR-0004.
--
-- Principles:
--   * Tables with tenant_id: readable + writable only when JWT tenant_id matches.
--   * Reference tables (insurance_line, product_module, scheme, locale, affiliate_partner,
--     feature_flag, agent_definition): read-anonymous, write-admin-only.
--   * Audit log is insert-only from app roles; only super_admin can SELECT.
--   * Service role always bypasses RLS (Supabase default).
--
-- The `authenticated` Postgres role is assumed to carry JWT claims via the
-- `request.jwt.claim.*` session-config pattern used by Supabase.

-------------------------------------------------------------------------------
-- Helper functions
-------------------------------------------------------------------------------

create or replace function auth_tenant_id()
returns text
language sql
stable
as $$
  select current_setting('request.jwt.claim.tenant_id', true)
$$;

create or replace function auth_user_id()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

create or replace function auth_role()
returns text
language sql
stable
as $$
  select coalesce(current_setting('request.jwt.claim.role', true), 'anon')
$$;

create or replace function is_admin_role()
returns boolean
language sql
stable
as $$
  select auth_role() in ('super_admin', 'admin', 'case_manager', 'content_editor', 'cx_agent', 'viewer', 'reviewer')
$$;

-------------------------------------------------------------------------------
-- Tenant-scoped business tables
-------------------------------------------------------------------------------

-- policy
alter table "policy" enable row level security;
create policy policy_tenant_rw on "policy"
  for all
  using (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

-- case
alter table "case" enable row level security;
create policy case_tenant_rw on "case"
  for all
  using (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

-- case_event
alter table "case_event" enable row level security;
create policy case_event_tenant_rw on "case_event"
  for all
  using (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

-- document
alter table "document" enable row level security;
create policy document_tenant_rw on "document"
  for all
  using (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

-- agent_run
alter table "agent_run" enable row level security;
create policy agent_run_tenant_rw on "agent_run"
  for all
  using (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

-- review_task
alter table "review_task" enable row level security;
create policy review_task_tenant_rw on "review_task"
  for all
  using (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

-- entitlement
alter table "entitlement" enable row level security;
create policy entitlement_tenant_rw on "entitlement"
  for all
  using (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

-- subscription
alter table "subscription" enable row level security;
create policy subscription_tenant_rw on "subscription"
  for all
  using (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

-- payment
alter table "payment" enable row level security;
create policy payment_tenant_rw on "payment"
  for all
  using (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

-- affiliate_click
alter table "affiliate_click" enable row level security;
create policy affiliate_click_tenant_rw on "affiliate_click"
  for all
  using (tenant_id = auth_tenant_id() or auth_tenant_id() is null) -- anonymous clicks allowed
  with check (tenant_id = auth_tenant_id());

-- consent
alter table "consent" enable row level security;
create policy consent_tenant_rw on "consent"
  for all
  using (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

-- dpdp_request
alter table "dpdp_request" enable row level security;
create policy dpdp_request_tenant_rw on "dpdp_request"
  for all
  using (tenant_id = auth_tenant_id())
  with check (tenant_id = auth_tenant_id());

-- audit_log: INSERT allowed by any authenticated caller into their tenant; SELECT only super_admin.
alter table "audit_log" enable row level security;
create policy audit_log_insert on "audit_log"
  for insert
  with check (tenant_id = auth_tenant_id());
create policy audit_log_select on "audit_log"
  for select
  using (auth_role() = 'super_admin');

-------------------------------------------------------------------------------
-- Tenancy tables
-------------------------------------------------------------------------------

alter table "tenant" enable row level security;
create policy tenant_select_self on "tenant"
  for select
  using (id = auth_tenant_id() or auth_role() = 'super_admin');

alter table "membership" enable row level security;
create policy membership_select_self on "membership"
  for select
  using (tenant_id = auth_tenant_id() or user_id = auth_user_id());
create policy membership_write_admin on "membership"
  for all
  using (tenant_id = auth_tenant_id() and auth_role() in ('super_admin', 'admin'))
  with check (tenant_id = auth_tenant_id() and auth_role() in ('super_admin', 'admin'));

alter table "app_user" enable row level security;
create policy app_user_self on "app_user"
  for all
  using (id = auth_user_id() or auth_role() in ('super_admin', 'admin', 'cx_agent'))
  with check (id = auth_user_id() or auth_role() in ('super_admin', 'admin'));

-------------------------------------------------------------------------------
-- Reference / catalog tables (read-anonymous, write-admin)
-------------------------------------------------------------------------------

alter table "insurance_line" enable row level security;
create policy insurance_line_read on "insurance_line" for select using (true);
create policy insurance_line_write on "insurance_line"
  for all using (auth_role() in ('super_admin', 'content_editor'))
  with check (auth_role() in ('super_admin', 'content_editor'));

alter table "product_module" enable row level security;
create policy product_module_read on "product_module" for select using (true);
create policy product_module_write on "product_module"
  for all using (auth_role() in ('super_admin', 'content_editor'))
  with check (auth_role() in ('super_admin', 'content_editor'));

alter table "scheme" enable row level security;
create policy scheme_read on "scheme" for select using (true);
create policy scheme_write on "scheme"
  for all using (auth_role() in ('super_admin', 'content_editor'))
  with check (auth_role() in ('super_admin', 'content_editor'));

alter table "intake_flow" enable row level security;
create policy intake_flow_read on "intake_flow" for select using (true);
create policy intake_flow_write on "intake_flow"
  for all using (auth_role() in ('super_admin', 'content_editor'))
  with check (auth_role() in ('super_admin', 'content_editor'));

alter table "locale_meta" enable row level security;
create policy locale_read on "locale_meta" for select using (true);
create policy locale_write on "locale_meta"
  for all using (auth_role() in ('super_admin', 'content_editor'))
  with check (auth_role() in ('super_admin', 'content_editor'));

alter table "agent_definition" enable row level security;
create policy agent_definition_read on "agent_definition" for select using (true);
create policy agent_definition_write on "agent_definition"
  for all using (auth_role() in ('super_admin', 'content_editor'))
  with check (auth_role() in ('super_admin', 'content_editor'));

alter table "feature_flag" enable row level security;
create policy feature_flag_read on "feature_flag" for select using (true);
create policy feature_flag_write on "feature_flag"
  for all using (auth_role() in ('super_admin', 'admin'))
  with check (auth_role() in ('super_admin', 'admin'));

alter table "affiliate_partner" enable row level security;
create policy affiliate_partner_read on "affiliate_partner" for select using (true);
create policy affiliate_partner_write on "affiliate_partner"
  for all using (auth_role() in ('super_admin', 'content_editor'))
  with check (auth_role() in ('super_admin', 'content_editor'));
