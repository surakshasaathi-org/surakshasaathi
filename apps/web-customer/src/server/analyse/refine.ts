'use server';
import { revalidatePath } from 'next/cache';
import { invokeAgent } from '@suraksha/agent-sdk';
import { getAnalysisStore, incrementAnalysisCost } from './store';
import { loadAgentDefinition, makePersistRun } from './agent-runs';
import { isReportV2, type DemographicsInput, type ReportV2 } from './report-v2-types';
import { validateCoverageOutput } from './report-v2-validate';
import { assertAnalysisAccess } from '@/server/safety/analysis-access';
import { assertDailyCostCap, humanLimitMessage } from '@/server/safety/rate-limit';
import { supabaseServer } from '@/lib/supabase-server';

/**
 * Re-run ONLY the coverage agent with fresh demographics, preserving the
 * original extractor output. Called from the "Refine for your family" button
 * on the report page.
 *
 * Reuses the extractor output (including minted citation ids) so the user
 * doesn't pay for a second PDF pass — this is a ~₹3 operation, not ₹20.
 */

export type RefineResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export async function refineCoverageForAnalysis(
  analysisId: string,
  demographics: DemographicsInput,
): Promise<RefineResult> {
  const access = await assertAnalysisAccess(analysisId);
  if (!access.ok) {
    return { ok: false, code: access.code, message: access.message };
  }
  const rec = access.rec;

  if (!rec.report || !isReportV2(rec.report)) {
    return {
      ok: false,
      code: 'legacy_report',
      message: 'This analysis was produced by an older pipeline; re-upload to refine.',
    };
  }

  // Daily cost cap — cheap op, but still counts toward free-tier budget.
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (data.user) {
    const cap = await assertDailyCostCap({
      userId: data.user.id,
      ip: null,
      tenantId: rec.tenantId,
    });
    if (cap) return { ok: false, code: cap, message: humanLimitMessage(cap) };
  }

  const report = rec.report as ReportV2;
  const extractor = report.extractor;

  // Persist new demographics first so if coverage fails the user can retry
  // without re-entering the form.
  await getAnalysisStore().update(analysisId, {
    demographics: demographics as unknown as Record<string, unknown>,
  });

  const coverageDef = await loadAgentDefinition('policy-coverage');
  const coverageResult = await invokeAgent({
    def: coverageDef,
    invocation: {
      agentId: '' as never,
      tenantId: rec.tenantId as never,
      userId: (rec.userId ?? null) as never,
      caseId: null,
      analysisId: rec.id,
      parentRunId: null,
      userMessage: [
        `You are re-analysing an already-extracted policy for an updated family context.`,
        `Locale: ${rec.locale}.`,
        `Extractor output (ground truth — every citation_ref must be one of its "id" values):`,
        '```json',
        JSON.stringify(extractor),
        '```',
        `Updated demographics / family context:`,
        '```json',
        JSON.stringify(demographics),
        '```',
        `Produce the per-member CoverageOutput JSON. Respond with ONLY the JSON object.`,
      ].join('\n'),
      attachments: [],
      locale: rec.locale as 'en' | 'hi' | 'kn',
      extraContext: { analysis_id: rec.id, refine: true },
    },
    persist: makePersistRun(),
    inlineAttachments: [],
    provider: (coverageDef as { provider?: 'gemini' | 'anthropic' | null }).provider ?? undefined,
    modelCandidatesOverride: (coverageDef as { modelOverride?: string | null }).modelOverride
      ? [(coverageDef as { modelOverride?: string | null }).modelOverride!]
      : undefined,
  });

  const validated = validateCoverageOutput(coverageResult.outputJson);
  if (!validated.ok) {
    return {
      ok: false,
      code: 'coverage_failed',
      message: `Couldn't refresh the coverage cards: ${validated.errors.join('; ')}`,
    };
  }

  const newReport: ReportV2 = {
    version: 2,
    extractor,
    coverage: validated.value,
  };

  // Persist the new composite report + atomic cost bump.
  await getAnalysisStore().update(analysisId, {
    report: newReport as unknown as never,
    redFlagsCount: validated.value.red_flags.length,
    confidenceOverall: validated.value.confidence_overall,
    errorCode: null,
    errorMessage: null,
  });

  await incrementAnalysisCost(analysisId, coverageResult.costPaise, coverageResult.runId);

  revalidatePath(`/${rec.locale}/policy-health-score/analysis/${analysisId}`);
  return { ok: true };
}
