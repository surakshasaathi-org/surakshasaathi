'use server';

import { createHash } from 'node:crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { serviceDb, schema } from '@suraksha/db';
import { requireAdminSession } from '@/lib/admin/auth';
import { uploadPolicyDocument, STORAGE_PATH_PREFIX } from '@/server/analyse/storage';

const TENANT_ID = '00000000-0000-0000-0000-000000000001';
const FIXTURE_PREFIX = 'eval-fixtures';
const MAX_PDF_BYTES = 20 * 1024 * 1024;

/**
 * Read + toggle + edit golden cases scoped to one agent. A case is "for" an
 * agent when the case's `tags` array contains the agent slug.
 */

export interface GoldenCaseRow {
  id: string;
  name: string;
  description: string | null;
  tags: string[];
  enabled: boolean;
  annotator: string | null;
  verifiedAt: string | null;
  createdAt: string;
  policyDocumentId: string | null;
}

export interface GoldenCaseDetail extends GoldenCaseRow {
  expectedExtraction: unknown;
  expectedCoverage: unknown;
  expectedChatQa: unknown;
  demographicsJson: unknown;
  updatedAt: string;
  attachment: AttachmentSummary | null;
}

export interface AttachmentSummary {
  id: string;
  mime: string;
  sizeBytes: number;
  pageCount: number | null;
  contentSha256: string;
  createdAt: string;
}

export interface VersionRollup {
  version: number;
  runs: number;
  passRate: number | null;
  avgScore: number | null;
  errors: number;
}

export interface CaseVersusRow {
  caseId: string;
  caseName: string;
  /** vA = baseline result for this case (latest run on baseline version). */
  baseline: { passed: boolean | null; qualityScore: number | null; runId: string | null } | null;
  /** vB = candidate result for this case (latest run on candidate version). */
  candidate: { passed: boolean | null; qualityScore: number | null; runId: string | null } | null;
  /** "improved" | "regressed" | "unchanged" | "missing" */
  delta: 'improved' | 'regressed' | 'unchanged' | 'missing';
}

export interface RegressionReport {
  agentSlug: string;
  baselineVersion: number;
  candidateVersion: number;
  rollupBaseline: VersionRollup;
  rollupCandidate: VersionRollup;
  cases: CaseVersusRow[];
  improved: number;
  regressed: number;
  unchanged: number;
  missing: number;
}

