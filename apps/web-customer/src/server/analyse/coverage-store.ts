import 'server-only';
import type { CoverageCheckRecord } from './coverage-types';

/**
 * Ephemeral in-memory store for coverage checks.
 *
 * Unlike policy_analysis, coverage checks are not persisted to the DB in
 * Phase 1 — they live for a single session and a 24-hour URL TTL. The
 * underlying agent_run row IS persisted (for admin cost visibility).
 *
 * When we ship a "save this check to my account" (Phase 2+ with auth),
 * we'll add a `coverage_check` table and this module will mirror the DB
 * pattern used by `store.ts`.
 */

const GLOBAL_KEY = Symbol.for('@suraksha/coverage-memory-store');
type GlobalShape = { [k: symbol]: Map<string, CoverageCheckRecord> | undefined };
const g = globalThis as unknown as GlobalShape;
if (!g[GLOBAL_KEY]) g[GLOBAL_KEY] = new Map();
const memory = g[GLOBAL_KEY]!;

export interface CoverageStore {
  create(init: Omit<CoverageCheckRecord, 'createdAt' | 'expiresAt'>): Promise<CoverageCheckRecord>;
  get(id: string): Promise<CoverageCheckRecord | null>;
  update(id: string, patch: Partial<CoverageCheckRecord>): Promise<CoverageCheckRecord | null>;
  delete(id: string): Promise<boolean>;
  listBySourceAnalysis(analysisId: string): Promise<CoverageCheckRecord[]>;
}

const TTL_HOURS = 24;

class MemoryStore implements CoverageStore {
  async create(init: Omit<CoverageCheckRecord, 'createdAt' | 'expiresAt'>): Promise<CoverageCheckRecord> {
    const now = new Date();
    const rec: CoverageCheckRecord = {
      ...init,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + TTL_HOURS * 60 * 60 * 1000).toISOString(),
    };
    memory.set(rec.id, rec);
    return rec;
  }
  async get(id: string) {
    const r = memory.get(id);
    if (!r) return null;
    if (new Date(r.expiresAt) < new Date()) {
      memory.delete(id);
      return null;
    }
    return r;
  }
  async update(id: string, patch: Partial<CoverageCheckRecord>) {
    const r = memory.get(id);
    if (!r) return null;
    const next = { ...r, ...patch };
    memory.set(id, next);
    return next;
  }
  async delete(id: string) {
    return memory.delete(id);
  }
  async listBySourceAnalysis(analysisId: string) {
    return Array.from(memory.values()).filter((r) => r.sourceAnalysisId === analysisId);
  }
}

let _store: CoverageStore | null = null;
export function getCoverageStore(): CoverageStore {
  if (_store) return _store;
  _store = new MemoryStore();
  return _store;
}
