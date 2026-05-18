-- 0006_user_profile.sql
--
-- Adds proper profile fields to app_user for the signup/signin flow.
-- All new columns are nullable so existing OAuth users aren't retro-broken;
-- the UI auto-redirects users with profile_completed_at IS NULL to /onboarding.
--
--   full_name            — required on completion
--   phone_e164           — E.164-formatted, not yet OTP-verified (Sprint TBD)
--   gender               — free-form (male/female/other/prefer_not_to_say); not a CHECK
--                          because DPDP + inclusive reporting prefer user-authored
--   date_of_birth        — used for age-based scheme eligibility
--   profile_completed_at — NULL = still in onboarding

alter table app_user
  add column if not exists full_name            text,
  add column if not exists phone_e164           text,
  add column if not exists gender               text,
  add column if not exists date_of_birth        date,
  add column if not exists profile_completed_at timestamptz;

-- Loose uniqueness on phone_e164 (NULL allowed). We keep the old `phone` column
-- for backwards-compat with any code that still reads it; new writes go to
-- phone_e164. Once all callers migrate, the old phone_idx can be dropped.
create unique index if not exists app_user_phone_e164_idx
  on app_user (phone_e164)
  where phone_e164 is not null;

-- Helper index for dashboards that filter incomplete profiles.
create index if not exists app_user_incomplete_profile_idx
  on app_user (profile_completed_at)
  where profile_completed_at is null;
