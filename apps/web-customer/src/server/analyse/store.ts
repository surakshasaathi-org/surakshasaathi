import 'server-only';
import { eq, desc, sql } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import type { AnalysisReport } from './demo-report';

/**
 * DB-backed analysis store with in-memory fallback for dev-without-DB.
 *
 * When DATABASE_URL is set → reads/writes Postgres (policy_analysis + policy_document).
 * When not set → module-level Map (survives across HMR via globalThis).
 *
 * Same public interface either way, so pipeline / UI / admin don't care.
 */

export type AnalysisStatus =
  | 'queued'
  | 'digitizing'
  | 'ocr_running'
  | 'intake_running'
  | 'extracting'
  | 'analysing'
  | 'translating'
  | 'reviewing'
  | 'ready'
  | 'failed';

export interface AnalysisRecord {
  id: string;
  sessionToken: string;
  tenantId: string;
  /** Signed-in user who owns this analysis. NULL for anonymous uploads. */
  userId: string | null;
  locale: string;
  status: AnalysisStatus;
  progressStep: string | null;
  createdAt: string;
  expiresAt: string;
  startedAt: string | null;
  readyAt: string | null;
  report: AnalysisReport | null;
  errorCode: string | null;
  errorMessage: string | null;
  costPaise: number;
  readinessScore: number | null;
  redFlagsCount: number | null;
  confidenceOverall: number | null;
  /** User-supplied supplemental form (DemographicsInput). Null when the user skipped. */
  demographics: Record<string, unknown> | null;
  agentRunIds: string[];
  /** policy_document.id for the uploaded PDF/image. Threaded into agent_run.
   *  attached_document_ids so the admin trace links the run to its source. */
  documentId: string | null;
  fileMeta: {
    name: string;
    mime: string;
    size: number;
    pageCount: number | null;
    storagePath: string | null;
    sha256: string | null;
  };
}

export interface AnalysisStore {
  create(init: Omit<AnalysisRecord, 'createdAt' | 'expiresAt' | 'documentId'>): Promise<AnalysisRecord>;
  get(id: string): Promise<AnalysisRecord | null>;
  /** Like get(), but returns the row even if expired. Used to distinguish
   *  "gone" from "never existed" when returning 410 vs 404. */
  getExpired(id: string): Promise<AnalysisRecord | null>;
  update(id: string, patch: Partial<AnalysisRecord>): Promise<AnalysisRecord | null>;
  delete(id: string): Promise<boolean>;
  listRecent(limit?: number): Promise<AnalysisRecord[]>;
}

// Log the path at import-time so we see in the server log which store is active.
const HAS_DB = !!process.env.DATABASE_URL;
console.log(`[analysis-store] HAS_DB=${HAS_DB}  DATABASE_URL=${process.env.DATABASE_URL ? 'set' : 'unset'}`);

// ────────────────────────────────────────────────
// DB-backed implementation
// ────────────────────────────────────────────────

function dbRowToRecord(
  row: typeof schema.policyAnalysis.$inferSelect,
  docRow?: typeof schema.policyDocument.$inferSelect | null,
): AnalysisRecord {
  return {
    id: row.id,
    sessionToken: row.sessionToken,
    tenantId: row.tenantId,
    userId: row.userId ?? null,
    locale: row.locale,
    status: row.status as AnalysisStatus,
    progressStep: row.progressStep,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    startedAt: row.startedAt?.toISOString() ?? null,
    readyAt: row.readyAt?.toISOString() ?? null,
    report: (row.reportJson as AnalysisReport | null) ?? null,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    costPaise: row.costPaise,
    readinessScore: row.readinessScore,
    redFlagsCount: row.redFlagsCount,
    confidenceOverall: row.confidenceOverall,
    demographics: (row.demographicsJson as Record<string, unknown> | null) ?? null,
    agentRunIds: row.agentRunIds,
    documentId: row.documentId ?? null,
    fileMeta: {
      name: (docRow?.extracted as { filename?: string } | null)?.filename ?? '—',
      mime: docRow?.mime ?? 'application/octet-stream',
      size: docRow?.sizeBytes ?? 0,
      pageCount: docRow?.pageCount ?? null,
      storagePath: docRow?.storagePath ?? null,
      sha256: docRow?.contentSha256 ?? null,
    },
  };
}

