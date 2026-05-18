import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import type { AnalysisSummary, AnalysisStatus } from './analyses-fixture';
import { FIXTURE_ANALYSES, getAnalysis as getFixtureAnalysis } from './analyses-fixture';

/**
 * Admin analysis list/detail source. When DATABASE_URL is set, queries live
 * Postgres. When not, falls back to the seeded fixtures for UX preview.
 */

const HAS_DB = !!process.env.DATABASE_URL;

export async function listAnalyses(limit = 100): Promise<AnalysisSummary[]> {
  if (!HAS_DB) return FIXTURE_ANALYSES;

  const db = serviceDb();
  const rows = await db
    .select()
    .from(schema.policyAnalysis)
    .orderBy(desc(schema.policyAnalysis.createdAt))
    .limit(limit);

  const out: AnalysisSummary[] = [];
  for (const r of rows) {
    const [doc] = await db
      .select()
      .from(schema.policyDocument)
      .where(eq(schema.policyDocument.id, r.documentId))
      .limit(1);
    const report = r.reportJson as { basic_facts?: { insurer_name?: string; plan_name?: string } } | null;
    out.push({
      id: r.id.slice(0, 8),
      tenantId: r.tenantId,
      locale: r.locale,
      status: r.status as AnalysisStatus,
      progressStep: r.progressStep,
      readinessScore: r.readinessScore,
      confidenceOverall: r.confidenceOverall,
      redFlagsCount: r.redFlagsCount,
      costPaise: r.costPaise,
      errorCode: r.errorCode,
      insurerName: report?.basic_facts?.insurer_name ?? null,
      planName: report?.basic_facts?.plan_name ?? null,
      fileKind: doc?.mime ?? 'unknown',
      pageCount: doc?.pageCount ?? null,
      createdAt: r.createdAt.toISOString(),
      readyAt: r.readyAt?.toISOString() ?? null,
      expiresAt: r.expiresAt.toISOString(),
      durationSec:
        r.readyAt ? Math.round((r.readyAt.getTime() - r.createdAt.getTime()) / 1000) : null,
    });
  }
  return out;
}

export async function getAnalysisForAdmin(id: string): Promise<AnalysisSummary | null> {
  if (!HAS_DB) return getFixtureAnalysis(id);

  // Support both full UUIDs and prefix ids (our list uses 8-char prefixes).
  const db = serviceDb();
  const [row] =
    id.length >= 32
      ? await db.select().from(schema.policyAnalysis).where(eq(schema.policyAnalysis.id, id)).limit(1)
      : // fall back: list + find by prefix
        (await db.select().from(schema.policyAnalysis).orderBy(desc(schema.policyAnalysis.createdAt)).limit(200)).filter(
          (r) => r.id.startsWith(id),
        );
  if (!row) return null;
  const [doc] = await db.select().from(schema.policyDocument).where(eq(schema.policyDocument.id, row.documentId)).limit(1);
  const report = row.reportJson as { basic_facts?: { insurer_name?: string; plan_name?: string } } | null;
  return {
    id: row.id.slice(0, 8),
    tenantId: row.tenantId,
    locale: row.locale,
    status: row.status as AnalysisStatus,
    progressStep: row.progressStep,
    readinessScore: row.readinessScore,
    confidenceOverall: row.confidenceOverall,
    redFlagsCount: row.redFlagsCount,
    costPaise: row.costPaise,
    errorCode: row.errorCode,
    insurerName: report?.basic_facts?.insurer_name ?? null,
    planName: report?.basic_facts?.plan_name ?? null,
    fileKind: doc?.mime ?? 'unknown',
    pageCount: doc?.pageCount ?? null,
    createdAt: row.createdAt.toISOString(),
    readyAt: row.readyAt?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
    durationSec:
      row.readyAt ? Math.round((row.readyAt.getTime() - row.createdAt.getTime()) / 1000) : null,
  };
}

export function hasLiveDb(): boolean {
  return HAS_DB;
}

export interface AgentRunRow {
  id: string;
  agentSlug: string;
  agentVersion: number;
  modelUsed: string;
  modelTier: 'opus' | 'sonnet' | 'haiku' | 'unknown';
  outcome: string;
  confidence: number | null;
  promptTokens: number;
  completionTokens: number;
  costPaise: number;
  latencyMs: number;
  startedAt: string;
}

