'use server';
import { asc, eq, and } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { serviceDb, schema } from '@suraksha/db';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * Family graph CRUD. All actions require the caller to be signed in; the
 * authenticated user is always the owner of the rows they touch — we never
 * let one user edit another's family data, regardless of RLS context.
 */

export interface FamilyMemberRow {
  id: string;
  relation: string;
  displayName: string;
  dateOfBirth: string | null;
  gender: string | null;
  preExistingConditions: string[];
  chronicMedications: string[];
  ayushmanCardNumber: string | null;
  notes: string | null;
  isPrimary: boolean;
  /** 'draft' (proposed by analysis) | 'confirmed' (user-authored). */
  status: 'draft' | 'confirmed';
  /** 'manual' | `analysis:<id>`. Lets the UI show "proposed from X analysis". */
  source: string;
  sourceAnalysisId: string | null;
  createdAt: string;
}

async function requireUserId(): Promise<string | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

/**
 * Lightweight projection for the upload wizard — returns a DemographicsForm-
 * shaped structure the client can slot directly into its form state. Empty
 * result for anonymous users; the wizard simply shows the chip editor.
 */
export async function getFamilyAsDemographics(): Promise<{
  members: Array<{
    ref: string;
    age: number;
    display_label: string;
    pre_existing?: string[];
    chronic_meds?: string[];
    notes?: string;
  }>;
} | null> {
  const rows = await listFamily();
  if (rows.length === 0) return null;
  return {
    members: rows.map((m) => ({
      ref: m.relation,
      age: m.dateOfBirth ? ageFromDob(m.dateOfBirth) : 0,
      display_label: [m.displayName, m.dateOfBirth ? `${ageFromDob(m.dateOfBirth)}y` : null]
        .filter(Boolean)
        .join(', '),
      pre_existing: m.preExistingConditions,
      chronic_meds: m.chronicMedications,
      notes: m.notes ?? undefined,
    })),
  };
}

function ageFromDob(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
}

export async function listFamily(): Promise<FamilyMemberRow[]> {
  const userId = await requireUserId();
  if (!userId) return [];
  const db = serviceDb();
  const rows = await db
    .select()
    .from(schema.familyMember)
    .where(eq(schema.familyMember.userId, userId))
    .orderBy(asc(schema.familyMember.isPrimary), asc(schema.familyMember.createdAt));

  // is_primary DESC actually — Postgres treats false < true in asc, so flip.
  rows.sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1));

  return rows.map(toRow);
}

export interface UpsertFamilyMemberInput {
  id?: string | null;
  relation: string;
  displayName: string;
  dateOfBirth?: string | null;
  gender?: string | null;
  preExistingConditions?: string[];
  chronicMedications?: string[];
  ayushmanCardNumber?: string | null;
  notes?: string | null;
  isPrimary?: boolean;
}

export type UpsertResult =
  | { ok: true; id: string }
  | {
      ok: false;
      code: 'unauthenticated' | 'validation' | 'write_failed';
      message: string;
    };

