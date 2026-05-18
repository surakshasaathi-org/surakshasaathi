import 'server-only';

/**
 * Local-filesystem storage path helper. In prod this maps onto Supabase Storage
 * keys; the abstraction hides the swap.
 */
export function localStoragePath(storagePath: string): string {
  return `/tmp/suraksha-uploads/${storagePath.replace(/^dev-local\//, '')}`;
}