/**
 * Lists agent_run rows tied to a policy_analysis via agent_run.analysis_id.
 * Accepts a full UUID or the 8-char prefix used in the admin list view.
 */
export async function getAgentRunsForAnalysis(idOrPrefix: string): Promise<AgentRunRow[]> {
  if (!HAS_DB) return [];

  const db = serviceDb();
  const fullId =
    idOrPrefix.length >= 32
      ? idOrPrefix
      : (
          await db
            .select({ id: schema.policyAnalysis.id })
            .from(schema.policyAnalysis)
            .orderBy(desc(schema.policyAnalysis.createdAt))
            .limit(200)
        ).find((r) => r.id.startsWith(idOrPrefix))?.id;
  if (!fullId) return [];

  const runs = await db
    .select()
    .from(schema.agentRun)
    .where(eq(schema.agentRun.analysisId, fullId))
    .orderBy(schema.agentRun.startedAt);

  // Resolve modelTier per slug from agent_definition (default version).
  const slugs = Array.from(new Set(runs.map((r) => r.agentSlug)));
  const tierBySlug = new Map<string, 'opus' | 'sonnet' | 'haiku'>();
  if (slugs.length > 0) {
    const { inArray } = await import('drizzle-orm');
    const defs = await db
      .select({ slug: schema.agentDefinition.slug, modelTier: schema.agentDefinition.modelTier, isDefault: schema.agentDefinition.isDefault })
      .from(schema.agentDefinition)
      .where(inArray(schema.agentDefinition.slug, slugs));
    for (const d of defs) {
      if (d.isDefault) tierBySlug.set(d.slug, d.modelTier as 'opus' | 'sonnet' | 'haiku');
    }
  }

  return runs.map((r) => ({
    id: r.id,
    agentSlug: r.agentSlug,
    agentVersion: r.agentVersion,
    modelUsed: r.modelUsed,
    modelTier: tierBySlug.get(r.agentSlug) ?? 'unknown',
    outcome: r.outcome,
    confidence: r.confidence,
    promptTokens: r.promptTokens,
    completionTokens: r.completionTokens,
    costPaise: r.costPaise,
    latencyMs: r.latencyMs,
    startedAt: r.startedAt.toISOString(),
  }));
}

export interface AgentRunDocument {
  id: string;
  storagePath: string | null;
  mime: string;
  sizeBytes: number;
  pageCount: number | null;
  filename: string | null;
  contentSha256: string | null;
  createdAt: string;
}

export interface AgentRunDetail {
  id: string;
  tenantId: string;
  analysisId: string | null;
  caseId: string | null;
  parentRunId: string | null;
  agentSlug: string;
  agentVersion: number;
  agentDisplayName: string | null;
  agentSystemPrompt: string | null;
  modelUsed: string;
  modelTier: string;
  runSource: string;
  deployEnv: string;
  outcome: string;
  confidence: number | null;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  costPaise: number;
  latencyMs: number;
  inputSummary: string;
  outputJson: unknown;
  attachedDocumentIds: string[];
  attachedDocuments: AgentRunDocument[];
  userVisibleSummary: string | null;
  startedAt: string;
  endedAt: string;
}

/**
 * One agent_run row enriched with its agent_definition (for the system prompt
 * and display name). Used by /agent-runs/[runId] to render the full trace.
 */