class DbStore implements AnalysisStore {
  async create(init: Omit<AnalysisRecord, 'createdAt' | 'expiresAt' | 'documentId'>): Promise<AnalysisRecord> {
    const db = serviceDb();
    const expires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const [docRow] = await db
      .insert(schema.policyDocument)
      .values({
        tenantId: init.tenantId,
        storagePath: init.fileMeta.storagePath ?? `dev-local/${init.id}`,
        contentSha256: init.fileMeta.sha256 ?? 'unknown',
        mime: init.fileMeta.mime,
        sizeBytes: init.fileMeta.size,
        pageCount: init.fileMeta.pageCount ?? null,
        ocrStatus: 'pending',
        extracted: { filename: init.fileMeta.name },
        expiresAt: expires,
      })
      .returning();

    const [row] = await db
      .insert(schema.policyAnalysis)
      .values({
        id: init.id,
        tenantId: init.tenantId,
        documentId: docRow!.id,
        sessionToken: init.sessionToken,
        userId: init.userId ?? null,
        locale: init.locale,
        status: init.status,
        progressStep: init.progressStep,
        costPaise: init.costPaise,
        agentRunIds: init.agentRunIds,
        demographicsJson: init.demographics ?? null,
        expiresAt: expires,
      })
      .returning();

    return dbRowToRecord(row!, docRow!);
  }

  async get(id: string): Promise<AnalysisRecord | null> {
    const db = serviceDb();
    const [row] = await db
      .select()
      .from(schema.policyAnalysis)
      .where(eq(schema.policyAnalysis.id, id))
      .limit(1);
    if (!row) return null;
    if (row.expiresAt < new Date()) return null;
    const [doc] = await db
      .select()
      .from(schema.policyDocument)
      .where(eq(schema.policyDocument.id, row.documentId))
      .limit(1);
    return dbRowToRecord(row, doc ?? null);
  }

  async getExpired(id: string): Promise<AnalysisRecord | null> {
    const db = serviceDb();
    const [row] = await db
      .select()
      .from(schema.policyAnalysis)
      .where(eq(schema.policyAnalysis.id, id))
      .limit(1);
    if (!row || row.expiresAt >= new Date()) return null;
    const [doc] = await db
      .select()
      .from(schema.policyDocument)
      .where(eq(schema.policyDocument.id, row.documentId))
      .limit(1);
    return dbRowToRecord(row, doc ?? null);
  }

  async update(id: string, patch: Partial<AnalysisRecord>): Promise<AnalysisRecord | null> {
    const db = serviceDb();
    const set: Record<string, unknown> = {};
    if (patch.status !== undefined) set.status = patch.status;
    if (patch.progressStep !== undefined) set.progressStep = patch.progressStep;
    if (patch.startedAt !== undefined) set.startedAt = patch.startedAt ? new Date(patch.startedAt) : null;
    if (patch.readyAt !== undefined) set.readyAt = patch.readyAt ? new Date(patch.readyAt) : null;
    if (patch.report !== undefined) set.reportJson = patch.report;
    if (patch.readinessScore !== undefined) set.readinessScore = patch.readinessScore;
    if (patch.redFlagsCount !== undefined) set.redFlagsCount = patch.redFlagsCount;
    if (patch.confidenceOverall !== undefined) set.confidenceOverall = patch.confidenceOverall;
    if (patch.costPaise !== undefined) set.costPaise = patch.costPaise;
    if (patch.errorCode !== undefined) set.errorCode = patch.errorCode;
    if (patch.errorMessage !== undefined) set.errorMessage = patch.errorMessage;
    if (patch.agentRunIds !== undefined) set.agentRunIds = patch.agentRunIds;
    if (patch.demographics !== undefined) set.demographicsJson = patch.demographics;

    if (Object.keys(set).length === 0) return this.get(id);

    const [row] = await db
      .update(schema.policyAnalysis)
      .set(set)
      .where(eq(schema.policyAnalysis.id, id))
      .returning();
    if (!row) return null;
    const [doc] = await db
      .select()
      .from(schema.policyDocument)
      .where(eq(schema.policyDocument.id, row.documentId))
      .limit(1);
    return dbRowToRecord(row, doc ?? null);
  }

  async delete(id: string): Promise<boolean> {
    const db = serviceDb();
    const res = await db
      .delete(schema.policyAnalysis)
      .where(eq(schema.policyAnalysis.id, id))
      .returning({ id: schema.policyAnalysis.id });
    return res.length > 0;
  }

