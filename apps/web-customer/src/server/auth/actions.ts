'use server';
import { and, eq } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { serviceDb, schema } from '@suraksha/db';
import { supabaseServer } from '@/lib/supabase-server';
import { claimRecentAnalyses } from './claim';

/**
 * Auth Server Actions. All user-facing auth writes go through here — never
 * directly from a client component — so the session cookies land on the
 * server response and the claim-analyses side-effect runs consistently.
 */

export type EmailSignInResult =
  | { ok: true; message: string }
  | { ok: false; code: 'invalid_email' | 'rate_limited' | 'send_failed'; message: string };

export type PasswordSignInResult =
  | { ok: true; nextPath: string }
  | {
      ok: false;
      code:
        | 'invalid_email'
        | 'invalid_password'
        | 'bad_credentials'
        | 'email_not_confirmed'
        | 'rate_limited'
        | 'send_failed';
      message: string;
    };

export type PasswordSignUpResult =
  | { ok: true; nextPath: string; needsEmailConfirm: boolean }
  | {
      ok: false;
      code:
        | 'invalid_email'
        | 'invalid_password'
        | 'email_in_use'
        | 'rate_limited'
        | 'send_failed';
      message: string;
    };

/**
 * Send a magic-link email. Supabase Auth handles the rest.
 */
export async function sendEmailMagicLink(
  email: string,
  nextPath: string | null,
): Promise<EmailSignInResult> {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, code: 'invalid_email', message: 'Enter a valid email address.' };
  }

  const supabase = await supabaseServer();
  const redirectTo = new URL(
    `/auth/callback?next=${encodeURIComponent(nextPath ?? '/')}`,
    appUrl(),
  ).toString();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('rate')) {
      return { ok: false, code: 'rate_limited', message: 'Too many attempts. Try again in a few minutes.' };
    }
    return { ok: false, code: 'send_failed', message: error.message };
  }

  return {
    ok: true,
    message: `Check your inbox for a one-click sign-in link.`,
  };
}

/**
 * Email + password sign-in. On success the session cookies are set on the
 * response; caller redirects client-side. We also run onSignedIn() to claim
 * any anonymous analyses the browser had queued.
 */
export async function signInWithPassword(
  email: string,
  password: string,
  nextPath: string | null,
): Promise<PasswordSignInResult> {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, code: 'invalid_email', message: 'Enter a valid email.' };
  }
  if (!password || password.length < 8) {
    return { ok: false, code: 'invalid_password', message: 'Password must be at least 8 characters.' };
  }

  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const msg = error.message.toLowerCase();
    if (msg.includes('email not confirmed')) {
      return {
        ok: false,
        code: 'email_not_confirmed',
        message: 'Confirm your email first — we sent you a link when you signed up.',
      };
    }
    if (msg.includes('rate') || msg.includes('too many')) {
      return {
        ok: false,
        code: 'rate_limited',
        message: 'Too many attempts. Wait a minute and try again.',
      };
    }
    return {
      ok: false,
      code: 'bad_credentials',
      message: 'Email or password is incorrect.',
    };
  }

  // Best-effort claim; never fail the sign-in over a claim hiccup.
  try {
    await onSignedIn();
  } catch {
    // noop
  }
  return { ok: true, nextPath: nextPath ?? '/' };
}

/**
 * Email + password sign-up. Returns needsEmailConfirm=true when Supabase is
 * configured to require email verification (the default) — the UI uses that
 * to render a "check your inbox" state instead of redirecting.
 */
export async function signUpWithPassword(
  email: string,
  password: string,
  nextPath: string | null,
): Promise<PasswordSignUpResult> {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, code: 'invalid_email', message: 'Enter a valid email.' };
  }
  if (!password || password.length < 8) {
    return {
      ok: false,
      code: 'invalid_password',
      message: 'Choose a password with at least 8 characters.',
    };
  }

  const supabase = await supabaseServer();

  // Retry guard: if the caller already has a session for this exact email
  // (common in dev where React 19 may invoke the Server Action twice, or when
  // the user clicks Back after a successful signup and resubmits) then the
  // "real" signup already happened. Treat that as success rather than calling
  // signUp() again — Supabase would otherwise reject with "User already
  // registered", which is misleading to the user.
  const { data: existing } = await supabase.auth.getUser();
  if (existing.user && existing.user.email?.toLowerCase() === email.toLowerCase()) {
    return { ok: true, nextPath: nextPath ?? '/onboarding', needsEmailConfirm: false };
  }

  const redirectTo = new URL(
    `/auth/callback?next=${encodeURIComponent(nextPath ?? '/onboarding')}`,
    appUrl(),
  ).toString();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: redirectTo },
  });

  if (error) {
    const msg = error.message.toLowerCase();
    // Full log so production can see which branch fired.
    console.warn('[auth/signup] supabase error', {
      email_domain: email.split('@')[1],
      message: error.message,
      status: (error as { status?: number }).status ?? null,
    });
    if (msg.includes('already registered') || msg.includes('already exists')) {
      return {
        ok: false,
        code: 'email_in_use',
        message: 'That email already has an account — sign in instead.',
      };
    }
    if (msg.includes('rate') || msg.includes('too many')) {
      return {
        ok: false,
        code: 'rate_limited',
        message: 'Too many sign-up attempts. Wait a minute.',
      };
    }
    if (msg.includes('password')) {
      return { ok: false, code: 'invalid_password', message: error.message };
    }
    return { ok: false, code: 'send_failed', message: error.message };
  }

  // Supabase obfuscates "email already exists" for security: when someone tries
  // to sign up with an email that's already confirmed but the caller has no
  // session, Supabase returns data.user with identities: []. Detect + handle.
  const identities =
    (data.user as { identities?: unknown[] } | null)?.identities ?? null;
  if (data.user && Array.isArray(identities) && identities.length === 0) {
    return {
      ok: false,
      code: 'email_in_use',
      message: 'That email already has an account — sign in instead.',
    };
  }

  const needsEmailConfirm = !data.session; // Supabase returns null session when confirm required
  return { ok: true, nextPath: nextPath ?? '/onboarding', needsEmailConfirm };
}