export async function getRegressionReport(args: {
  agentSlug: string;
  baselineVersion: number;
  candidateVersion: number;
}): Promise<RegressionReport> {
  await requireAdminSession(['super_admin', 'admin', 'content_editor', 'viewer']);
  const db = serviceDb();

  // Per-version aggregate over the latest 1000 runs (cheap; can window later).
  async function rollup(version: number): Promise<VersionRollup> {
    const rows = await db
      .select({
        passed: schema.evalRun.passed,
        qualityScore: schema.evalRun.qualityScore,
        errorMessage: schema.evalRun.errorMessage,
      })
      .from(schema.evalRun)
      .where(
        and(
          eq(schema.evalRun.agentSlug, args.agentSlug),
          eq(schema.evalRun.agentVersion, version),
        ),
      )
      .orderBy(desc(schema.evalRun.createdAt))
      .limit(1000);
    const total = rows.length;
    const withVerdict = rows.filter((r) => r.passed !== null).length;
    const passed = rows.filter((r) => r.passed === true).length;
    const errors = rows.filter((r) => r.errorMessage !== null).length;
    const scored = rows.filter((r) => r.qualityScore !== null);
    const avg =
      scored.length > 0
        ? Math.round(scored.reduce((s, r) => s + (r.qualityScore ?? 0), 0) / scored.length)
        : null;
    return {
      version,
      runs: total,
      passRate: withVerdict > 0 ? Math.round((passed / withVerdict) * 100) : null,
      avgScore: avg,
      errors,
    };
  }

  const [rollupBaseline, rollupCandidate] = await Promise.all([
    rollup(args.baselineVersion),
    rollup(args.candidateVersion),
  ]);

  // Per-case latest result for each version. We use latest-per-case to avoid
  // double-counting repeat runs of the same case (which is common when an
  // operator iterates).
  const caseRows = await db
    .select({ id: schema.evalGoldenCase.id, name: schema.evalGoldenCase.name })
    .from(schema.evalGoldenCase)
    .where(sql`${args.agentSlug} = ANY (${schema.evalGoldenCase.tags})`)
    .orderBy(desc(schema.evalGoldenCase.createdAt));

  async function latestForCaseVersion(caseId: string, version: number) {
    const [r] = await db
      .select({
        runId: schema.evalRun.id,
        passed: schema.evalRun.passed,
        qualityScore: schema.evalRun.qualityScore,
      })
      .from(schema.evalRun)
      .where(
        and(
          eq(schema.evalRun.agentSlug, args.agentSlug),
          eq(schema.evalRun.agentVersion, version),
          eq(schema.evalRun.goldenCaseId, caseId),
        ),
      )
      .orderBy(desc(schema.evalRun.createdAt))
      .limit(1);
    return r ?? null;
  }

  const cases: CaseVersusRow[] = [];
  let improved = 0;
  let regressed = 0;
  let unchanged = 0;
  let missing = 0;
  for (const c of caseRows) {
    const [b, cand] = await Promise.all([
      latestForCaseVersion(c.id, args.baselineVersion),
      latestForCaseVersion(c.id, args.candidateVersion),
    ]);
    let delta: CaseVersusRow['delta'] = 'unchanged';
    if (!b || !cand) {
      delta = 'missing';
      missing += 1;
    } else if (b.passed === false && cand.passed === true) {
      delta = 'improved';
      improved += 1;
    } else if (b.passed === true && cand.passed === false) {
      delta = 'regressed';
      regressed += 1;
    } else {
      // Score-based delta when verdicts match
      const bs = b.qualityScore ?? 0;
      const cs = cand.qualityScore ?? 0;
      if (cs > bs + 5) {
        delta = 'improved';
        improved += 1;
      } else if (cs < bs - 5) {
        delta = 'regressed';
        regressed += 1;
      } else {
        delta = 'unchanged';
        unchanged += 1;
      }
    }
    cases.push({
      caseId: c.id,
      caseName: c.name,
      baseline: b
        ? { passed: b.passed, qualityScore: b.qualityScore, runId: b.runId }
        : null,
      candidate: cand
        ? { passed: cand.passed, qualityScore: cand.qualityScore, runId: cand.runId }
        : null,
      delta,
    });
  }

  return {
    agentSlug: args.agentSlug,
    baselineVersion: args.baselineVersion,
    candidateVersion: args.candidateVersion,
    rollupBaseline,
    rollupCandidate,
    cases,
    improved,
    regressed,
    unchanged,
    missing,
  };
}

