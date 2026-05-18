import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import createIntlMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

/**
 * Middleware chain:
 *   1. Supabase Auth cookie refresh — keeps the session token alive across
 *      requests and prevents "silent sign-out" after short idle periods.
 *      Applies to both customer and admin surfaces.
 *   2. next-intl locale routing — redirects bare `/` to `/en` (or detected
 *      locale) and tags the request locale. Applies ONLY to the customer
 *      surface; admin is English-only and lives outside the [locale] segment.
 *
 * Critical: when intl runs we let it set the final response headers so
 * locale redirects work, then piggy-back its response object through the
 * supabase cookie setter so auth cookies land on the same response. For
 * /admin/* we skip intl entirely and refresh cookies against a plain
 * NextResponse.next().
 *
 * Admin role gating is NOT done here — admin pages call
 * requireAdminSession() in their server components, which is the
 * authoritative check. Middleware-level role gating would be belt-and-
 * braces; deferred until we have a measured reason to add it.
 */

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  const isAdmin = request.nextUrl.pathname.startsWith('/admin');
  const response = isAdmin ? NextResponse.next() : intlMiddleware(request);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll().map((c) => ({ name: c.name, value: c.value })),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set({ name, value, ...options });
          });
        },
      },
    },
  );

  // Hydrate the session — this triggers cookie refresh if needed.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Skip Next internals + static assets. /api/* intentionally excluded —
  // API routes handle auth via their own handlers.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
};