  async listRecent(limit = 100): Promise<AnalysisRecord[]> {
    const db = serviceDb();
    const rows = await db
      .select()
      .from(schema.policyAnalysis)
      .orderBy(desc(schema.policyAnalysis.createdAt))
      .limit(limit);
    const out: AnalysisRecord[] = [];
    for (const r of rows) {
      const [d] = await db
        .select()
        .from(schema.policyDocument)
        .where(eq(schema.policyDocument.id, r.documentId))
        .limit(1);
      out.push(dbRowToRecord(r, d ?? null));
    }
    return out;
  }
}

/**
 * Atomic "bump cost + append run id" — used by concurrent chat turns and the
 * pipeline orchestrator to avoid lost-update races where two finalize()s both
 * read `rec.costPaise = X`, each add their delta, and overwrite with the
 * other's computed total (losing cost *and* one agent_run_id).
 *
 * Also enforces a hard per-analysis cost cap atomically — the UPDATE's WHERE
 * fails to match if costPaise + delta would exceed cap, so we can detect the
 * overflow and surface it to the caller.
 *
 * For the MemoryStore path (dev-without-DB), we fall back to the non-atomic
 * update; single-process, no real concurrency.
 */
export async function incrementAnalysisCost(
  analysisId: string,
  costDeltaPaise: number,
  agentRunId: string,
  capPaise?: number,
): Promise<{ ok: true } | { ok: false; reason: 'cap_exceeded' | 'not_found' }> {
  if (!process.env.DATABASE_URL) {
    const store = getAnalysisStore();
    const rec = await store.get(analysisId);
    if (!rec) return { ok: false, reason: 'not_found' };
    if (capPaise != null && rec.costPaise + costDeltaPaise > capPaise) {
      return { ok: false, reason: 'cap_exceeded' };
    }
    await store.update(analysisId, {
      costPaise: rec.costPaise + costDeltaPaise,
      agentRunIds: [...rec.agentRunIds, agentRunId],
    });
    return { ok: true };
  }

  const db = serviceDb();
  const capClause = capPaise != null ? sql` AND cost_paise + ${costDeltaPaise} <= ${capPaise}` : sql``;
  const result = await db.execute(sql`
    UPDATE policy_analysis
    SET cost_paise = cost_paise + ${costDeltaPaise},
        agent_run_ids = array_append(agent_run_ids, ${agentRunId}::uuid)
    WHERE id = ${analysisId}::uuid${capClause}
    RETURNING id
  `);
  const rowCount = Array.isArray(result) ? result.length : (result as { rowCount?: number }).rowCount ?? 0;
  if (rowCount === 0) {
    // Either the analysis doesn't exist, or the cap would be exceeded. Peek
    // at the row to disambiguate the error for the caller.
    const [row] = await db
      .select({ cost: schema.policyAnalysis.costPaise })
      .from(schema.policyAnalysis)
      .where(eq(schema.policyAnalysis.id, analysisId))
      .limit(1);
    if (!row) return { ok: false, reason: 'not_found' };
    return { ok: false, reason: 'cap_exceeded' };
  }
  return { ok: true };
}

// ────────────────────────────────────────────────
// In-memory fallback (dev without DB)
// ────────────────────────────────────────────────

const GLOBAL_KEY = Symbol.for('@suraksha/analysis-memory-store');
type GlobalShape = { [k: symbol]: Map<string, AnalysisRecord> | undefined };
const g = globalThis as unknown as GlobalShape;
if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Map();
const memory = g[GLOBAL_KEY]!;

class MemoryStore implements AnalysisStore {
  async create(init: Omit<AnalysisRecord, 'createdAt' | 'expiresAt' | 'documentId'>) {
    const now = new Date();
    const rec: AnalysisRecord = {
      ...init,
      documentId: null,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    };
    memory.set(rec.id, rec);
    return rec;
  }
  async get(id: string) {
    const r = memory.get(id);
    if (!r) return null;
    if (new Date(r.expiresAt) < new Date()) return null;
    return r;
  }
  async getExpired(id: string) {
    const r = memory.get(id);
    if (!r || new Date(r.expiresAt) >= new Date()) return null;
    return r;
  }
  async update(id: string, patch: Partial<AnalysisRecord>) {
    const r = memory.get(id);
    if (!r) return null;
    const next = { ...r, ...patch };
    memory.set(id, next);
    return next;
  }
  async delete(id: string) {
    return memory.delete(id);
  }
  async listRecent(limit = 100) {
    const all = Array.from(memory.values());
    all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return all.slice(0, limit);
  }
}

