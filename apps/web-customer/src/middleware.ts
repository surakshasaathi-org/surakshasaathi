import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * Middleware chain:
 *   1. Supabase Auth cookie refresh — keeps the session token alive across
 *      requests and prevents "silent sign-out" after short idle periods.
 *   2. next-intl locale routing — redirects bare `/` to `/en` (or detected
 *      locale) and tags the request locale.
 *
 * Critical: we let the intl middleware set the final response headers so
 * locale redirects work, but we piggy-back its response object through the
 * supabase cookie setter so auth cookies land on the same response.
 */

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  // Run intl first — it may issue a redirect for `/` or language negotiation.
  const intlResponse = intlMiddleware(request);

  // Refresh Supabase session cookies onto whatever response intl produced.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            intlResponse.cookies.set({ name, value, ...options });
          });
        },
      },
    },
  );

  // Hydrate the session — this triggers cookie refresh if needed.
  await supabase.auth.getUser();

  return intlResponse;
}

export const config = {
  // Skip Next internals + static assets. /api/* intentionally excluded —
  // API routes handle auth via their own handlers.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
