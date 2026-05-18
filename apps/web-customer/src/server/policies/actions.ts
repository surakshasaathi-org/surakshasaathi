'use server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { serviceDb, schema } from '@suraksha/db';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * My Policies — canonical policy rows, each with their latest linked
 * analysis. A single policy can have many analyses across years of renewal;
 * we surface the latest in the list and link to all of them on click.
 */

export interface PolicyRow {
  id: string;
  insurerName: string;
  policyNumber: string;
  planName: string | null;
  planType: string | null;
  sumAssuredPaise: number | null;
  premiumPaise: number | null;
  startDate: string | null;
  endDate: string | null;
  nomineeName: string | null;
  networkHospitalCount: number | null;
  latestAnalysisId: string | null;
  latestAnalysisStatus: string | null;
  latestAnalysisAt: string | null;
  analysisCount: number;
  createdAt: string;
  updatedAt: string;
}

async function requireUserId(): Promise<string | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function listMyPolicies(): Promise<PolicyRow[]> {
  const userId = await requireUserId();
  if (!userId) return [];

  const db = serviceDb();
  const policies = await db
    .select()
    .from(schema.policy)
    .where(eq(schema.policy.userId, userId))
    .orderBy(desc(schema.policy.updatedAt));

  if (policies.length === 0) return [];

  // Batch-fetch analyses for these policies in one query. Avoids N+1.
  const policyIds = policies.map((p) => p.id);
  const analyses = await db
    .select({
      id: schema.policyAnalysis.id,
      policyId: schema.policyAnalysis.policyId,
      status: schema.policyAnalysis.status,
      createdAt: schema.policyAnalysis.createdAt,
    })
    .from(schema.policyAnalysis)
    .where(inArray(schema.policyAnalysis.policyId, policyIds))
    .orderBy(desc(schema.policyAnalysis.createdAt));

  // Group analyses by policy_id → compute latest + count.
  const byPolicy = new Map<
    string,
    { latest: typeof analyses[number] | null; count: number }
  >();
  for (const a of analyses) {
    if (!a.policyId) continue;
    const existing = byPolicy.get(a.policyId) ?? { latest: null, count: 0 };
    if (!existing.latest) existing.latest = a; // first is most recent due to ORDER BY
    existing.count += 1;
    byPolicy.set(a.policyId, existing);
  }

  return policies.map((p) => {
    const meta = (p.metadata as Record<string, unknown>) ?? {};
    const grouped = byPolicy.get(p.id);
    return {
      id: p.id,
      insurerName: p.insurerName,
      policyNumber: p.policyNumber,
      planName: (meta.plan_name as string) ?? null,
      planType: (meta.plan_type as string) ?? null,
      sumAssuredPaise: p.sumAssured,
      premiumPaise: p.premium,
      startDate: p.startDate,
      endDate: p.endDate,
      nomineeName: p.nomineeName,
      networkHospitalCount: (meta.network_hospital_count as number) ?? null,
      latestAnalysisId: grouped?.latest?.id ?? null,
      latestAnalysisStatus: grouped?.latest?.status ?? null,
      latestAnalysisAt: grouped?.latest?.createdAt.toISOString() ?? null,
      analysisCount: grouped?.count ?? 0,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  });
}

export async function deletePolicy(
  policyId: string,
): Promise<{ ok: boolean; message?: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: 'Please sign in.' };
  const db = serviceDb();
  // Cascade to analyses happens via FK ON DELETE SET NULL (the analyses
  // survive, they just lose their policy link). Users occasionally want to
  // delete a policy but keep the history — this preserves it.
  const res = await db
    .delete(schema.policy)
    .where(and(eq(schema.policy.id, policyId), eq(schema.policy.userId, userId)))
    .returning({ id: schema.policy.id });
  if (res.length === 0) return { ok: false, message: 'Policy not found.' };
  revalidatePath('/my/policies', 'page');
  revalidatePath('/my/analyses', 'page');
  return { ok: true };
}
