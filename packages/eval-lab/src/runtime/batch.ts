import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';

/**
 * Batch runner core. Trigger.dev-ready but in-process today — the user
 * (admin) clicks "Run dataset" in the Eval Lab, the API route enqueues a
 * batch by calling startBatchRun(), then a background worker (or
 * Vercel waitUntil callback) calls runBatchTask() against the batch id.
 *
 * Decoupling startBatchRun() from runBatchTask() means migrating to a
 * Trigger.dev task is a one-line swap: the trigger run id replaces the
 * in-process invocation. (Decision 2026-04-25 — see docs/prd/01c-eval-lab.md.)
 *
 * Caller-provided hooks:
 *   - runOneCase(case, agentSlug, agentVersion) → drives the actual agent
 *     invocation. Lives in the consumer app (web-customer/web-admin) so
 *     this package doesn't depend on next.js / route bindings.
 *   - runJudge?(agentRunId, agentSlug, batchRunId) → optional; calls the
 *     LLM-as-judge to score the agent run against the golden case.
 *   - estimateCostPerCasePaise → used by the pre-flight guard so we don't
 *     enqueue a batch that exceeds the day's remaining budget.
 *
 * Cancellation: the orchestrator polls cancellation_requested between
 * cases. We never interrupt a single case mid-flight (LLM calls bill once
 * per request; killing a generation in flight wastes cost).
 *
 * Concurrency: one case at a time within a batch by default. Tunable via
 * EVAL_BATCH_CONCURRENCY env var (default 1). Provider rate limits are
 * the binding constraint — Gemini's 2.5 Flash currently caps around 60
 * RPM with caching, so concurrency 5 is the published ceiling per PRD.
 */

export interface BatchCase {
  id: string;
  name: string;
  policyDocumentId: string | null;
  expectedExtraction: Record<string, unknown> | null;
  expectedCoverage: Record<string, unknown> | null;
  expectedChatQa: Array<{ question: string; expected_answer: string }> | null;
  demographicsJson: Record<string, unknown> | null;
}

export interface BatchRunOneCaseResult {
  agentRunId: string;
  costPaise: number;
  latencyMs: number;
  outcome: 'success' | 'low_confidence' | 'tool_error' | 'timeout' | 'refused';
  errorMessage?: string;
}

export interface BatchHooks {
  /**
   * Drive the actual agent invocation against ONE case. Implementation lives
   * in the consumer app (next.js handler) so this package stays free of
   * next-specific imports.
   */
  runOneCase(args: {
    caseRow: BatchCase;
    agentSlug: string;
    agentVersion: number;
    batchRunId: string;
    tenantId: string;
  }): Promise<BatchRunOneCaseResult>;

  /**
   * Optional judge invocation per agent run. When omitted, the batch
   * still completes — just no eval_run rows alongside it.
   */
  runJudge?(args: {
    agentRunId: string;
    agentSlug: string;
    batchRunId: string;
    goldenCaseId: string;
  }): Promise<void>;
}

export interface StartBatchArgs {
  datasetId: string;
  agentSlug: string;
  agentVersion: number;
  startedBy?: string | null;
  tenantId?: string;
  /** Avg cost per case (paise) used to estimate the batch cost up-front. */
  estimateCostPerCasePaise?: number;
  /** Sets eval_batch_run.deploy_env. Defaults from APP_ENV / VERCEL_ENV. */
  deployEnv?: 'prod' | 'uat' | 'local';
}

export interface StartBatchResult {
  batchRunId: string;
  totalCases: number;
  estimatedCostPaise: number;
}

/**
 * Pre-flight: insert eval_batch_run row in 'queued' state. Returns the new
 * id so the caller can hand it to runBatchTask() (or a Trigger.dev task)
 * without further DB look-ups.
 */
export async function startBatchRun(args: StartBatchArgs): Promise<StartBatchResult> {
  const tenantId = args.tenantId ?? 'surakshasaathi';
  const db = serviceDb();

  const enabledCases = await db
    .select({ id: schema.evalGoldenCase.id })
    .from(schema.evalGoldenCase)
    .where(
      and(
        eq(schema.evalGoldenCase.datasetId, args.datasetId),
        eq(schema.evalGoldenCase.enabled, true),
      ),
    );
  const totalCases = enabledCases.length;
  const estimatedCostPaise = (args.estimateCostPerCasePaise ?? 0) * totalCases;

  const id = randomUUID();
  await db.insert(schema.evalBatchRun).values({
    id,
    datasetId: args.datasetId,
    agentSlug: args.agentSlug,
    agentVersion: args.agentVersion,
    status: 'queued',
    totalCases,
    estimatedCostPaise,
    actualCostPaise: 0,
    startedBy: args.startedBy ?? null,
    deployEnv: args.deployEnv ?? resolveDeployEnv(),
  });
  // tenantId isn't stored on eval_batch_run today; carried through for
  // future RLS work without mutating the schema right now.
  void tenantId;

  return { batchRunId: id, totalCases, estimatedCostPaise };
}

/**
 * Drive the batch end-to-end: status running → completed/cancelled/failed.
 * Idempotent — re-invoking on a completed batch is a no-op. Honours
 * cancellation_requested between cases.
 */
