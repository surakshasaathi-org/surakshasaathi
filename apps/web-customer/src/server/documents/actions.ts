'use server';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { serviceDb, schema } from '@suraksha/db';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * Documents vault — unified read over every PDF/image the user has ever
 * uploaded, scoped to a known context (policy / case). We intentionally do
 * NOT expose a freeform upload surface here; all uploads happen from a
 * context (Analyse My Policy, File a claim) and land in this view.
 *
 * Sources:
 *   - policy_document — uploaded for Analyse My Policy. Linked via
 *     policy_analysis.document_id → policy_analysis.policy_id.
 *   - document — uploaded for claims/cases.
 */

export interface VaultRow {
  id: string;
  source: 'policy' | 'case';
  filename: string;
  mime: string;
  sizeBytes: number;
  storagePath: string | null;
  uploadedAt: string;
  contextLabel: string; // "Policy: ACKO · Platinum Plan" or "Claim: hospitalisation"
  contextHref: string | null;
  analysisId?: string | null;
  policyId?: string | null;
  caseId?: string | null;
}

async function requireUserId(): Promise<string | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function listMyDocuments(): Promise<VaultRow[]> {
  const userId = await requireUserId();
  if (!userId) return [];
  const db = serviceDb();

  // Policy documents — join via policy_analysis to find the user's analyses,
  // then the policy_document rows referenced. Kept in one query so we don't
  // N+1 for a user with many analyses.
  const policyDocs = await db
    .select({
      analysisId: schema.policyAnalysis.id,
      policyId: schema.policyAnalysis.policyId,
      documentId: schema.policyDocument.id,
      extracted: schema.policyDocument.extracted,
      mime: schema.policyDocument.mime,
      sizeBytes: schema.policyDocument.sizeBytes,
      storagePath: schema.policyDocument.storagePath,
      createdAt: schema.policyDocument.createdAt,
    })
    .from(schema.policyAnalysis)
    .innerJoin(
      schema.policyDocument,
      eq(schema.policyDocument.id, schema.policyAnalysis.documentId),
    )
    .where(eq(schema.policyAnalysis.userId, userId))
    .orderBy(desc(schema.policyDocument.createdAt));

  // Case documents — filter by uploaderUserId; left-join cases to label by
  // case kind. Users without cases (most today) simply have an empty list.
  const caseDocs = await db
    .select({
      id: schema.document.id,
      extracted: schema.document.extracted,
      mime: schema.document.mime,
      sizeBytes: schema.document.sizeBytes,
      storagePath: schema.document.storagePath,
      createdAt: schema.document.createdAt,
      caseId: schema.document.caseId,
    })
    .from(schema.document)
    .where(eq(schema.document.uploaderUserId, userId))
    .orderBy(desc(schema.document.createdAt));

  // Resolve policy labels for the policy-doc context.
  const policyIds = [
    ...new Set(policyDocs.map((d) => d.policyId).filter((x): x is string => !!x)),
  ];
  const policies = policyIds.length
    ? await db.select().from(schema.policy).where(inArray(schema.policy.id, policyIds))
    : [];
  const policyMap = new Map(policies.map((p) => [p.id, p]));

  const rows: VaultRow[] = [];

  for (const d of policyDocs) {
    const policyLabel = d.policyId
      ? (() => {
          const p = policyMap.get(d.policyId);
          if (!p) return 'Policy analysis';
          const plan = (p.metadata as Record<string, unknown>)?.plan_name as string | undefined;
          return `${p.insurerName}${plan ? ' · ' + plan : ''}`;
        })()
      : 'Policy analysis';

    rows.push({
      id: d.documentId,
      source: 'policy',
      filename: ((d.extracted as Record<string, unknown>)?.filename as string) ?? 'Policy document',
      mime: d.mime,
      sizeBytes: d.sizeBytes,
      storagePath: d.storagePath,
      uploadedAt: d.createdAt.toISOString(),
      contextLabel: `Policy · ${policyLabel}`,
      contextHref: d.analysisId ? `/policy-health-score/analysis/${d.analysisId}` : null,
      analysisId: d.analysisId,
      policyId: d.policyId,
    });
  }

  for (const d of caseDocs) {
    rows.push({
      id: d.id,
      source: 'case',
      filename: ((d.extracted as Record<string, unknown>)?.filename as string) ?? 'Claim document',
      mime: d.mime,
      sizeBytes: d.sizeBytes,
      storagePath: d.storagePath,
      uploadedAt: d.createdAt.toISOString(),
      contextLabel: d.caseId ? 'Claim' : 'Uncategorised',
      contextHref: d.caseId ? `/my/claims/${d.caseId}` : null,
      caseId: d.caseId,
    });
  }

  rows.sort((a, b) => (a.uploadedAt < b.uploadedAt ? 1 : -1));
  return rows;
}

/**
 * Delete a document the user owns. Cascades via FK on the policy-analysis
 * row (document removal unlinks analyses that referenced it — the analysis
 * itself stays). Case documents just disappear. Always-manual — ops-visible
 * via audit_log, not exposed as an auto-purge.
 */
export async function deleteDocument(
  documentId: string,
  source: 'policy' | 'case',
): Promise<{ ok: boolean; message?: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: 'Please sign in.' };
  const db = serviceDb();

  if (source === 'policy') {
    // Policy documents are protected — only delete if the user owns every
    // analysis that references this document.
    const analyses = await db
      .select({ id: schema.policyAnalysis.id, userId: schema.policyAnalysis.userId })
      .from(schema.policyAnalysis)
      .where(eq(schema.policyAnalysis.documentId, documentId));
    if (analyses.some((a) => a.userId !== userId)) {
      return { ok: false, message: 'Cannot delete — this document is shared.' };
    }
    const res = await db
      .delete(schema.policyDocument)
      .where(eq(schema.policyDocument.id, documentId))
      .returning({ id: schema.policyDocument.id });
    if (res.length === 0) return { ok: false, message: 'Document not found.' };
  } else {
    const res = await db
      .delete(schema.document)
      .where(
        and(eq(schema.document.id, documentId), eq(schema.document.uploaderUserId, userId)),
      )
      .returning({ id: schema.document.id });
    if (res.length === 0) return { ok: false, message: 'Document not found.' };
  }

  revalidatePath('/my/documents', 'page');
  return { ok: true };
}
