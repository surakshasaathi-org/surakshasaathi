import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import type { ExtractorOutput } from './report-v2-types';

/**
 * Normalise a numeric amount to integer rupees. LLMs sometimes emit paise
 * despite our prompt asking for rupees — we catch that by size. Realistic
 * Indian health-insurance sum insured sits between ₹50,000 and ₹50 Cr
 * (50_000_000). Anything larger is almost certainly paise and gets ÷100.
 */
function normaliseRupees(raw: number | null | undefined): number | null {
  if (raw == null) return null;
  if (raw <= 0) return null;
  // Anything over 50 Cr rupees is implausible for a consumer policy — almost
  // certainly an LLM paise slip-up. Divide back to rupees.
  if (raw > 500_000_000) return Math.round(raw / 100);
  return Math.round(raw);
}

/**
 * Upsert-or-link the canonical `policy` row this analysis describes and
 * return its id. Called from the pipeline after a successful extractor run.
 *
 * Matching key: (user_id, insurer_name_normalised, policy_number). If the
 * same user uploads the same policy again (e.g. next year's renewal), we
 * reuse the existing row — so "My Policies" shows one entry with multiple
 * analyses stacked underneath.
 *
 * Anonymous analyses (no user_id) don't get linked to a policy row — there's
 * no durable owner yet. When the user later signs in and claims the analysis,
 * a future enhancement can back-fill the link; for now it stays NULL, which
 * is fine: the "My Policies" page simply ignores unlinked analyses.
 */
export async function linkAnalysisToPolicy(
  analysisId: string,
  tenantId: string,
  userId: string | null,
  extractor: ExtractorOutput,
): Promise<string | null> {
  if (!userId) return null;

  const bf = extractor.basic_facts;
  const insurer = (bf.insurer_name ?? '').trim();
  const policyNumber = (bf.policy_number ?? '').trim();
  if (!insurer || !policyNumber) {
    // Extractor couldn't identify the policy — skip linking rather than
    // creating a junk row. The analysis still renders fine without a link.
    return null;
  }

  const db = serviceDb();

  // Match case-insensitively on insurer name + exact on policy number.
  // Drizzle doesn't have a clean ilike+normalise combinator, so use raw sql
  // only where needed and parameterised to stay injection-safe.
  const existing = await db
    .select()
    .from(schema.policy)
    .where(
      and(
        eq(schema.policy.userId, userId),
        eq(schema.policy.policyNumber, policyNumber),
      ),
    )
    .limit(1);

  let policyId: string;
  if (existing.length > 0 && existing[0]!.insurerName.toLowerCase() === insurer.toLowerCase()) {
    // Update the known-fresh fields from this upload (sum assured, premium,
    // period, nominee can all change year-on-year).
    const [row] = await db
      .update(schema.policy)
      .set({
        insurerName: insurer,
        sumAssured: normaliseRupees(bf.sum_insured_rupees),
        premium: normaliseRupees(bf.premium_rupees),
        startDate: bf.period_start ?? null,
        endDate: bf.period_end ?? null,
        nomineeName: bf.nominee_name ?? null,
        metadata: {
          ...(existing[0]!.metadata as Record<string, unknown>),
          plan_name: bf.plan_name,
          family_type: bf.family_type,
          plan_type: bf.plan_type,
          network_hospital_count: bf.network_hospital_count,
        },
        updatedAt: new Date(),
      })
      .where(eq(schema.policy.id, existing[0]!.id))
      .returning({ id: schema.policy.id });
    policyId = row!.id;
  } else {
    // Fresh policy row. line_id is required (FK) — health is the only live
    // line today; future multi-line uploads can map extractor metadata.
    const [row] = await db
      .insert(schema.policy)
      .values({
        id: randomUUID(),
        tenantId,
        userId,
        lineId: 'health',
        insurerName: insurer,
        policyNumber,
        sumAssured: normaliseRupees(bf.sum_insured_rupees),
        premium: normaliseRupees(bf.premium_rupees),
        startDate: bf.period_start ?? null,
        endDate: bf.period_end ?? null,
        nomineeName: bf.nominee_name ?? null,
        metadata: {
          plan_name: bf.plan_name,
          family_type: bf.family_type,
          plan_type: bf.plan_type,
          network_hospital_count: bf.network_hospital_count,
        },
      })
      .returning({ id: schema.policy.id });
    policyId = row!.id;
  }

  // Write the back-ref onto the analysis row.
  await db
    .update(schema.policyAnalysis)
    .set({ policyId })
    .where(eq(schema.policyAnalysis.id, analysisId));

  return policyId;
}
