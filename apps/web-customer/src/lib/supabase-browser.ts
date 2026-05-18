'use client';
import { createBrowserClient } from '@supabase/ssr';

/**
 * Browser-side Supabase client. Shares the auth session with the server via
 * cookies managed by @supabase/ssr. Safe to call from Client Components.
 */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