export async function getAgentRunDetail(runId: string): Promise<AgentRunDetail | null> {
  if (!HAS_DB) return null;
  const db = serviceDb();
  const [r] = await db
    .select()
    .from(schema.agentRun)
    .where(eq(schema.agentRun.id, runId))
    .limit(1);
  if (!r) return null;

  const { and, inArray } = await import('drizzle-orm');
  const [def] = await db
    .select()
    .from(schema.agentDefinition)
    .where(
      and(
        eq(schema.agentDefinition.slug, r.agentSlug),
        eq(schema.agentDefinition.version, r.agentVersion),
      ),
    )
    .limit(1);

  // Resolve attached_document_ids → policy_document rows so the trace page
  // shows file names / sizes / pages instead of raw UUIDs. Empty array when
  // the run had no attachments (e.g. refine, chat) or the rows are gone.
  const attachedDocuments: AgentRunDocument[] = [];
  if (r.attachedDocumentIds.length > 0) {
    const docs = await db
      .select()
      .from(schema.policyDocument)
      .where(inArray(schema.policyDocument.id, r.attachedDocumentIds));
    for (const d of docs) {
      const filename = (d.extracted as { filename?: string } | null)?.filename ?? null;
      attachedDocuments.push({
        id: d.id,
        storagePath: d.storagePath,
        mime: d.mime,
        sizeBytes: d.sizeBytes,
        pageCount: d.pageCount,
        filename,
        contentSha256: d.contentSha256,
        createdAt: d.createdAt.toISOString(),
      });
    }
  }

  return {
    id: r.id,
    tenantId: r.tenantId,
    analysisId: r.analysisId,
    caseId: r.caseId,
    parentRunId: r.parentRunId,
    agentSlug: r.agentSlug,
    agentVersion: r.agentVersion,
    agentDisplayName: def?.displayName ?? null,
    agentSystemPrompt: def?.systemPrompt ?? null,
    modelUsed: r.modelUsed,
    modelTier: def?.modelTier ?? 'unknown',
    runSource: r.runSource,
    deployEnv: r.deployEnv,
    outcome: r.outcome,
    confidence: r.confidence,
    promptTokens: r.promptTokens,
    completionTokens: r.completionTokens,
    cachedTokens: r.cachedTokens,
    costPaise: r.costPaise,
    latencyMs: r.latencyMs,
    inputSummary: r.inputSummary,
    outputJson: r.outputJson,
    attachedDocumentIds: r.attachedDocumentIds,
    attachedDocuments,
    userVisibleSummary: r.userVisibleSummary,
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt.toISOString(),
  };
}

export interface AnalysisTraceRun {
  id: string;
  agentSlug: string;
  agentVersion: number;
  modelUsed: string;
  modelTier: string;
  outcome: string;
  confidence: number | null;
  promptTokens: number;
  completionTokens: number;
  cachedTokens: number;
  costPaise: number;
  latencyMs: number;
  inputSummary: string;
  outputJson: unknown;
  startedAt: string;
  endedAt: string;
  parentRunId: string | null;
}

/**
 * Full ordered trace of every agent_run for one analysis — input + output for
 * each call. Single fetch + a tier-resolution batch; renders as the timeline
 * view at /analyses/[id]/trace.
 */
export async function getAnalysisTrace(idOrPrefix: string): Promise<AnalysisTraceRun[]> {
  if (!HAS_DB) return [];
  const db = serviceDb();
  const fullId =
    idOrPrefix.length >= 32
      ? idOrPrefix
      : (
          await db
            .select({ id: schema.policyAnalysis.id })
            .from(schema.policyAnalysis)
            .orderBy(desc(schema.policyAnalysis.createdAt))
            .limit(200)
        ).find((r) => r.id.startsWith(idOrPrefix))?.id;
  if (!fullId) return [];

  const runs = await db
    .select()
    .from(schema.agentRun)
    .where(eq(schema.agentRun.analysisId, fullId))
    .orderBy(schema.agentRun.startedAt);

  const slugs = Array.from(new Set(runs.map((r) => r.agentSlug)));
  const tierBySlug = new Map<string, string>();
  if (slugs.length > 0) {
    const { inArray } = await import('drizzle-orm');
    const defs = await db
      .select({
        slug: schema.agentDefinition.slug,
        modelTier: schema.agentDefinition.modelTier,
        isDefault: schema.agentDefinition.isDefault,
      })
      .from(schema.agentDefinition)
      .where(inArray(schema.agentDefinition.slug, slugs));
    for (const d of defs) {
      if (d.isDefault) tierBySlug.set(d.slug, d.modelTier as string);
    }
  }

  return runs.map((r) => ({
    id: r.id,
    agentSlug: r.agentSlug,
    agentVersion: r.agentVersion,
    modelUsed: r.modelUsed,
    modelTier: tierBySlug.get(r.agentSlug) ?? 'unknown',
    outcome: r.outcome,
    confidence: r.confidence,
    promptTokens: r.promptTokens,
    completionTokens: r.completionTokens,
    cachedTokens: r.cachedTokens,
    costPaise: r.costPaise,
    latencyMs: r.latencyMs,
    inputSummary: r.inputSummary,
    outputJson: r.outputJson,
    startedAt: r.startedAt.toISOString(),
    endedAt: r.endedAt.toISOString(),
    parentRunId: r.parentRunId,
  }));
}
