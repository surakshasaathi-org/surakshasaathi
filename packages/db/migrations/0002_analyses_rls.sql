-- 0002_analyses_rls.sql
--
-- Row-Level Security for the anonymous policy-analysis flow.
--
-- Access model:
--   - Anyone can INSERT a new document + analysis (anonymous intake).
--   - Anyone can SELECT/UPDATE their own rows iff their cookie session-token
--     matches the row's session_token.
--   - Service role (background worker, admin) bypasses RLS.
--
-- The session token is injected as session-scoped config
--   set_config('request.session.token', <token>, true)
-- by the app-layer tenantDb() wrapper, parallel to the tenant / user setup.

create or replace function session_token()
returns text
language sql
stable
as $$
  select nullif(current_setting('request.session.token', true), '')
$$;

-- policy_document — write allowed to anon, read only via a JOIN from policy_analysis.
alter table "policy_document" enable row level security;

create policy policy_document_insert on "policy_document"
  for insert
  with check (true);  -- tenant_id is set server-side; no anon spoofing

create policy policy_document_select on "policy_document"
  for select
  using (
    auth_role() = 'super_admin'
    or exists (
      select 1 from "policy_analysis" a
       where a.document_id = "policy_document".id
         and a.session_token = session_token()
    )
  );

create policy policy_document_update on "policy_document"
  for update
  using (
    auth_role() = 'super_admin'
    or exists (
      select 1 from "policy_analysis" a
       where a.document_id = "policy_document".id
         and a.session_token = session_token()
    )
  );

-- policy_analysis — read + update gated by session-token match on the row itself.
alter table "policy_analysis" enable row level security;

create policy policy_analysis_insert on "policy_analysis"
  for insert
  with check (true);  -- server constructs the row with a cryptographically-random session token

create policy policy_analysis_select on "policy_analysis"
  for select
  using (
    session_token() = session_token
    or auth_role() = 'super_admin'
  );

create policy policy_analysis_update on "policy_analysis"
  for update
  using (
    session_token() = session_token
    or auth_role() = 'super_admin'
  );

-- Admin (super_admin + content_editor) can SELECT anonymised fields only.
-- For Phase 1 we keep admin reads simple via service-role bypass; a column-level
-- restriction can be added later if we ever expose analyses outside super_admin.
