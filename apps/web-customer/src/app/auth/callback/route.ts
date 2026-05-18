import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { eq } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import { onSignedIn } from '@/server/auth/actions';

/**
 * OAuth / magic-link callback handler.
 *
 * Supabase redirects here with a `code` query param. We exchange the code
 * for a session, set the auth cookies, then redirect to `next` (or home).
 * Before the final redirect, we claim any anonymous analyses the browser had
 * queued in its `ss_analyses` cookie.
 */

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (!code) {
    return NextResponse.redirect(`${origin}/sign-in?error=missing_code`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet: Array<{ name: string; value: string; options?: CookieOptions }>) => {
          toSet.forEach(({ name, value, options }) => {
            cookieStore.set({ name, value, ...options });
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      `${origin}/sign-in?error=${encodeURIComponent(error.message)}`,
    );
  }

  // Best-effort claim of anonymous analyses. Don't block on failure.
  try {
    const result = await onSignedIn();
    const search = result.claimedCount > 0 ? `?welcome=${result.claimedCount}` : '';

    // Route through /onboarding when the user's profile isn't complete yet.
    // Only overrides when `next` isn't already /onboarding (avoids loop) and
    // the lookup succeeds. Failures here fall back to the original next.
    const redirectTarget = await resolveRedirectAfterSignIn(next);
    return NextResponse.redirect(`${origin}${redirectTarget}${search}`);
  } catch {
    return NextResponse.redirect(`${origin}${next}`);
  }
}

/**
 * If the user hasn't completed onboarding, push them to /onboarding first —
 * and carry their original destination forward so Continue takes them there.
 * Locale is inferred from the original next path (first /xx segment) or
 * defaults to 'en'. Swallows errors and returns the original target on failure.
 */
async function resolveRedirectAfterSignIn(next: string): Promise<string> {
  try {
    // Skip if the caller already aimed at /onboarding.
    if (next.includes('/onboarding')) return next;

    // Re-hydrate the server client to read the session after code exchange.
    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll: () => cookieStore.getAll(),
          setAll: () => {
            // no-op — we only read here
          },
        },
      },
    );
    const { data } = await supabase.auth.getUser();
    if (!data.user) return next;

    const db = serviceDb();
    const [row] = await db
      .select({ profileCompletedAt: schema.appUser.profileCompletedAt })
      .from(schema.appUser)
      .where(eq(schema.appUser.id, data.user.id))
      .limit(1);

    // No row yet (pre-trigger) OR trigger ran but no profile → onboarding.
    if (!row || !row.profileCompletedAt) {
      const locale = next.match(/^\/(en|hi|kn)\b/)?.[1] ?? 'en';
      return `/${locale}/onboarding?next=${encodeURIComponent(next)}`;
    }
    return next;
  } catch {
    return next;
  }
}
