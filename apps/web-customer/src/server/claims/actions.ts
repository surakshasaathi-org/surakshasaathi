'use server';
import { randomUUID } from 'node:crypto';
import { and, asc, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { serviceDb, schema } from '@suraksha/db';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * Claims (cases) CRUD. Uses the existing `case` + `case_event` tables.
 *
 * MVP scope:
 *   - list user's cases (active vs closed)
 *   - view one case + its timeline of events
 *   - create a new case manually ("I had a hospitalisation, kicking off the paperwork")
 *   - add a case_event (status change, note, document upload placeholder)
 *
 * Full rejection-classifier integration lands when the agent is properly
 * wired to persist into case_event; today this surface is the scaffolding.
 */

export interface CaseRow {
  id: string;
  kind: string;
  status: string;
  priority: string;
  insurerName: string | null;
  amountClaimedPaise: number | null;
  amountRecoveredPaise: number | null;
  deadlineAt: string | null;
  policyId: string | null;
  createdAt: string;
  updatedAt: string;
  latestEventAt: string | null;
  eventCount: number;
}

async function requireUserId(): Promise<string | null> {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  return data.user?.id ?? null;
}

export async function listMyCases(): Promise<{ active: CaseRow[]; closed: CaseRow[] }> {
  const userId = await requireUserId();
  if (!userId) return { active: [], closed: [] };
  const db = serviceDb();

  const rows = await db
    .select()
    .from(schema.caseRow)
    .where(eq(schema.caseRow.userId, userId))
    .orderBy(desc(schema.caseRow.updatedAt));

  if (rows.length === 0) return { active: [], closed: [] };

  // Batch fetch per-case event counts + latest event timestamps.
  const caseIds = rows.map((r) => r.id);
  const events = await db
    .select({
      caseId: schema.caseEvent.caseId,
      createdAt: schema.caseEvent.createdAt,
    })
    .from(schema.caseEvent)
    .where(
      // Drizzle inArray for the case ids.
      eq(schema.caseEvent.tenantId, 'surakshasaathi'),
    );
  // Filter locally to just our cases — simpler than a CTE and fast for < 100.
  const perCase = new Map<string, { count: number; latestAt: Date | null }>();
  for (const e of events) {
    if (!caseIds.includes(e.caseId)) continue;
    const acc = perCase.get(e.caseId) ?? { count: 0, latestAt: null };
    acc.count += 1;
    if (!acc.latestAt || e.createdAt > acc.latestAt) acc.latestAt = e.createdAt;
    perCase.set(e.caseId, acc);
  }

  const CLOSED = new Set(['resolved_in_favour', 'resolved_against', 'withdrawn', 'abandoned']);
  const active: CaseRow[] = [];
  const closed: CaseRow[] = [];
  for (const r of rows) {
    const summary = perCase.get(r.id) ?? { count: 0, latestAt: null };
    const row: CaseRow = {
      id: r.id,
      kind: r.kind,
      status: r.status,
      priority: r.priority,
      insurerName: r.insurerName,
      amountClaimedPaise: r.amountClaimedPaise,
      amountRecoveredPaise: r.amountRecoveredPaise,
      deadlineAt: r.deadlineAt?.toISOString() ?? null,
      policyId: r.policyId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
      latestEventAt: summary.latestAt?.toISOString() ?? null,
      eventCount: summary.count,
    };
    (CLOSED.has(r.status) ? closed : active).push(row);
  }
  return { active, closed };
}

export interface CaseEventRow {
  id: string;
  type: string;
  actorKind: string;
  payload: Record<string, unknown>;
  userVisible: Record<string, string> | null;
  createdAt: string;
}

export async function getCaseWithTimeline(
  caseId: string,
): Promise<{ case: CaseRow; events: CaseEventRow[] } | null> {
  const userId = await requireUserId();
  if (!userId) return null;
  const db = serviceDb();

  const [row] = await db
    .select()
    .from(schema.caseRow)
    .where(and(eq(schema.caseRow.id, caseId), eq(schema.caseRow.userId, userId)))
    .limit(1);
  if (!row) return null;

  const events = await db
    .select()
    .from(schema.caseEvent)
    .where(eq(schema.caseEvent.caseId, caseId))
    .orderBy(asc(schema.caseEvent.createdAt));

  return {
    case: {
      id: row.id,
      kind: row.kind,
      status: row.status,
      priority: row.priority,
      insurerName: row.insurerName,
      amountClaimedPaise: row.amountClaimedPaise,
      amountRecoveredPaise: row.amountRecoveredPaise,
      deadlineAt: row.deadlineAt?.toISOString() ?? null,
      policyId: row.policyId,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
      latestEventAt: events.length ? events[events.length - 1]!.createdAt.toISOString() : null,
      eventCount: events.length,
    },
    events: events.map((e) => ({
      id: e.id,
      type: e.type,
      actorKind: e.actorKind,
      payload: (e.payload as Record<string, unknown>) ?? {},
      userVisible: (e.userVisible as Record<string, string> | null) ?? null,
      createdAt: e.createdAt.toISOString(),
    })),
  };
}

export type CaseKind =
  | 'claim_rejection'
  | 'mis_selling'
  | 'unclaimed_recovery'
  | 'scheme_refusal'
  | 'advisory';

export interface CreateCaseInput {
  kind: CaseKind;
  insurerName?: string | null;
  amountClaimedPaise?: number | null;
  policyId?: string | null;
  title: string; // free-form; seeds the first case_event
  notes?: string;
}

export async function createCase(
  input: CreateCaseInput,
): Promise<{ ok: true; id: string } | { ok: false; message: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: 'Please sign in.' };
  const db = serviceDb();
  const caseId = randomUUID();
  try {
    await db.insert(schema.caseRow).values({
      id: caseId,
      tenantId: 'surakshasaathi',
      userId,
      moduleId: moduleIdFromKind(input.kind),
      kind: input.kind,
      status: 'intake',
      priority: 'normal',
      insurerName: input.insurerName ?? null,
      amountClaimedPaise: input.amountClaimedPaise ?? null,
      policyId: input.policyId ?? null,
      metadata: input.notes ? { notes: input.notes } : {},
    });
    await db.insert(schema.caseEvent).values({
      id: randomUUID(),
      tenantId: 'surakshasaathi',
      caseId,
      actorUserId: userId,
      actorKind: 'user',
      type: 'case_opened',
      payload: { title: input.title, notes: input.notes ?? null },
      userVisible: { en: input.title, hi: input.title, kn: input.title },
    });
    revalidatePath('/my/claims', 'page');
    return { ok: true, id: caseId };
  } catch (err) {
    return { ok: false, message: (err as Error).message.slice(0, 200) };
  }
}