export async function upsertFamilyMember(input: UpsertFamilyMemberInput): Promise<UpsertResult> {
  const userId = await requireUserId();
  if (!userId) {
    return { ok: false, code: 'unauthenticated', message: 'Please sign in.' };
  }

  const validation = validate(input);
  if (!validation.ok) return validation;

  const db = serviceDb();
  try {
    // Make sure only one row per user has is_primary = true. If this write
    // claims primary, demote any existing primary first (same transaction
    // would be cleaner but the unique partial index gives us a safety net).
    if (input.isPrimary) {
      await db
        .update(schema.familyMember)
        .set({ isPrimary: false })
        .where(
          and(
            eq(schema.familyMember.userId, userId),
            eq(schema.familyMember.isPrimary, true),
          ),
        );
    }

    if (input.id) {
      const [row] = await db
        .update(schema.familyMember)
        .set({
          relation: input.relation.trim(),
          displayName: input.displayName.trim(),
          dateOfBirth: input.dateOfBirth ?? null,
          gender: input.gender ?? null,
          preExistingConditions: input.preExistingConditions ?? [],
          chronicMedications: input.chronicMedications ?? [],
          ayushmanCardNumber: input.ayushmanCardNumber?.trim() || null,
          notes: input.notes?.trim() || null,
          isPrimary: input.isPrimary ?? false,
          updatedAt: new Date(),
        })
        .where(
          and(eq(schema.familyMember.id, input.id), eq(schema.familyMember.userId, userId)),
        )
        .returning({ id: schema.familyMember.id });
      if (!row) {
        return { ok: false, code: 'validation', message: 'Member not found or not yours to edit.' };
      }
      revalidatePath('/my/family', 'page');
      return { ok: true, id: row.id };
    }

    const [row] = await db
      .insert(schema.familyMember)
      .values({
        tenantId: 'surakshasaathi',
        userId,
        relation: input.relation.trim(),
        displayName: input.displayName.trim(),
        dateOfBirth: input.dateOfBirth ?? null,
        gender: input.gender ?? null,
        preExistingConditions: input.preExistingConditions ?? [],
        chronicMedications: input.chronicMedications ?? [],
        ayushmanCardNumber: input.ayushmanCardNumber?.trim() || null,
        notes: input.notes?.trim() || null,
        isPrimary: input.isPrimary ?? false,
      })
      .returning({ id: schema.familyMember.id });
    revalidatePath('/my/family', 'page');
    return { ok: true, id: row!.id };
  } catch (err) {
    return { ok: false, code: 'write_failed', message: (err as Error).message.slice(0, 240) };
  }
}

export async function deleteFamilyMember(id: string): Promise<{ ok: boolean; message?: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: 'Please sign in.' };
  const db = serviceDb();
  const res = await db
    .delete(schema.familyMember)
    .where(and(eq(schema.familyMember.id, id), eq(schema.familyMember.userId, userId)))
    .returning({ id: schema.familyMember.id });
  if (res.length === 0) return { ok: false, message: 'Member not found.' };
  revalidatePath('/my/family', 'page');
  return { ok: true };
}

function validate(input: UpsertFamilyMemberInput):
  | { ok: true }
  | { ok: false; code: 'validation'; message: string } {
  const name = input.displayName?.trim() ?? '';
  if (name.length < 1 || name.length > 80) {
    return { ok: false, code: 'validation', message: 'Name is required (up to 80 characters).' };
  }
  const relation = input.relation?.trim() ?? '';
  if (relation.length < 1 || relation.length > 40) {
    return { ok: false, code: 'validation', message: 'Relation is required.' };
  }
  if (input.dateOfBirth) {
    const d = new Date(input.dateOfBirth);
    if (Number.isNaN(d.getTime())) {
      return { ok: false, code: 'validation', message: 'Date of birth looks invalid.' };
    }
    const now = new Date();
    const oldest = new Date(now.getFullYear() - 120, now.getMonth(), now.getDate());
    if (d > now || d < oldest) {
      return { ok: false, code: 'validation', message: 'Date of birth is out of range.' };
    }
  }
  if (input.ayushmanCardNumber && input.ayushmanCardNumber.trim().length > 40) {
    return { ok: false, code: 'validation', message: 'Ayushman card number looks too long.' };
  }
  return { ok: true };
}

function toRow(r: typeof schema.familyMember.$inferSelect): FamilyMemberRow {
  return {
    id: r.id,
    relation: r.relation,
    displayName: r.displayName,
    dateOfBirth: r.dateOfBirth,
    gender: r.gender,
    preExistingConditions: r.preExistingConditions,
    chronicMedications: r.chronicMedications,
    ayushmanCardNumber: r.ayushmanCardNumber,
    notes: r.notes,
    isPrimary: r.isPrimary,
    status: r.status === 'draft' ? 'draft' : 'confirmed',
    source: r.source,
    sourceAnalysisId: r.sourceAnalysisId,
    createdAt: r.createdAt.toISOString(),
  };
}

/* ───────── Draft proposals from analysis ───────── */

