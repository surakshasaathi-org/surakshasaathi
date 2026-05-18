import 'server-only';
import { eq } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import { supabaseServer } from './supabase-server';

export interface CurrentUser {
  id: string;
  email: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  /** True once the user has filled /onboarding. Drives nag banners + protected-route checks. */
  profileComplete: boolean;
}

/**
 * Returns the signed-in user, or null if anonymous. Reads the Supabase session
 * cookie, falls back to OAuth user_metadata for display name/avatar, and
 * looks up app_user to find the canonical full_name + profile completion.
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  try {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;
    const u = data.user;
    const meta = (u.user_metadata ?? {}) as Record<string, unknown>;

    // Enrich with app_user — gives us the canonical name the user typed on
    // /onboarding (OAuth metadata can be stale) + profile completion flag.
    let appUserName: string | null = null;
    let profileComplete = false;
    try {
      const db = serviceDb();
      const [row] = await db
        .select({
          fullName: schema.appUser.fullName,
          profileCompletedAt: schema.appUser.profileCompletedAt,
        })
        .from(schema.appUser)
        .where(eq(schema.appUser.id, u.id))
        .limit(1);
      if (row) {
        appUserName = row.fullName;
        profileComplete = row.profileCompletedAt !== null;
      }
    } catch {
      // DB read failure is non-fatal — we still return a working session.
    }

    return {
      id: u.id,
      email: u.email ?? null,
      displayName:
        appUserName ??
        (meta.full_name as string) ??
        (meta.name as string) ??
        u.email?.split('@')[0] ??
        null,
      avatarUrl: (meta.avatar_url as string) ?? (meta.picture as string) ?? null,
      profileComplete,
    };
  } catch {
    return null;
  }
}
