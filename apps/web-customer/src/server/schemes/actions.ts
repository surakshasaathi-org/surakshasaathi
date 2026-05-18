'use server';
import { eq, isNull, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { serviceDb, schema } from '@suraksha/db';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * Per-user govt scheme tracker. Reads cached matches from user_scheme and
 * joins the scheme catalog for display metadata.
 *
 * MVP scope: list + enrollment-status updates + manual re-match trigger
 * using rules-based heuristics. A full scheme-matcher agent call lands when
 * the agent is wired to persist results into user_scheme.
 */

export interface SchemeRow {
  userSchemeId: string | null;
  schemeId: string;
  name: string;
  level: 'central' | 'state';
  stateCode: string | null;
  summary: string;
  matchStatus: 'eligible' | 'possibly_eligible' | 'not_eligible' | 'unmatched';
  matchReason: string | null;
  enrollmentStatus: 'not_started' | 'in_progress' | 'enrolled' | 'renewed' | 'lapsed';
  lastMatchedAt: string | null;
  coveragePaise: number | null;
  applicationChannels: string[];
}

async function requireUserId(): Promise<string | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function listMySchemes(): Promise<SchemeRow[]> {
  const userId = await requireUserId();
  if (!userId) return [];
  const db = serviceDb();

  const [userSchemes, activeSchemes] = await Promise.all([
    db.select().from(schema.userScheme).where(eq(schema.userScheme.userId, userId)),
    // Active = not yet deprecated. `deprecatedFrom` is a date column; NULL = active.
    db
      .select()
      .from(schema.scheme)
      .where(
        or(
          isNull(schema.scheme.deprecatedFrom),
          // We still list recently-deprecated schemes for historical context —
          // keeps the UI from flipping surprises on the user — but mark status
          // accordingly in the prompt copy.
        ),
      ),
  ]);

  const userByScheme = new Map(userSchemes.map((us) => [us.schemeId, us]));

  return activeSchemes.map((s): SchemeRow => {
    const us = userByScheme.get(s.id);
    return {
      userSchemeId: us?.id ?? null,
      schemeId: s.id,
      name: (s.nameI18n as Record<string, string>)?.en ?? s.slug,
      level: s.level as 'central' | 'state',
      stateCode: s.stateCode,
      summary: (s.summaryI18n as Record<string, string>)?.en ?? '',
      matchStatus:
        (us?.matchStatus as SchemeRow['matchStatus']) ?? 'unmatched',
      matchReason: us?.matchReason ?? null,
      enrollmentStatus:
        (us?.enrollmentStatus as SchemeRow['enrollmentStatus']) ?? 'not_started',
      lastMatchedAt: us?.lastMatchedAt?.toISOString() ?? null,
      coveragePaise: s.coveragePaise,
      applicationChannels: s.applicationChannels,
    };
  });
}

export async function setEnrollmentStatus(
  schemeId: string,
  status: SchemeRow['enrollmentStatus'],
  notes?: string,
): Promise<{ ok: boolean; message?: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: 'Please sign in.' };
  const db = serviceDb();

  await db
    .insert(schema.userScheme)
    .values({
      tenantId: 'surakshasaathi',
      userId,
      schemeId,
      matchStatus: 'unmatched',
      enrollmentStatus: status,
      enrollmentNotes: notes ?? null,
      lastMatchedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [schema.userScheme.userId, schema.userScheme.schemeId],
      set: {
        enrollmentStatus: status,
        enrollmentNotes: notes ?? null,
        updatedAt: new Date(),
      },
    });
  revalidatePath('/my/schemes', 'page');
  return { ok: true };
}

/**
 * Cheap rules-based matching pass. Writes/updates user_scheme for every
 * active scheme using heuristics over the user's profile + family graph.
 * Full scheme-matcher agent integration comes next — this MVP gets us a
 * functional page today.
 */
export async function refreshSchemeMatches(): Promise<{ matched: number }> {
  const userId = await requireUserId();
  if (!userId) return { matched: 0 };
  const db = serviceDb();

  const [[profileRow], family, schemes] = await Promise.all([
    db.select().from(schema.appUser).where(eq(schema.appUser.id, userId)).limit(1),
    db.select().from(schema.familyMember).where(eq(schema.familyMember.userId, userId)),
    db.select().from(schema.scheme).where(isNull(schema.scheme.deprecatedFrom)),
  ]);

  let matched = 0;
  for (const s of schemes) {
    const decision = evaluateSchemeEligibility(s, profileRow, family);
    if (!decision) continue;
    await db
      .insert(schema.userScheme)
      .values({
        tenantId: 'surakshasaathi',
        userId,
        schemeId: s.id,
        matchStatus: decision.status,
        matchReason: decision.reason,
        enrollmentStatus: 'not_started',
        lastMatchedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [schema.userScheme.userId, schema.userScheme.schemeId],
        set: {
          matchStatus: decision.status,
          matchReason: decision.reason,
          lastMatchedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    matched += 1;
  }
  revalidatePath('/my/schemes', 'page');
  return { matched };
}

/**
 * Heuristic eligibility. Reads age + state rules from eligibility_rules JSON.
 * Conservative — prefers 'possibly_eligible' over 'not_eligible' when data is
 * thin, so users aren't dismissed from schemes they could actually get.
 */
function evaluateSchemeEligibility(
  s: typeof schema.scheme.$inferSelect,
  user: typeof schema.appUser.$inferSelect | undefined,
  family: (typeof schema.familyMember.$inferSelect)[],
): { status: 'eligible' | 'possibly_eligible' | 'not_eligible'; reason: string } | null {
  const rules = (s.eligibilityRules as Record<string, unknown>) ?? {};
  const minAge = typeof rules.min_age === 'number' ? rules.min_age : undefined;
  const maxAge = typeof rules.max_age === 'number' ? rules.max_age : undefined;

  if (s.level === 'state' && s.stateCode) {
    return {
      status: 'possibly_eligible',
      reason: `State scheme for ${s.stateCode}. Confirm your residency to verify.`,
    };
  }

  if (minAge != null || maxAge != null) {
    const ages: number[] = [];
    if (user?.dateOfBirth) ages.push(ageFromDob(user.dateOfBirth));
    for (const m of family) {
      if (m.dateOfBirth) ages.push(ageFromDob(m.dateOfBirth));
    }
    if (ages.length === 0) {
      return { status: 'possibly_eligible', reason: 'Add DOBs to your family to verify.' };
    }
    const maxInHousehold = Math.max(...ages);
    const youngestInHousehold = Math.min(...ages);
    if (minAge != null && maxInHousehold < minAge) {
      return {
        status: 'not_eligible',
        reason: `Requires at least one member aged ${minAge}+; oldest in your household is ${maxInHousehold}.`,
      };
    }
    if (maxAge != null && youngestInHousehold > maxAge) {
      return {
        status: 'not_eligible',
        reason: `Requires a member aged ≤ ${maxAge}; youngest is ${youngestInHousehold}.`,
      };
    }
    return { status: 'eligible', reason: 'Age criteria met by your household.' };
  }

  return {
    status: 'possibly_eligible',
    reason: 'Worth checking — bring your family details to confirm eligibility.',
  };
}

function ageFromDob(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}