/**
 * Given an analysis the user owns, propose each insured member found in its
 * extractor output as a DRAFT family_member row. Dedup is by
 * (user_id, source_analysis_id, relation) so re-running against the same
 * analysis doesn't spam duplicates.
 *
 * Called from the analysis report page's "Add to family (review)" CTA.
 */
export async function proposeFamilyFromAnalysis(
  analysisId: string,
): Promise<{ ok: true; proposed: number } | { ok: false; message: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: 'Please sign in.' };

  const db = serviceDb();
  // Load the analysis — must belong to this user.
  const [analysis] = await db
    .select()
    .from(schema.policyAnalysis)
    .where(
      and(eq(schema.policyAnalysis.id, analysisId), eq(schema.policyAnalysis.userId, userId)),
    )
    .limit(1);
  if (!analysis) return { ok: false, message: 'Analysis not found or not yours.' };

  // Pull members from either v2 extractor.basic_facts.members or v1 basic_facts.members.
  type ExtractedMember = {
    relation: string;
    age: number | null;
    pre_existing: string[];
  };
  const report = analysis.reportJson as Record<string, unknown> | null;
  let members: ExtractedMember[] = [];
  if (report) {
    const extractor = (report as { extractor?: { basic_facts?: { members?: ExtractedMember[] } } }).extractor;
    const v2Members = extractor?.basic_facts?.members;
    const v1Members = (report as { basic_facts?: { members?: ExtractedMember[] } }).basic_facts?.members;
    members = v2Members ?? v1Members ?? [];
  }
  if (members.length === 0) {
    return { ok: false, message: "We couldn't find insured members in this analysis." };
  }

  // Existing rows already sourced from this analysis — skip dedups.
  const existing = await db
    .select({ relation: schema.familyMember.relation })
    .from(schema.familyMember)
    .where(
      and(
        eq(schema.familyMember.userId, userId),
        eq(schema.familyMember.sourceAnalysisId, analysisId),
      ),
    );
  const seen = new Set(existing.map((r) => r.relation.toLowerCase()));

  let proposed = 0;
  for (const m of members) {
    const rel = (m.relation ?? '').trim();
    if (!rel) continue;
    if (seen.has(rel.toLowerCase())) continue;

    await db.insert(schema.familyMember).values({
      tenantId: 'surakshasaathi',
      userId,
      relation: rel,
      // The insurer's policy schedule rarely carries a "display name" —
      // best guess is humanised relation. User renames on confirm.
      displayName: humaniseRelation(rel),
      dateOfBirth: m.age != null ? approxDobFromAge(m.age) : null,
      gender: null,
      preExistingConditions: Array.isArray(m.pre_existing) ? m.pre_existing : [],
      chronicMedications: [],
      ayushmanCardNumber: null,
      notes: null,
      isPrimary: false,
      status: 'draft',
      source: `analysis:${analysisId}`,
      sourceAnalysisId: analysisId,
    });
    proposed += 1;
  }

  revalidatePath('/my/family', 'page');
  return { ok: true, proposed };
}

export async function confirmFamilyMember(
  id: string,
): Promise<{ ok: boolean; message?: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: 'Please sign in.' };
  const db = serviceDb();
  const res = await db
    .update(schema.familyMember)
    .set({ status: 'confirmed', updatedAt: new Date() })
    .where(and(eq(schema.familyMember.id, id), eq(schema.familyMember.userId, userId)))
    .returning({ id: schema.familyMember.id });
  if (res.length === 0) return { ok: false, message: 'Member not found.' };
  revalidatePath('/my/family', 'page');
  return { ok: true };
}

function humaniseRelation(rel: string): string {
  const clean = rel.replace(/_/g, ' ').trim();
  return clean.charAt(0).toUpperCase() + clean.slice(1);
}

function approxDobFromAge(age: number): string {
  // Approximate July 1 of birth year — good enough for age-based eligibility
  // heuristics; the user will correct it on confirm if precision matters.
  const now = new Date();
  const year = now.getFullYear() - age;
  return `${year}-07-01`;
}