export async function getEvalRunDetail(runId: string): Promise<EvalRunDetail | null> {
  await requireAdminSession(['super_admin', 'admin', 'content_editor', 'viewer']);
  const db = serviceDb();
  const [run] = await db
    .select()
    .from(schema.evalRun)
    .where(eq(schema.evalRun.id, runId))
    .limit(1);
  if (!run) return null;

  const [goldenCase, agentDef, rubric, agentRun] = await Promise.all([
    run.goldenCaseId
      ? db
          .select()
          .from(schema.evalGoldenCase)
          .where(eq(schema.evalGoldenCase.id, run.goldenCaseId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    db
      .select()
      .from(schema.agentDefinition)
      .where(
        and(
          eq(schema.agentDefinition.slug, run.agentSlug),
          eq(schema.agentDefinition.version, run.agentVersion),
        ),
      )
      .limit(1)
      .then((rows) => rows[0] ?? null),
    run.rubricId
      ? db
          .select()
          .from(schema.evalRubric)
          .where(eq(schema.evalRubric.id, run.rubricId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
    run.agentRunId
      ? db
          .select()
          .from(schema.agentRun)
          .where(eq(schema.agentRun.id, run.agentRunId))
          .limit(1)
          .then((rows) => rows[0] ?? null)
      : Promise.resolve(null),
  ]);

  // Judge run = the agent_run whose parent_run_id = the under-test runId.
  const [judgeRun] = run.agentRunId
    ? await db
        .select()
        .from(schema.agentRun)
        .where(eq(schema.agentRun.parentRunId, run.agentRunId))
        .orderBy(desc(schema.agentRun.startedAt))
        .limit(1)
    : [null];

  function mapAgentRun(
    r: typeof schema.agentRun.$inferSelect | null | undefined,
  ): AgentRunDetail | null {
    if (!r) return null;
    return {
      id: r.id,
      agentSlug: r.agentSlug,
      agentVersion: r.agentVersion,
      parentRunId: r.parentRunId,
      inputSummary: r.inputSummary,
      attachedDocumentIds: r.attachedDocumentIds,
      outputJson: r.outputJson,
      confidence: r.confidence,
      outcome: r.outcome,
      modelUsed: r.modelUsed,
      promptTokens: r.promptTokens,
      completionTokens: r.completionTokens,
      cachedTokens: r.cachedTokens,
      costPaise: r.costPaise,
      latencyMs: r.latencyMs,
      startedAt: r.startedAt.toISOString(),
      endedAt: r.endedAt.toISOString(),
    };
  }

  return {
    evalRun: {
      id: run.id,
      trigger: run.trigger,
      qualityScore: run.qualityScore,
      passed: run.passed,
      errorMessage: run.errorMessage,
      judgeScoreJson: run.judgeScoreJson,
      costPaise: run.costPaise,
      latencyMs: run.latencyMs,
      createdAt: run.createdAt.toISOString(),
      ranBy: run.ranBy,
    },
    goldenCase: goldenCase
      ? {
          id: goldenCase.id,
          name: goldenCase.name,
          description: goldenCase.description,
          tags: goldenCase.tags,
          expectedExtraction: goldenCase.expectedExtraction,
          expectedCoverage: goldenCase.expectedCoverage,
          expectedChatQa: goldenCase.expectedChatQa,
          demographicsJson: goldenCase.demographicsJson,
        }
      : null,
    agent: agentDef
      ? {
          slug: agentDef.slug,
          version: agentDef.version,
          displayName: agentDef.displayName,
          modelTier: agentDef.modelTier,
          systemPrompt: agentDef.systemPrompt,
        }
      : null,
    rubric: rubric
      ? {
          id: rubric.id,
          version: rubric.version,
          judgeModelTier: rubric.judgeModelTier,
          judgePrompt: rubric.judgePrompt,
        }
      : null,
    agentRun: mapAgentRun(agentRun),
    judgeRun: mapAgentRun(judgeRun),
  };
}

async function loadAttachment(documentId: string | null): Promise<AttachmentSummary | null> {
  if (!documentId) return null;
  const db = serviceDb();
  const [r] = await db
    .select({
      id: schema.policyDocument.id,
      mime: schema.policyDocument.mime,
      sizeBytes: schema.policyDocument.sizeBytes,
      pageCount: schema.policyDocument.pageCount,
      contentSha256: schema.policyDocument.contentSha256,
      createdAt: schema.policyDocument.createdAt,
    })
    .from(schema.policyDocument)
    .where(eq(schema.policyDocument.id, documentId))
    .limit(1);
  if (!r) return null;
  return {
    id: r.id,
    mime: r.mime,
    sizeBytes: r.sizeBytes,
    pageCount: r.pageCount,
    contentSha256: r.contentSha256,
    createdAt: r.createdAt.toISOString(),
  };
}

export interface AgentVersionOption {
  version: number;
  isDefault: boolean;
  enabled: boolean;
  modelTier: string;
  createdAt: string;
}

export async function listAgentVersions(agentSlug: string): Promise<AgentVersionOption[]> {
  await requireAdminSession(['super_admin', 'admin', 'content_editor', 'viewer']);
  const db = serviceDb();
  const rows = await db
    .select({
      version: schema.agentDefinition.version,
      isDefault: schema.agentDefinition.isDefault,
      enabled: schema.agentDefinition.enabled,
      modelTier: schema.agentDefinition.modelTier,
      createdAt: schema.agentDefinition.createdAt,
    })
    .from(schema.agentDefinition)
    .where(eq(schema.agentDefinition.slug, agentSlug))
    .orderBy(desc(schema.agentDefinition.version));
  return rows.map((r) => ({
    version: r.version,
    isDefault: r.isDefault,
    enabled: r.enabled,
    modelTier: r.modelTier,
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface LastEvalRun {
  runId: string;
  passed: boolean | null;
  qualityScore: number | null;
  errorMessage: string | null;
  judgeScoreJson: unknown;
  costPaise: number;
  latencyMs: number | null;
  trigger: string;
  createdAt: string;
  agentRunId: string | null;
  agentVersion: number;
  rubricId: string | null;
}

export interface AgentRunDetail {
  id: string;
  agentSlug: string;
  agentVersion: number;
  parentRunId: string | null;
  inputSummary: string;
  attachedDocumentIds: string[];
  outputJson: unknown;
  confidence: number | null;
  outcome: string;
  modelUsed: string;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  costPaise: number;
  latencyMs: number;
  startedAt: string;
  endedAt: string;
}

export interface EvalRunDetail {
  evalRun: {
    id: string;
    trigger: string;
    qualityScore: number | null;
    passed: boolean | null;
    errorMessage: string | null;
    judgeScoreJson: unknown;
    costPaise: number;
    latencyMs: number | null;
    createdAt: string;
    ranBy: string | null;
  };
  goldenCase: {
    id: string;
    name: string;
    description: string | null;
    tags: string[];
    expectedExtraction: unknown;
    expectedCoverage: unknown;
    expectedChatQa: unknown;
    demographicsJson: unknown;
  } | null;
  agent: {
    slug: string;
    version: number;
    displayName: string;
    modelTier: string;
    systemPrompt: string;
  } | null;
  rubric: {
    id: string;
    version: number;
    judgeModelTier: string;
    judgePrompt: string;
  } | null;
  agentRun: AgentRunDetail | null;
  judgeRun: AgentRunDetail | null;
}

export async function getLastEvalRunsByCase(
  agentSlug: string,
  caseIds: string[],
): Promise<Map<string, LastEvalRun>> {
  await requireAdminSession(['super_admin', 'admin', 'content_editor', 'viewer']);
  const out = new Map<string, LastEvalRun>();
  if (caseIds.length === 0) return out;
  const db = serviceDb();
  // One round-trip per case is fine here — the case count for any single
  // agent is small. A window function would be cleaner with hundreds of cases.
  for (const caseId of caseIds) {
    const [r] = await db
      .select({
        id: schema.evalRun.id,
        passed: schema.evalRun.passed,
        qualityScore: schema.evalRun.qualityScore,
        errorMessage: schema.evalRun.errorMessage,
        judgeScoreJson: schema.evalRun.judgeScoreJson,
        costPaise: schema.evalRun.costPaise,
        latencyMs: schema.evalRun.latencyMs,
        trigger: schema.evalRun.trigger,
        createdAt: schema.evalRun.createdAt,
      })
      .from(schema.evalRun)
      .where(
        and(
          eq(schema.evalRun.agentSlug, agentSlug),
          eq(schema.evalRun.goldenCaseId, caseId),
        ),
      )
      .orderBy(desc(schema.evalRun.createdAt))
      .limit(1);
    if (r) {
      const [er] = await db
        .select({
          agentRunId: schema.evalRun.agentRunId,
          agentVersion: schema.evalRun.agentVersion,
          rubricId: schema.evalRun.rubricId,
        })
        .from(schema.evalRun)
        .where(eq(schema.evalRun.id, r.id))
        .limit(1);
      out.set(caseId, {
        runId: r.id,
        passed: r.passed,
        qualityScore: r.qualityScore,
        errorMessage: r.errorMessage,
        judgeScoreJson: r.judgeScoreJson,
        costPaise: r.costPaise,
        latencyMs: r.latencyMs,
        trigger: r.trigger,
        createdAt: r.createdAt.toISOString(),
        agentRunId: er?.agentRunId ?? null,
        agentVersion: er?.agentVersion ?? 0,
        rubricId: er?.rubricId ?? null,
      });
    }
  }
  return out;
}

export async function listGoldenCasesForAgent(agentSlug: string): Promise<GoldenCaseRow[]> {
  await requireAdminSession(['super_admin', 'admin', 'content_editor', 'viewer']);
  const db = serviceDb();
  const rows = await db
    .select()
    .from(schema.evalGoldenCase)
    .where(sql`${agentSlug} = ANY (${schema.evalGoldenCase.tags})`)
    .orderBy(desc(schema.evalGoldenCase.createdAt));
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    tags: r.tags,
    enabled: r.enabled,
    annotator: r.annotator,
    verifiedAt: r.verifiedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    policyDocumentId: r.policyDocumentId,
  }));
}

export async function toggleGoldenCase(args: {
  caseId: string;
  agentSlug: string;
  enabled: boolean;
}): Promise<{ ok: boolean }> {
  await requireAdminSession(['super_admin', 'admin', 'content_editor']);
  const db = serviceDb();
  await db
    .update(schema.evalGoldenCase)
    .set({ enabled: args.enabled })
    .where(eq(schema.evalGoldenCase.id, args.caseId));
  revalidatePath(`/agents/${args.agentSlug}/golden-cases`);
  revalidatePath(`/products/[slug]`, 'page');
  return { ok: true };
}

export async function getGoldenCase(caseId: string): Promise<GoldenCaseDetail | null> {
  await requireAdminSession(['super_admin', 'admin', 'content_editor', 'viewer']);
  const db = serviceDb();
  const [r] = await db
    .select()
    .from(schema.evalGoldenCase)
    .where(eq(schema.evalGoldenCase.id, caseId))
    .limit(1);
  if (!r) return null;
  const attachment = await loadAttachment(r.policyDocumentId);
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    tags: r.tags,
    enabled: r.enabled,
    annotator: r.annotator,
    verifiedAt: r.verifiedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    expectedExtraction: r.expectedExtraction,
    expectedCoverage: r.expectedCoverage,
    expectedChatQa: r.expectedChatQa,
    demographicsJson: r.demographicsJson,
    policyDocumentId: r.policyDocumentId,
    attachment,
  };
}

interface SaveCasePayload {
  name: string;
  description: string;
  tagsCsv: string;
  enabled: boolean;
  expectedExtractionJson: string;
  expectedCoverageJson: string;
  expectedChatQaJson: string;
  demographicsJson: string;
  /** Optional policy_document.id link. Null = clear; undefined = leave unchanged. */
  policyDocumentId?: string | null;
}

function parseJsonField(label: string, raw: string): { ok: true; value: unknown } | { ok: false; error: string } {
  const trimmed = raw.trim();
  if (trimmed === '' || trimmed === 'null') return { ok: true, value: null };
  try {
    return { ok: true, value: JSON.parse(trimmed) };
  } catch (err) {
    return { ok: false, error: `${label}: ${(err as Error).message}` };
  }
}

function parseTags(csv: string): string[] {
  return csv
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export async function updateGoldenCase(args: {
  caseId: string;
  agentSlug: string;
  payload: SaveCasePayload;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdminSession(['super_admin', 'admin', 'content_editor']);
  const db = serviceDb();

  const name = args.payload.name.trim();
  if (name.length < 3) return { ok: false, error: 'Name must be at least 3 characters.' };

  const extr = parseJsonField('expectedExtraction', args.payload.expectedExtractionJson);
  if (!extr.ok) return { ok: false, error: extr.error };
  const cov = parseJsonField('expectedCoverage', args.payload.expectedCoverageJson);
  if (!cov.ok) return { ok: false, error: cov.error };
  const qa = parseJsonField('expectedChatQa', args.payload.expectedChatQaJson);
  if (!qa.ok) return { ok: false, error: qa.error };
  const demo = parseJsonField('demographicsJson', args.payload.demographicsJson);
  if (!demo.ok) return { ok: false, error: demo.error };

  const setFields: Record<string, unknown> = {
    name,
    description: args.payload.description.trim() || null,
    tags: parseTags(args.payload.tagsCsv),
    enabled: args.payload.enabled,
    expectedExtraction: extr.value as never,
    expectedCoverage: cov.value as never,
    expectedChatQa: qa.value as never,
    demographicsJson: demo.value as never,
    annotator: session.email ?? 'admin',
    updatedAt: new Date(),
  };
  if (args.payload.policyDocumentId !== undefined) {
    setFields.policyDocumentId = args.payload.policyDocumentId;
  }

  await db
    .update(schema.evalGoldenCase)
    .set(setFields as never)
    .where(eq(schema.evalGoldenCase.id, args.caseId));

  revalidatePath(`/agents/${args.agentSlug}/golden-cases`);
  revalidatePath(`/agents/${args.agentSlug}/golden-cases/${args.caseId}`);
  revalidatePath(`/products/[slug]`, 'page');
  return { ok: true };
}

export async function createGoldenCase(args: {
  agentSlug: string;
  payload: SaveCasePayload;
}): Promise<{ ok: boolean; caseId?: string; error?: string }> {
  const session = await requireAdminSession(['super_admin', 'admin', 'content_editor']);
  const db = serviceDb();

  const name = args.payload.name.trim();
  if (name.length < 3) return { ok: false, error: 'Name must be at least 3 characters.' };

  const extr = parseJsonField('expectedExtraction', args.payload.expectedExtractionJson);
  if (!extr.ok) return { ok: false, error: extr.error };
  const cov = parseJsonField('expectedCoverage', args.payload.expectedCoverageJson);
  if (!cov.ok) return { ok: false, error: cov.error };
  const qa = parseJsonField('expectedChatQa', args.payload.expectedChatQaJson);
  if (!qa.ok) return { ok: false, error: qa.error };
  const demo = parseJsonField('demographicsJson', args.payload.demographicsJson);
  if (!demo.ok) return { ok: false, error: demo.error };

  // Always include the originating agent slug in tags so the case shows up
  // under that agent's golden-cases list immediately. Editors can prune later.
  const tags = parseTags(args.payload.tagsCsv);
  if (!tags.includes(args.agentSlug)) tags.push(args.agentSlug);

  const [inserted] = await db
    .insert(schema.evalGoldenCase)
    .values({
      name,
      description: args.payload.description.trim() || null,
      tags,
      enabled: args.payload.enabled,
      expectedExtraction: extr.value as never,
      expectedCoverage: cov.value as never,
      expectedChatQa: qa.value as never,
      demographicsJson: demo.value as never,
      annotator: session.email ?? 'admin',
      policyDocumentId: args.payload.policyDocumentId ?? null,
    })
    .returning({ id: schema.evalGoldenCase.id });

  revalidatePath(`/agents/${args.agentSlug}/golden-cases`);
  revalidatePath(`/products/[slug]`, 'page');
  return { ok: true, caseId: inserted?.id };
}

export async function deleteGoldenCase(args: {
  caseId: string;
  agentSlug: string;
}): Promise<{ ok: boolean }> {
  await requireAdminSession(['super_admin', 'admin', 'content_editor']);
  const db = serviceDb();
  await db.delete(schema.evalGoldenCase).where(eq(schema.evalGoldenCase.id, args.caseId));
  revalidatePath(`/agents/${args.agentSlug}/golden-cases`);
  revalidatePath(`/products/[slug]`, 'page');
  return { ok: true };
}

/**
 * Atomically swap the attachment on an existing golden case. Used by the
 * editor right after an upload completes so the link is durable without
 * requiring the operator to click Save.
 */
export async function setCaseAttachment(args: {
  caseId: string;
  agentSlug: string;
  policyDocumentId: string | null;
}): Promise<{ ok: boolean; error?: string }> {
  const session = await requireAdminSession(['super_admin', 'admin', 'content_editor']);
  const db = serviceDb();
  await db
    .update(schema.evalGoldenCase)
    .set({
      policyDocumentId: args.policyDocumentId,
      annotator: session.email ?? 'admin',
      updatedAt: new Date(),
    })
    .where(eq(schema.evalGoldenCase.id, args.caseId));
  revalidatePath(`/agents/${args.agentSlug}/golden-cases`);
  revalidatePath(`/agents/${args.agentSlug}/golden-cases/${args.caseId}`);
  revalidatePath(`/products/[slug]`, 'page');
  return { ok: true };
}

/**
 * Upload a PDF (or image) to use as a fixture for an eval golden case. Writes
 * the file to local storage (mirroring the customer-side path layout) and
 * inserts a `policy_document` row. Returns the new id; the case editor links
 * it onto `eval_golden_case.policy_document_id`.
 *
 * Note: production switches the storage layer to Supabase Storage. The path
 * stays the same shape; the resolver swaps.
 */
export async function uploadCaseAttachment(
  formData: FormData,
): Promise<{ ok: boolean; documentId?: string; error?: string }> {
  await requireAdminSession(['super_admin', 'admin', 'content_editor']);
  const file = formData.get('file');
  if (!(file instanceof File)) {
    return { ok: false, error: 'No file in upload' };
  }
  const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return { ok: false, error: `Unsupported mime: ${file.type}. Allowed: ${allowed.join(', ')}.` };
  }
  if (file.size > MAX_PDF_BYTES) {
    return { ok: false, error: `File too large (${file.size} bytes). Max ${MAX_PDF_BYTES}.` };
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const sha = createHash('sha256').update(buf).digest('hex');

  // Dedup: if a doc with this sha already exists, reuse it.
  const db = serviceDb();
  const [existing] = await db
    .select({ id: schema.policyDocument.id })
    .from(schema.policyDocument)
    .where(eq(schema.policyDocument.contentSha256, sha))
    .limit(1);
  if (existing) return { ok: true, documentId: existing.id };

  const ext = file.type === 'application/pdf' ? 'pdf' : file.type.split('/')[1] ?? 'bin';
  const storagePath = `${STORAGE_PATH_PREFIX}${FIXTURE_PREFIX}/${sha}.${ext}`;
  await uploadPolicyDocument(storagePath, buf, file.type);

  const expiresAt = new Date(Date.now() + 365 * 24 * 3600 * 1000); // 1 year
  const [inserted] = await db
    .insert(schema.policyDocument)
    .values({
      tenantId: TENANT_ID,
      storagePath,
      contentSha256: sha,
      mime: file.type,
      sizeBytes: buf.length,
      pageCount: null, // computing page count needs a PDF lib; fixture-only
      ocrStatus: 'pending',
      expiresAt,
    })
    .returning({ id: schema.policyDocument.id });

  return { ok: true, documentId: inserted?.id };
}
