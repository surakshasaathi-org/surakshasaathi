import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Supabase Storage adapter for policy uploads. Replaces the earlier
 * local-filesystem helper that wrote to /tmp/suraksha-uploads — that
 * pattern silently breaks in Vercel serverless because /tmp is per-
 * instance and ephemeral. Files written by the upload handler vanish
 * before the analyse pipeline can read them.
 *
 * All access here uses the service-role key. The bucket itself is
 * private with deny-all RLS — defence in depth for the day we expose
 * client-direct uploads via signed URLs.
 *
 * Path convention: `uploads/<analysisId>/<sanitised-filename>` for
 * customer uploads, `uploads/eval/<sha>.<ext>` for admin eval fixtures.
 * The earlier `dev-local/` prefix was renamed because it was confusing
 * in prod logs and never gated dev-only behaviour anyway.
 */

export const POLICY_BUCKET = 'policy-documents';
export const STORAGE_PATH_PREFIX = 'uploads/';

let cachedClient: SupabaseClient | null = null;

function serviceClient(): SupabaseClient {
  if (cachedClient) return cachedClient;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL not set');
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY not set');
  cachedClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return cachedClient;
}

/**
 * Upload a policy PDF / image to the policy-documents bucket.
 * Throws on failure — callers should catch and surface to the user.
 * `contentType` should match the file's MIME (e.g. 'application/pdf').
 */
export async function uploadPolicyDocument(
  storagePath: string,
  bytes: Buffer | Uint8Array,
  contentType: string,
): Promise<void> {
  const { error } = await serviceClient().storage
    .from(POLICY_BUCKET)
    .upload(storagePath, bytes, {
      contentType,
      upsert: true,
    });
  if (error) {
    throw new Error(`storage upload failed path=${storagePath} cause=${error.message}`);
  }
}

/**
 * Download a previously-uploaded policy document. Returns the raw bytes.
 * Throws on missing file or fetch error.
 */
export async function downloadPolicyDocument(storagePath: string): Promise<Buffer> {
  const { data, error } = await serviceClient().storage
    .from(POLICY_BUCKET)
    .download(storagePath);
  if (error || !data) {
    throw new Error(
      `storage download failed path=${storagePath} cause=${error?.message ?? 'no data'}`,
    );
  }
  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}