export async function signOutAction(): Promise<void> {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  revalidatePath('/', 'layout');
  redirect('/');
}

/**
 * Called from the auth callback. Side effects we run every sign-in:
 *   1. Migrate recent anonymous analyses on the browser into the user's
 *      account (idempotent — already-claimed rows are skipped).
 *   2. Auto-promote the UAT admin email to super_admin membership, so ops
 *      can get into the admin portal without hand-running SQL.
 */
export async function onSignedIn(): Promise<{ claimedCount: number }> {
  // Promote the UAT admin if configured + matching. Run before claim so
  // failure here still lets analysis claim proceed.
  await maybePromoteUatAdmin();
  // Seed initial required-consent rows so the DPDP audit log starts with
  // a full record on signup. Idempotent — skips any purpose already recorded.
  try {
    const { bulkGrantDefaultConsents } = await import('./consent');
    await bulkGrantDefaultConsents();
  } catch (err) {
    console.warn('[auth] consent bootstrap failed (non-fatal)', (err as Error).message);
  }

  const cookieStore = await cookies();
  const raw = cookieStore.get('ss_analyses')?.value;
  if (!raw) return { claimedCount: 0 };

  let ids: string[] = [];
  try {
    ids = (JSON.parse(decodeURIComponent(raw)) as unknown[]).filter(
      (x): x is string => typeof x === 'string',
    );
  } catch {
    return { claimedCount: 0 };
  }
  if (ids.length === 0) return { claimedCount: 0 };

  const claimedCount = await claimRecentAnalyses(ids);

  // Reset the cookie now that rows are claimed to the account
  cookieStore.set('ss_analyses', '', { path: '/', maxAge: 0 });

  return { claimedCount };
}

/**
 * If the signed-in user's email matches UAT_ADMIN_EMAIL, upsert a
 * super_admin membership row on the default tenant. Idempotent — the
 * underlying (tenant_id, user_id) unique index means re-runs are no-ops
 * but updates the role if it changed.
 *
 * Never throws — promotion is a nice-to-have, not a signin blocker.
 */
async function maybePromoteUatAdmin(): Promise<void> {
  const uatEmail = process.env.UAT_ADMIN_EMAIL?.trim().toLowerCase();
  if (!uatEmail) return;

  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getUser();
    const user = data.user;
    if (!user?.email) return;
    if (user.email.trim().toLowerCase() !== uatEmail) return;

    const db = serviceDb();
    // Ensure the app_user mirror row exists before we write the membership.
    // The auth.users → app_user sync trigger normally handles this, but if
    // it raced or was skipped we insert here as a safety net.
    await db
      .insert(schema.appUser)
      .values({ id: user.id, email: user.email })
      .onConflictDoNothing({ target: schema.appUser.id });

    const tenantId = 'surakshasaathi';
    const existing = await db
      .select({ id: schema.membership.id, role: schema.membership.role })
      .from(schema.membership)
      .where(
        and(
          eq(schema.membership.tenantId, tenantId),
          eq(schema.membership.userId, user.id),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(schema.membership).values({
        tenantId,
        userId: user.id,
        role: 'super_admin',
      });
      console.log(`[auth] promoted UAT admin to super_admin email=${user.email}`);
    } else if (existing[0]!.role !== 'super_admin') {
      await db
        .update(schema.membership)
        .set({ role: 'super_admin' })
        .where(eq(schema.membership.id, existing[0]!.id));
      console.log(`[auth] re-promoted UAT admin to super_admin email=${user.email}`);
    }
  } catch (err) {
    console.warn('[auth] UAT admin promotion failed (non-fatal)', (err as Error).message);
  }
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}
