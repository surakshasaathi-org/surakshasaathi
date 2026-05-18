-- 0011 — RLS policies for readiness score tables
-- Pattern mirrors 0001_rls_policies.sql:
--   * readiness_rule — reference table: select open; write admin-only.
--   * policy_score — tenant-scoped business row: select by tenant; is_internal
--     rows hidden from non-admin JWTs (per product decision #7 — calibration
--     month gates user visibility).
--   * admin_audit_log — admin-only read + write; cross-tenant (no tenant filter).

alter table "readiness_rule" enable row level security;
create policy readiness_rule_read on "readiness_rule"
  for select using (true);
create policy readiness_rule_write on "readiness_rule"
  for all using (auth_role() in ('super_admin', 'content_editor'))
  with check (auth_role() in ('super_admin', 'content_editor'));

alter table "policy_score" enable row level security;
-- Admins see everything including internal rows.
create policy policy_score_read_admin on "policy_score"
  for select using (auth_role() in ('super_admin', 'admin', 'content_editor'));
-- Regular tenant users see their own tenant's rows AND only is_internal=false.
create policy policy_score_read_tenant on "policy_score"
  for select using (
    tenant_id = auth_tenant_id()
    and is_internal = false
  );
-- Writes always via service role (pipeline background job); user-facing writes
-- are not supported in slice 1.
create policy policy_score_write_admin on "policy_score"
  for all using (auth_role() in ('super_admin', 'admin'))
  with check (auth_role() in ('super_admin', 'admin'));

alter table "admin_audit_log" enable row level security;
create policy admin_audit_log_read on "admin_audit_log"
  for select using (auth_role() in ('super_admin', 'admin'));
create policy admin_audit_log_write on "admin_audit_log"
  for insert with check (auth_role() in ('super_admin', 'admin', 'content_editor'));