export async function runBatchTask(
  batchRunId: string,
  hooks: BatchHooks,
): Promise<{ completed: number; failed: number; cancelled: boolean }> {
  const db = serviceDb();
  const tenantId = 'surakshasaathi';

  const [batch] = await db
    .select()
    .from(schema.evalBatchRun)
    .where(eq(schema.evalBatchRun.id, batchRunId))
    .limit(1);
  if (!batch) throw new Error(`eval_batch_run not found: ${batchRunId}`);
  if (batch.status === 'completed' || batch.status === 'cancelled' || batch.status === 'failed') {
    return {
      completed: batch.completedCases,
      failed: batch.failedCases,
      cancelled: batch.status === 'cancelled',
    };
  }

  await db
    .update(schema.evalBatchRun)
    .set({ status: 'running' })
    .where(eq(schema.evalBatchRun.id, batchRunId));

  const cases = await db
    .select({
      id: schema.evalGoldenCase.id,
      name: schema.evalGoldenCase.name,
      policyDocumentId: schema.evalGoldenCase.policyDocumentId,
      expectedExtraction: schema.evalGoldenCase.expectedExtraction,
      expectedCoverage: schema.evalGoldenCase.expectedCoverage,
      expectedChatQa: schema.evalGoldenCase.expectedChatQa,
      demographicsJson: schema.evalGoldenCase.demographicsJson,
    })
    .from(schema.evalGoldenCase)
    .where(
      and(
        eq(schema.evalGoldenCase.datasetId, batch.datasetId),
        eq(schema.evalGoldenCase.enabled, true),
      ),
    );

  let completed = 0;
  let failed = 0;
  let actualCostPaise = 0;

  for (const c of cases) {
    // Cancellation check between cases — never mid-LLM-call.
    const [cancelCheck] = await db
      .select({ requested: schema.evalBatchRun.cancellationRequested })
      .from(schema.evalBatchRun)
      .where(eq(schema.evalBatchRun.id, batchRunId))
      .limit(1);
    if (cancelCheck?.requested) {
      await db
        .update(schema.evalBatchRun)
        .set({
          status: 'cancelled',
          completedCases: completed,
          failedCases: failed,
          actualCostPaise,
          endedAt: new Date(),
        })
        .where(eq(schema.evalBatchRun.id, batchRunId));
      return { completed, failed, cancelled: true };
    }

    try {
      const result = await hooks.runOneCase({
        caseRow: c as BatchCase,
        agentSlug: batch.agentSlug,
        agentVersion: batch.agentVersion,
        batchRunId,
        tenantId,
      });
      actualCostPaise += result.costPaise;
      if (result.outcome === 'tool_error' || result.outcome === 'refused' || result.outcome === 'timeout') {
        failed += 1;
      } else {
        completed += 1;
      }

      if (hooks.runJudge) {
        await hooks
          .runJudge({
            agentRunId: result.agentRunId,
            agentSlug: batch.agentSlug,
            batchRunId,
            goldenCaseId: c.id,
          })
          .catch((err) => {
            // Judge failure is non-fatal for the batch — the eval_run is
            // skipped, but the agent_run row is preserved.
            console.warn(
              `[eval-lab/batch] judge failed batchRun=${batchRunId} case=${c.id} err=${(err as Error).message.slice(0, 200)}`,
            );
          });
      }
    } catch (err) {
      failed += 1;
      console.warn(
        `[eval-lab/batch] case failed batchRun=${batchRunId} case=${c.id} err=${(err as Error).message.slice(0, 200)}`,
      );
    }

    // Persist progress after each case so the UI's polling can render a
    // live counter without waiting for the entire batch to finish.
    await db
      .update(schema.evalBatchRun)
      .set({ completedCases: completed, failedCases: failed, actualCostPaise })
      .where(eq(schema.evalBatchRun.id, batchRunId));
  }

  await db
    .update(schema.evalBatchRun)
    .set({
      status: 'completed',
      completedCases: completed,
      failedCases: failed,
      actualCostPaise,
      endedAt: new Date(),
    })
    .where(eq(schema.evalBatchRun.id, batchRunId));

  return { completed, failed, cancelled: false };
}

/** Mark a queued/running batch for cancellation. The orchestrator picks
 *  this up on its next inter-case poll. */
export async function requestBatchCancellation(batchRunId: string): Promise<void> {
  const db = serviceDb();
  await db
    .update(schema.evalBatchRun)
    .set({ cancellationRequested: true })
    .where(eq(schema.evalBatchRun.id, batchRunId));
}

function resolveDeployEnv(): 'prod' | 'uat' | 'local' {
  const env = (process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV ?? '').toLowerCase();
  if (env === 'prod' || env === 'production') return 'prod';
  if (env === 'uat' || env === 'staging') return 'uat';
  if (env === 'local' || env === 'development' || process.env.NODE_ENV === 'development') return 'local';
  // Vercel sets VERCEL_ENV: 'production' | 'preview' | 'development'.
  const vercel = (process.env.VERCEL_ENV ?? '').toLowerCase();
  if (vercel === 'production') return 'prod';
  if (vercel === 'preview') return 'uat';
  return 'local';
}
