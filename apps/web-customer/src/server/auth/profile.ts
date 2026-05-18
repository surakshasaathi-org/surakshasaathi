'use server';
import { eq } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * Current-user profile helpers + completeProfile Server Action.
 *
 * Called from /onboarding and /sign-up. Reads the Supabase session for the
 * user id, then writes into app_user. Email+password signups populate the
 * profile inline; OAuth/magic-link users land on /onboarding and fill here.
 */

export interface Profile {
  id: string;
  email: string | null;
  fullName: string | null;
  phoneE164: string | null;
  gender: string | null;
  dateOfBirth: string | null;
  profileCompletedAt: string | null;
}

export async function getMyProfile(): Promise<Profile | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return null;

  const db = serviceDb();
  const [row] = await db
    .select()
    .from(schema.appUser)
    .where(eq(schema.appUser.id, data.user.id))
    .limit(1);
  if (!row) {
    // Edge case: auth.users exists but trigger hasn't yet mirrored to app_user.
    // Return a partial so the onboarding UI can still render.
    return {
      id: data.user.id,
      email: data.user.email ?? null,
      fullName: null,
      phoneE164: null,
      gender: null,
      dateOfBirth: null,
      profileCompletedAt: null,
    };
  }
  return {
    id: row.id,
    email: row.email,
    fullName: row.fullName,
    phoneE164: row.phoneE164,
    gender: row.gender,
    dateOfBirth: row.dateOfBirth,
    profileCompletedAt: row.profileCompletedAt?.toISOString() ?? null,
  };
}

export type CompleteProfileInput = {
  fullName: string;
  phoneE164?: string | null;
  gender?: string | null;
  dateOfBirth?: string | null;
};

export type CompleteProfileResult =
  | { ok: true }
  | {
      ok: false;
      code: 'unauthenticated' | 'name_required' | 'phone_invalid' | 'dob_invalid' | 'write_failed';
      message: string;
    };

export async function completeProfile(
  input: CompleteProfileInput,
): Promise<CompleteProfileResult> {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return { ok: false, code: 'unauthenticated', message: 'You must be signed in.' };
  }

  // Name: min 2 chars, max 120. Anything else is user-authored free-form.
  const name = (input.fullName ?? '').trim();
  if (name.length < 2 || name.length > 120) {
    return { ok: false, code: 'name_required', message: 'Please enter your full name.' };
  }

  // Phone: accept 10-digit Indian OR E.164. Normalise to E.164 before write.
  // Skips empty / null. Not OTP-verified yet — that's a fast-follow.
  let phoneE164: string | null = null;
  if (input.phoneE164 && input.phoneE164.trim()) {
    const normalised = normalisePhone(input.phoneE164);
    if (!normalised) {
      return {
        ok: false,
        code: 'phone_invalid',
        message: 'Enter a 10-digit Indian mobile or a +country-code number.',
      };
    }
    phoneE164 = normalised;
  }

  // Gender: free-form but we constrain to a small set so reporting is usable.
  const gender =
    input.gender && ALLOWED_GENDERS.includes(input.gender) ? input.gender : null;

  // DOB: YYYY-MM-DD only. Reject future dates and absurd past dates (>120y).
  let dob: string | null = null;
  if (input.dateOfBirth && input.dateOfBirth.trim()) {
    const d = new Date(input.dateOfBirth);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, code: 'dob_invalid', message: 'Enter a valid date of birth.' };
    }
    const now = new Date();
    const oldestAllowed = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
    if (d > now || d < oldestAllowed) {
      return { ok: false, code: 'dob_invalid', message: 'Date of birth looks off.' };
    }
    dob = input.dateOfBirth;
  }

  try {
    const db = serviceDb();
    await db
      .insert(schema.appUser)
      .values({
        id: auth.user.id,
        email: auth.user.email ?? null,
        fullName: name,
        phoneE164,
        gender,
        dateOfBirth: dob,
        profileCompletedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: schema.appUser.id,
        set: {
          fullName: name,
          phoneE164,
          gender,
          dateOfBirth: dob,
          profileCompletedAt: new Date(),
        },
      });
    return { ok: true };
  } catch (err) {
    const msg = (err as Error).message;
    // Unique-violation on phone_e164 (someone else already claimed it) —
    // specific-ish code for the UI.
    if (/app_user_phone_e164_idx/.test(msg)) {
      return {
        ok: false,
        code: 'phone_invalid',
        message: 'That mobile number is already linked to another account.',
      };
    }
    return { ok: false, code: 'write_failed', message: msg.slice(0, 240) };
  }
}

const ALLOWED_GENDERS = ['male', 'female', 'other', 'prefer_not_to_say'];

/**
 * Accepts: "9876543210", "09876543210", "+919876543210", "+1 415 555 0123".
 * Returns E.164 string, or null on failure. Indian 10-digit -> prefix +91.
 */
function normalisePhone(raw: string): string | null {
  const digits = raw.replace(/[^\d+]/g, '');
  // Strict E.164: + followed by 8–15 digits.
  if (/^\+\d{8,15}$/.test(digits)) return digits;
  // Indian 10-digit mobile (first digit 6-9).
  const m = digits.match(/^0?([6-9]\d{9})$/);
  if (m) return `+91${m[1]}`;
  return null;
}