// ────────────────────────────────────────────────
// Factory
// ────────────────────────────────────────────────

let _store: AnalysisStore | null = null;

export function getAnalysisStore(): AnalysisStore {
  if (_store) return _store;
  _store = HAS_DB ? new DbStore() : new MemoryStore();
  console.log(`[analysis-store] using ${HAS_DB ? 'DbStore (live Postgres)' : 'MemoryStore (dev)'}`);
  return _store;
}

export function isUsingMemoryStore(): boolean {
  return !HAS_DB;
}

// ────────────────────────────────────────────────
// Digitized text — Stage-0 vision pass output, persisted on
// policy_document.extracted so downstream agents (intake, extractor,
// coverage-predictor) read text instead of re-vision-ing the PDF.
// ────────────────────────────────────────────────

export interface DigitizedDocument {
  text: string;            // Concatenated per-page markdown
  totalPages: number;
  charCount: number;
  qualityFlags: string[];
  digitizedAt: string;     // ISO-8601
  digitizerRunId: string;  // agent_run.id of the digitizer run
}

interface ExtractedColumnShape extends Record<string, unknown> {
  filename?: string;
  digitizedText?: string;
  digitizedTotalPages?: number;
  digitizedCharCount?: number;
  digitizedQualityFlags?: string[];
  digitizedAt?: string;
  digitizerRunId?: string;
}

/**
 * Returns the digitized markdown for an analysis's underlying policy_document,
 * or null if the digitizer hasn't run yet (or if running in MemoryStore mode).
 */
export async function getDigitizedDocument(
  analysisId: string,
): Promise<DigitizedDocument | null> {
  if (!HAS_DB) return null;
  const db = serviceDb();
  const [row] = await db
    .select({ documentId: schema.policyAnalysis.documentId })
    .from(schema.policyAnalysis)
    .where(eq(schema.policyAnalysis.id, analysisId))
    .limit(1);
  if (!row) return null;
  const [doc] = await db
    .select({ extracted: schema.policyDocument.extracted })
    .from(schema.policyDocument)
    .where(eq(schema.policyDocument.id, row.documentId))
    .limit(1);
  const ex = (doc?.extracted as ExtractedColumnShape | null) ?? null;
  if (!ex || typeof ex.digitizedText !== 'string' || ex.digitizedText.length === 0) {
    return null;
  }
  return {
    text: ex.digitizedText,
    totalPages: ex.digitizedTotalPages ?? 0,
    charCount: ex.digitizedCharCount ?? ex.digitizedText.length,
    qualityFlags: ex.digitizedQualityFlags ?? [],
    digitizedAt: ex.digitizedAt ?? '',
    digitizerRunId: ex.digitizerRunId ?? '',
  };
}

/**
 * Persists the digitizer's output onto policy_document.extracted (jsonb).
 * Preserves prior fields (e.g. filename) by merging rather than overwriting.
 */
export async function saveDigitizedDocument(
  analysisId: string,
  digitized: DigitizedDocument,
): Promise<void> {
  if (!HAS_DB) return;
  const db = serviceDb();
  const [row] = await db
    .select({ documentId: schema.policyAnalysis.documentId })
    .from(schema.policyAnalysis)
    .where(eq(schema.policyAnalysis.id, analysisId))
    .limit(1);
  if (!row) throw new Error(`saveDigitizedDocument: no analysis ${analysisId}`);
  const [doc] = await db
    .select({ extracted: schema.policyDocument.extracted })
    .from(schema.policyDocument)
    .where(eq(schema.policyDocument.id, row.documentId))
    .limit(1);
  const prev = (doc?.extracted as ExtractedColumnShape | null) ?? {};
  const next: ExtractedColumnShape = {
    ...prev,
    digitizedText: digitized.text,
    digitizedTotalPages: digitized.totalPages,
    digitizedCharCount: digitized.charCount,
    digitizedQualityFlags: digitized.qualityFlags,
    digitizedAt: digitized.digitizedAt,
    digitizerRunId: digitized.digitizerRunId,
  };
  await db
    .update(schema.policyDocument)
    .set({ extracted: next })
    .where(eq(schema.policyDocument.id, row.documentId));
}
