'use server';
import { randomUUID } from 'node:crypto';
import { getAnalysisStore } from './store';
import { getCoverageStore } from './coverage-store';
import { runCoveragePipeline } from './coverage-pipeline';
import type { CoverageScenario } from './coverage-types';

export interface StartCoverageCheckInput {
  analysisId: string;
  locale: string;
  scenario: CoverageScenario;
}

export type StartCoverageCheckResult =
  | { ok: true; coverageCheckId: string }
  | { ok: false; code: string; message: string };

/**
 * Starts a coverage check against an existing analysis. Validates the scenario,
 * creates an in-memory record, fires the pipeline in the background, and returns
 * an opaque id the caller redirects to.
 */
export async function startCoverageCheck(
  input: StartCoverageCheckInput,
): Promise<StartCoverageCheckResult> {
  const { analysisId, locale, scenario } = input;

  if (!scenario.condition || scenario.condition.trim().length < 3) {
    return { ok: false, code: 'missing_condition', message: 'Describe the condition or treatment in a few words.' };
  }
  if (!scenario.hospital || scenario.hospital.trim().length < 3) {
    return { ok: false, code: 'missing_hospital', message: 'Tell us which hospital (or city / type of hospital).' };
  }

  const aStore = getAnalysisStore();
  const analysis = await aStore.get(analysisId);
  if (!analysis) {
    return {
      ok: false,
      code: 'analysis_not_found',
      message: 'The original policy analysis was not found. It may have expired or been deleted — please re-upload your policy first.',
    };
  }
  if (analysis.status !== 'ready' || !analysis.fileMeta.storagePath) {
    return {
      ok: false,
      code: 'analysis_not_ready',
      message: 'The original policy analysis isn\'t ready yet. Wait for it to finish, then try again.',
    };
  }

  const id = randomUUID();
  const sessionToken = randomUUID();
  const cStore = getCoverageStore();

  await cStore.create({
    id,
    sessionToken,
    tenantId: analysis.tenantId,
    sourceAnalysisId: analysisId,
    locale: normaliseLocale(locale),
    scenario,
    status: 'queued',
    progressStep: 'Queued — starting in a moment',
    result: null,
    agentRunIds: [],
    costPaise: 0,
    errorCode: null,
    errorMessage: null,
    startedAt: null,
    readyAt: null,
  });

  void runCoveragePipeline(id).catch(async (err: unknown) => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[coverage-pipeline] failed', id, msg);
    await getCoverageStore().update(id, {
      status: 'failed',
      progressStep: null,
      errorCode: 'pipeline_error',
      errorMessage: msg.slice(0, 500),
    });
  });

  return { ok: true, coverageCheckId: id };
}

function normaliseLocale(locale: string): string {
  if (['en', 'hi', 'kn'].includes(locale)) return locale;
  return 'en';
}
