import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, gte, inArray, sql } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import { invokeAgentStream, type StreamMessage } from '@suraksha/agent-sdk';
import { loadAgentDefinition, makePersistRun } from './agent-runs';
import { getAnalysisStore, incrementAnalysisCost } from './store';
import { isReportV2 } from './report-v2-types';
import { assertDailyCostCap } from '@/server/safety/rate-limit';
import { redactForModelContext, scrubString } from '@/server/safety/redact';

/**
 * Customer-explainer chat on an analysis. Streams tokens to the caller and
 * persists both turns to `chat_message` once finished.
 *
 * Safety layers (Sprint 4 will harden further):
 *   - session_token OR user_id match required before we load/write messages
 *   - per-analysis rate limit: max 30 messages / 10 min window
 *   - per-analysis cost cap: ₹20 total across chat (≈ 60 turns on Sonnet)
 *   - jailbreak-resistance baked into the customer-explainer system prompt itself
 *
 * The caller is responsible for authenticating the browser session (checked in
 * the route handler); this module trusts its inputs past that point.
 */

const MAX_MESSAGES_PER_WINDOW = 30;
const WINDOW_MS = 10 * 60 * 1000;
/**
 * Chat-only spend cap per analysis. Measures *only* customer-explainer turns —
 * the upstream extractor/coverage pipeline cost is intentionally excluded so
 * a long policy (big extractor output) doesn't silently disable chat.
 *
 * ₹30 ≈ 60 Sonnet chat turns at current pricing. Bump via the env var when
 * we introduce paid tiers; anonymous/free stays at the default.
 */
const MAX_CHAT_COST_PAISE = Number(process.env.CHAT_COST_CAP_PAISE ?? '3000');

export interface ChatMessageRow {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  createdAt: string;
}

export async function listChatMessages(analysisId: string): Promise<ChatMessageRow[]> {
  const db = serviceDb();
  const rows = await db
    .select()
    .from(schema.chatMessage)
    .where(eq(schema.chatMessage.analysisId, analysisId))
    .orderBy(asc(schema.chatMessage.createdAt));
  return rows.map((r) => ({
    id: r.id,
    role: r.role as 'user' | 'assistant' | 'system',
    content: r.content,
    createdAt: r.createdAt.toISOString(),
  }));
}

export interface ChatStreamResult {
  stream: AsyncIterable<string>;
  /**
   * Mutable error carrier populated by the provider if the stream fails
   * mid-flight. The route handler must check this after the stream drains and
   * send a real `event: error` to the client instead of calling finalize().
   */
  streamError: { error: Error | null };
  /** Resolves once the full assistant reply is persisted + rate-limit counters updated. */
  finalize: () => Promise<void>;
}

export interface StartChatArgs {
  analysisId: string;
  userMessage: string;
}

export async function startChatStream(args: StartChatArgs): Promise<ChatStreamResult> {
  const { analysisId, userMessage } = args;
  const trimmed = userMessage.trim();
  if (!trimmed) throw new Error('empty_message');
  if (trimmed.length > 2000) throw new Error('message_too_long');

  // Scrub PII from the message before it reaches the model or any log. We
  // still persist the user's *original* text to chat_message because they
  // asked it; but Gemini only sees the scrubbed version so retention-side
  // risk is bounded.
  const scrubbedForModel = scrubString(trimmed);

  const store = getAnalysisStore();
  const rec = await store.get(analysisId);
  if (!rec) throw new Error('analysis_not_found');
  if (rec.status !== 'ready' || !rec.report) throw new Error('analysis_not_ready');

  await assertWithinRateLimit(analysisId);
  await assertWithinCostCap(analysisId);
  if (rec.userId) {
    const daily = await assertDailyCostCap({ userId: rec.userId, ip: null, tenantId: rec.tenantId });
    if (daily) throw new Error(daily); // surfaces 'cost_cap_daily' → 402 in the route handler
  }

  // Persist the user turn before we start streaming. If the stream fails
  // mid-flight, at least the user's question survives.
  const db = serviceDb();
  await db.insert(schema.chatMessage).values({
    tenantId: rec.tenantId,
    analysisId,
    userId: rec.userId ?? null,
    sessionToken: rec.sessionToken,
    role: 'user',
    content: trimmed,
  });

  const history = await buildHistory(analysisId);
  const explainerDef = await loadAgentDefinition('customer-explainer');
  const persist = makePersistRun();

  // Ground the agent in the policy + coverage analysis. The agent's system
  // prompt already says "answer only from this policy", and the extractor/
  // coverage outputs are the source of truth for citations.
  const reportContext = buildReportContext(rec.report as unknown as Record<string, unknown>);

  const invoke = invokeAgentStream({
    def: explainerDef,
    invocation: {
      agentId: '' as never,
      tenantId: rec.tenantId as never,
      userId: (rec.userId ?? null) as never,
      caseId: null,
      analysisId,
      parentRunId: null,
      userMessage: scrubbedForModel,
      attachments: [],
      locale: rec.locale as 'en' | 'hi' | 'kn',
      extraContext: reportContext,
    },
    persist,
    history,
  });

  const finalize = async () => {
    const done = await invoke.finalize();
    await db.insert(schema.chatMessage).values({
      tenantId: rec.tenantId,
      analysisId,
      userId: rec.userId ?? null,
      sessionToken: rec.sessionToken,
      role: 'assistant',
      content: done.fullText,
      agentRunId: done.runId,
      tokenCount: null,
    });
    // Atomic cost + run-id bump. Avoids lost-update race when two chat turns
    // finalize concurrently (each would otherwise overwrite with their own
    // {costPaise = rec.costPaise + delta, agentRunIds = [...rec, new]}).
    // No cap is enforced here — chat cap is measured against customer-
    // explainer-only costs via the pre-stream assertWithinCostCap check;
    // this increment just records actual spend onto the ledger.
    const bump = await incrementAnalysisCost(analysisId, done.costPaise, done.runId);
    if (!bump.ok) {
      console.warn(
        `[chat] atomic cost bump failed analysisId=${analysisId} reason=${bump.reason} delta=${done.costPaise}`,
      );
      // The assistant turn is already persisted; we just didn't credit the
      // cost. Better to leak a few paise than to lose the reply.
    }
  };

  return { stream: invoke.stream, streamError: invoke.streamError, finalize };
}

