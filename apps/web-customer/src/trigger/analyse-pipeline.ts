import { logger, task } from '@trigger.dev/sdk';
import {
  runAnalysisPipeline,
  NotAHealthPolicyError,
  UpstreamUnavailableError,
} from '@/server/analyse/pipeline';
import { getAnalysisStore } from '@/server/analyse/store';

/**
 * Background analyse task. Wraps the existing runAnalysisPipeline() that
 * previously ran inside the Vercel Server Action (and got killed at 60s).
 *
 * The task runs in Trigger.dev's managed runtime — independent lifecycle
 * from Vercel functions, free to take minutes per attempt. The browser
 * still polls the policy_analysis row's status column for progress;
 * Trigger.dev is not in the UI's read path.
 *
 * Failure handling mirrors what the Server Action used to do inline:
 *   - NotAHealthPolicyError       → status=failed errorCode=not_a_policy
 *   - UpstreamUnavailableError    → status=failed errorCode=upstream_unavailable
 *   - anything else               → status=failed errorCode=pipeline_error
 *
 * Retries are configured per-task (see retry block below). When all
 * attempts are exhausted, the task's catch surfaces the final error and
 * we still write the row to `failed` so the UI doesn't spin forever.
 */
export const analyseTask = task({
  id: 'analyse-pipeline',
  maxDuration: 900,  // 15 min per attempt
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5_000,
    maxTimeoutInMs: 60_000,
    randomize: true,
  },
  run: async (payload: { analysisId: string }, { ctx }) => {
    const { analysisId } = payload;
    logger.info('analysing', { analysisId, attempt: ctx.attempt.number });

    try {
      await runAnalysisPipeline(analysisId);
      logger.info('analysed', { analysisId });
      return { analysisId, status: 'ready' as const };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('pipeline_failed', { analysisId, err: msg });

      // Don't clobber a row that already reached a terminal state — guards
      // against late-throw races (cleanup code throwing after we wrote
      // status='ready').
      const current = await getAnalysisStore().get(analysisId);
      if (!current) {
        // Analysis was deleted while we were running. Nothing to update.
        throw err;
      }
      if (current.status === 'ready' || current.status === 'failed') {
        // Idempotent — someone else already finalised the row.
        return { analysisId, status: current.status };
      }

      if (err instanceof NotAHealthPolicyError) {
        await getAnalysisStore().update(analysisId, {
          status: 'failed',
          progressStep: null,
          errorCode: 'not_a_policy',
          errorMessage: `${err.detectedType}: ${err.reason}`.slice(0, 500),
        });
        // Don't retry — the document genuinely isn't a health policy.
        // Returning prevents Trigger.dev from counting another attempt.
        return { analysisId, status: 'failed' as const };
      }

      if (err instanceof UpstreamUnavailableError) {
        // Let Trigger.dev retry — Gemini/Anthropic 429s + 5xx usually clear.
        // We only write the row to failed once attempts are exhausted; the
        // sdk re-throws if we re-throw here, so the wrapping logic below
        // handles the final-attempt persistence.
        await getAnalysisStore().update(analysisId, {
          status: 'failed',
          progressStep: null,
          errorCode: 'upstream_unavailable',
          errorMessage: `Stage ${err.stage} failed: ${msg}`.slice(0, 500),
        });
        throw err;
      }

      await getAnalysisStore().update(analysisId, {
        status: 'failed',
        progressStep: null,
        errorCode: 'pipeline_error',
        errorMessage: msg.slice(0, 500),
      });
      throw err;
    }
  },
});