export async function addCaseEvent(args: {
  caseId: string;
  type: string;
  note: string;
}): Promise<{ ok: boolean; message?: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: 'Please sign in.' };
  const db = serviceDb();
  // Verify ownership first.
  const [row] = await db
    .select({ id: schema.caseRow.id })
    .from(schema.caseRow)
    .where(and(eq(schema.caseRow.id, args.caseId), eq(schema.caseRow.userId, userId)))
    .limit(1);
  if (!row) return { ok: false, message: 'Case not found.' };

  await db.insert(schema.caseEvent).values({
    id: randomUUID(),
    tenantId: 'surakshasaathi',
    caseId: args.caseId,
    actorUserId: userId,
    actorKind: 'user',
    type: args.type,
    payload: { note: args.note },
    userVisible: { en: args.note, hi: args.note, kn: args.note },
  });
  revalidatePath(`/my/claims/${args.caseId}`, 'page');
  return { ok: true };
}

export async function updateCaseStatus(
  caseId: string,
  newStatus: string,
): Promise<{ ok: boolean; message?: string }> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, message: 'Please sign in.' };
  const db = serviceDb();
  const [row] = await db
    .update(schema.caseRow)
    .set({ status: newStatus as typeof schema.caseRow.$inferInsert.status, updatedAt: new Date() })
    .where(and(eq(schema.caseRow.id, caseId), eq(schema.caseRow.userId, userId)))
    .returning({ id: schema.caseRow.id });
  if (!row) return { ok: false, message: 'Case not found.' };
  await db.insert(schema.caseEvent).values({
    id: randomUUID(),
    tenantId: 'surakshasaathi',
    caseId,
    actorUserId: userId,
    actorKind: 'user',
    type: 'status_change',
    payload: { to: newStatus },
    userVisible: { en: `Status changed to ${newStatus}` },
  });
  revalidatePath(`/my/claims/${caseId}`, 'page');
  revalidatePath('/my/claims', 'page');
  return { ok: true };
}

function moduleIdFromKind(kind: CaseKind): string {
  switch (kind) {
    case 'claim_rejection':
      return 'claims-advocacy';
    case 'mis_selling':
      return 'life-mis-selling-recovery';
    case 'unclaimed_recovery':
      return 'claims-advocacy';
    case 'scheme_refusal':
      return 'govt-scheme-navigator';
    case 'advisory':
      return 'claims-advocacy';
  }
}
