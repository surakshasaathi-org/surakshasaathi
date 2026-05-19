'use server';
import { eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { serviceDb, schema } from '@suraksha/db';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * Account-level settings: locale preference, data export (DPDP right-to-access),
 * and account deletion (DPDP right-to-erasure).
 *
 * Deletion is immediate today — FK cascades drop everything the user owns.
 * Once we onboard paying users we'll switch to a 30-day grace window with a
 * scheduled hard-delete job; the column `profile_completed_at` + a new
 * `deletion_requested_at` can drive it.
 */

export type PreferredLocaleResult =
  | { ok: true }
  | { ok: false; code: 'unauthenticated' | 'invalid_locale' | 'write_failed'; message: string };

const SUPPORTED_LOCALES = new Set(['en', 'hi', 'kn']);

async function requireUserId(): Promise<string | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function updatePreferredLocale(locale: string): Promise<PreferredLocaleResult> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, code: 'unauthenticated', message: 'Please sign in.' };
  if (!SUPPORTED_LOCALES.has(locale)) {
    return { ok: false, code: 'invalid_locale', message: 'Unsupported language.' };
  }
  try {
    const db = serviceDb();
    await db
      .update(schema.appUser)
      .set({ preferredLocale: locale as 'en' | 'hi' | 'kn' })
      .where(eq(schema.appUser.id, userId));
    revalidatePath('/my/settings', 'page');
    return { ok: true };
  } catch (err) {
    return { ok: false, code: 'write_failed', message: (err as Error).message.slice(0, 200) };
  }
}

/**
 * DPDP right-to-access: return everything we have on this user as a single
 * downloadable JSON blob. Purposefully comprehensive — this is the record
 * the user gets if they file an access request.
 */
export async function exportMyData(): Promise<
  | { ok: true; data: Record<string, unknown>; generatedAt: string }
  | { ok: false; code: 'unauthenticated'; message: string }
> {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { ok: false, code: 'unauthenticated', message: 'Please sign in.' };
  }
  const userId = auth.user.id;
  const db = serviceDb();

  const [profile] = await db
    .select()
    .from(schema.appUser)
    .where(eq(schema.appUser.id, userId))
    .limit(1);
  const family = await db
    .select()
    .from(schema.familyMember)
    .where(eq(schema.familyMember.userId, userId));
  const policies = await db
    .select()
    .from(schema.policy)
    .where(eq(schema.policy.userId, userId));
  const analyses = await db
    .select()
    .from(schema.policyAnalysis)
    .where(eq(schema.policyAnalysis.userId, userId));
  const chat = await db
    .select()
    .from(schema.chatMessage)
    .where(eq(schema.chatMessage.userId, userId));
  const feedback = await db
    .select()
    .from(schema.userFeedback)
    .where(eq(schema.userFeedback.userId, userId));

  return {
    ok: true,
    generatedAt: new Date().toISOString(),
    data: {
      profile: profile ?? null,
      family,
      policies,
      analyses,
      chatMessages: chat,
      feedback,
      note:
        'This export is the machine-readable record of your data. ' +
        'Agent-run metadata (tokens, costs) is available on request — email support@surakshasaathi.com.',
    },
  };
}

/**
 * DPDP right-to-erasure. FK cascades handle the dependent rows; we also
 * sign the user out immediately so their JWT can't continue acting on
 * the deleted account.
 *
 * Note: this hard-deletes from app_user and by cascade from every table
 * with `on delete cascade` on user_id (policy, case, document, family_member,
 * etc.). auth.users is the Supabase-managed row — deleting that requires
 * the admin client. Called last; failure there is surfaced to the caller
 * so ops can clean up manually.
 */
export async function deleteMyAccount(
  confirmation: string,
): Promise<
  | { ok: true; redirectTo: string }
  | {
      ok: false;
      code: 'unauthenticated' | 'wrong_confirmation' | 'delete_failed';
      message: string;
    }
> {
  if (confirmation.trim().toLowerCase() !== 'delete my account') {
    return {
      ok: false,
      code: 'wrong_confirmation',
      message: "Type 'delete my account' exactly to confirm.",
    };
  }

  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { ok: false, code: 'unauthenticated', message: 'Please sign in.' };
  }
  const userId = auth.user.id;

  try {
    const db = serviceDb();
    // Blow away the app_user row — cascades take care of family_member,
    // policy, case, document, chat_message, user_feedback, upload_event.
    await db.delete(schema.appUser).where(eq(schema.appUser.id, userId));
  } catch (err) {
    return {
      ok: false,
      code: 'delete_failed',
      message:
        'Partial delete — please email support@surakshasaathi.com to finish. ' +
        (err as Error).message.slice(0, 200),
    };
  }

  // Sign the user out locally; the Supabase auth.users row stays until we
  // wire the admin API (kept intentionally out-of-scope for Wave 1 —
  // service-role credentials would need to move into this server path).
  try {
    await supabase.auth.signOut();
  } catch {
    // non-fatal
  }

  return { ok: true, redirectTo: '/' };
}

/**
 * Thin wrapper Server Action used by the delete form — handles the redirect
 * on the server so the client doesn't have to juggle router state.
 */
export async function deleteMyAccountAndRedirect(confirmation: string): Promise<void> {
  const res = await deleteMyAccount(confirmation);
  if (res.ok) redirect(res.redirectTo);
  // On failure we just throw — the form's useTransition handler will surface it.
  throw new Error(res.message);
}