/* ───────── Helpers ───────── */

async function buildHistory(analysisId: string): Promise<StreamMessage[]> {
  // Cap to the last 20 turns to keep prompts small. The system prompt is
  // authoritative and re-sent each request, so older context is redundant.
  const db = serviceDb();
  const rows = await db
    .select()
    .from(schema.chatMessage)
    .where(eq(schema.chatMessage.analysisId, analysisId))
    .orderBy(asc(schema.chatMessage.createdAt));

  const trimmed = rows.slice(-20);
  return trimmed
    .filter((r) => r.role === 'user' || r.role === 'assistant')
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));
}

function buildReportContext(report: Record<string, unknown> | null): Record<string, unknown> {
  if (!report) return {};
  // PII is stripped before the payload ever reaches Gemini. Policy numbers,
  // nominee names, and TPA phone lines are never needed for reasoning and
  // must not be retained by third-party providers.
  if (isReportV2(report)) {
    return redactForModelContext({
      extractor: report.extractor,
      coverage: report.coverage,
    });
  }
  return redactForModelContext({ legacy_report: report });
}

async function assertWithinRateLimit(analysisId: string): Promise<void> {
  const db = serviceDb();
  const since = new Date(Date.now() - WINDOW_MS);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.chatMessage)
    .where(
      and(
        eq(schema.chatMessage.analysisId, analysisId),
        eq(schema.chatMessage.role, 'user'),
        gte(schema.chatMessage.createdAt, since),
      ),
    );
  // Counted pre-insert: if the count is already at the limit, rejecting the
  // incoming turn caps the window at MAX_MESSAGES_PER_WINDOW messages exactly.
  // gte() on createdAt makes this a sliding window — old messages age out
  // automatically once they cross the 10-minute boundary.
  if ((row?.count ?? 0) >= MAX_MESSAGES_PER_WINDOW) {
    throw new Error('rate_limited');
  }
}

async function assertWithinCostCap(analysisId: string): Promise<void> {
  const rec = await getAnalysisStore().get(analysisId);
  if (!rec) return;
  if (rec.agentRunIds.length === 0) return;

  // Sum ONLY customer-explainer agent_run costs for this analysis. The
  // pipeline's extractor + coverage runs are much larger and are excluded
  // from this cap — they're budgeted separately via the daily user cap.
  const db = serviceDb();
  const [row] = await db
    .select({ total: sql<number>`coalesce(sum(${schema.agentRun.costPaise}), 0)::int` })
    .from(schema.agentRun)
    .where(
      and(
        eq(schema.agentRun.agentSlug, 'customer-explainer'),
        inArray(schema.agentRun.id, rec.agentRunIds),
      ),
    );
  const chatCost = row?.total ?? 0;
  if (chatCost >= MAX_CHAT_COST_PAISE) {
    throw new Error('cost_cap_reached');
  }
}

// Suppress unused warning until randomUUID is used for client-side streaming ids.
void randomUUID;
