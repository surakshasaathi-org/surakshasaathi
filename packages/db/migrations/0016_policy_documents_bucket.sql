-- 0016 — create the policy-documents Storage bucket
--
-- All policy PDFs / images uploaded by customers (and admin eval fixtures)
-- land in this single private bucket. Server-side code uses the service-role
-- key to read/write; the bucket itself denies all anon/authenticated access
-- so a leaked anon key cannot enumerate or download policy files.
--
-- Schema: Supabase's `storage` schema is part of every project. The
-- `storage.buckets` row controls per-bucket visibility; per-row access is
-- gated by RLS on `storage.objects`. Both are addressed below.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'policy-documents',
  'policy-documents',
  false,
  20971520,  -- 20 MB; matches the MAX_PDF_BYTES guard in upload server actions
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/heic',
    'image/heif',
    'image/webp'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Deny-all RLS for non-service-role connections. The service-role key
-- bypasses RLS so server-side upload/download still works; this protects
-- against a future leak of the anon key (which would otherwise have full
-- access if RLS were off).
--
-- When we later expose client-direct uploads via signed URLs, replace this
-- with user-scoped policies that key off (owner = auth.uid()) — tracked as
-- a follow-up.

do $$
begin
  -- Use IF NOT EXISTS via DO block; CREATE POLICY has no IF NOT EXISTS in
  -- the supported Postgres version.
  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'policy_documents_deny_anon_select'
  ) then
    create policy policy_documents_deny_anon_select
      on storage.objects for select
      to anon, authenticated
      using (bucket_id <> 'policy-documents');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'policy_documents_deny_anon_insert'
  ) then
    create policy policy_documents_deny_anon_insert
      on storage.objects for insert
      to anon, authenticated
      with check (bucket_id <> 'policy-documents');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'policy_documents_deny_anon_update'
  ) then
    create policy policy_documents_deny_anon_update
      on storage.objects for update
      to anon, authenticated
      using (bucket_id <> 'policy-documents');
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and policyname = 'policy_documents_deny_anon_delete'
  ) then
    create policy policy_documents_deny_anon_delete
      on storage.objects for delete
      to anon, authenticated
      using (bucket_id <> 'policy-documents');
  end if;
end $$;
