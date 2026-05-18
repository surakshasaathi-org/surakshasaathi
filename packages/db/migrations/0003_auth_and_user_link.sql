-- 0003_auth_and_user_link.sql
--
-- Wire Supabase Auth into our app-layer tables:
--   1. Add a nullable `user_id` column to `policy_analysis` so signed-in users
--      can claim ownership of their analyses (anonymous access still works —
--      user_id stays NULL for those).
--   2. Trigger on auth.users INSERT → auto-create an `app_user` row and a
--      default `membership` row for the `surakshasaathi` tenant. Keeps the
--      two user tables in sync automatically.
--   3. Extend RLS on policy_analysis so a caller whose JWT sub matches the
--      row's user_id can read/update it (in addition to the existing
--      session-token path).

--
-- 1. Add user_id to policy_analysis
--
alter table "policy_analysis"
  add column if not exists "user_id" uuid;

create index if not exists policy_analysis_user_idx
  on "policy_analysis" ("user_id", "created_at" desc)
  where "user_id" is not null;

--
-- 2. auth.users → app_user + membership sync
--
-- We use a SECURITY DEFINER trigger so it can write to public tables
-- regardless of RLS on the calling session.
--
create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display text;
begin
  display := coalesce(
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'name',
    new.email,
    new.phone
  );

  insert into public.app_user (id, phone, email, display_name, preferred_locale, created_at)
  values (
    new.id,
    new.phone,
    new.email,
    display,
    'en',
    coalesce(new.created_at, now())
  )
  on conflict (id) do update
    set phone = excluded.phone,
        email = excluded.email,
        display_name = coalesce(public.app_user.display_name, excluded.display_name);

  insert into public.membership (tenant_id, user_id, role)
  values ('surakshasaathi', new.id, 'member')
  on conflict do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_auth_user_created();

-- Also backfill any existing auth.users rows in case Supabase already has accounts.
insert into public.app_user (id, phone, email, display_name, preferred_locale, created_at)
select
  u.id,
  u.phone,
  u.email,
  coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name', u.email, u.phone),
  'en',
  u.created_at
from auth.users u
on conflict (id) do nothing;

insert into public.membership (tenant_id, user_id, role)
select 'surakshasaathi', u.id, 'member'
from auth.users u
on conflict do nothing;

--
-- 3. RLS: allow authenticated users to see their own analyses
--
-- auth_user_id() returns the JWT `sub` as a uuid (helper from 0001).
-- We extend the existing session-token policies with an OR-clause.

drop policy if exists policy_analysis_select on "policy_analysis";
create policy policy_analysis_select on "policy_analysis"
  for select
  using (
    session_token() = session_token
    or (user_id is not null and user_id = auth_user_id())
    or auth_role() = 'super_admin'
  );

drop policy if exists policy_analysis_update on "policy_analysis";
create policy policy_analysis_update on "policy_analysis"
  for update
  using (
    session_token() = session_token
    or (user_id is not null and user_id = auth_user_id())
    or auth_role() = 'super_admin'
  );
