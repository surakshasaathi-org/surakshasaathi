import 'server-only';
import { invokeAgent } from '@suraksha/agent-sdk';
import { getCoverageStore } from './coverage-store';
import { getAnalysisStore, getDigitizedDocument } from './store';
import { loadAgentDefinition, makePersistRun } from './agent-runs';
import type { CoverageResult } from './coverage-types';

/**
 * Runs the CoveragePredictor against the original uploaded policy + the
 * user's scenario. Writes a real agent_run row and updates the in-memory
 * coverage-check record as it progresses.
 */
export async function runCoveragePipeline(coverageCheckId: string): Promise<void> {
  const cStore = getCoverageStore();
  const rec = await cStore.get(coverageCheckId);
  if (!rec) throw new Error(`coverage check not found: ${coverageCheckId}`);

  const mode = !process.env.GOOGLE_API_KEY || process.env.DEV_STUBS === 'true' ? 'stub' : 'real';
  console.log(
    `[coverage-pipeline] id=${coverageCheckId} mode=${mode} analysis=${rec.sourceAnalysisId}`,
  );

  await cStore.update(coverageCheckId, {
    status: 'analysing',
    startedAt: new Date().toISOString(),
    progressStep: 'Reading your policy for the scenario you described…',
  });

  if (mode === 'stub') {
    await runStubbed(coverageCheckId);
    return;
  }

  await runReal(coverageCheckId);
}

async function runReal(coverageCheckId: string) {
  const cStore = getCoverageStore();
  const aStore = getAnalysisStore();
  const rec = await cStore.get(coverageCheckId);
  if (!rec) return;

  // Read the digitized markdown produced by the Stage-0 policy-digitizer
  // for the source analysis. coverage-predictor reasons over text only —
  // the PDF is never re-read here.
  const analysis = await aStore.get(rec.sourceAnalysisId);
  if (!analysis) throw new Error(`source analysis not found: ${rec.sourceAnalysisId}`);
  const digitized = await getDigitizedDocument(rec.sourceAnalysisId);
  if (!digitized) {
    throw new Error(
      `source analysis has no digitized markdown — re-run the analyse pipeline for ${rec.sourceAnalysisId} before requesting a coverage check`,
    );
  }

  const predictorDef = await loadAgentDefinition('coverage-predictor');
  const persist = makePersistRun();

  const prompt = [
    buildPrompt(rec),
    '',
    'The digitized markdown of the policy is below — this is the ONLY source of truth, there is no PDF attached.',
    '--- BEGIN DIGITIZED MARKDOWN ---',
    digitized.text,
    '--- END DIGITIZED MARKDOWN ---',
  ].join('\n');
  const result = await invokeAgent({
    def: predictorDef,
    invocation: {
      agentId: '' as never,
      tenantId: rec.tenantId as never,
      userId: null,
      caseId: null,
      analysisId: rec.sourceAnalysisId,
      parentRunId: null,
      userMessage: prompt,
      attachments: analysis.documentId
        ? [{ documentId: analysis.documentId as never, kind: 'policy_pdf', ocrText: null }]
        : [],
      locale: rec.locale as 'en' | 'hi' | 'kn',
      extraContext: { coverage_check_id: rec.id, source_analysis_id: rec.sourceAnalysisId },
    },
    persist,
    inlineAttachments: [],
    provider: (predictorDef as { provider?: 'gemini' | 'anthropic' | null }).provider ?? undefined,
    modelCandidatesOverride: (predictorDef as { modelOverride?: string | null }).modelOverride
      ? [(predictorDef as { modelOverride?: string | null }).modelOverride!]
      : undefined,
  });

  console.log(
    `[coverage-pipeline] done id=${coverageCheckId} outcome=${result.outcome} cost=₹${(result.costPaise / 100).toFixed(2)}`,
  );

  const coverage = parseCoverage(result.outputJson);
  if (!coverage) {
    const preview =
      typeof result.outputJson === 'object' && result.outputJson !== null
        ? JSON.stringify(result.outputJson).slice(0, 300)
        : String(result.outputJson).slice(0, 300);
    throw new Error(`CoveragePredictor returned non-coverage JSON. Preview: ${preview}`);
  }

  await cStore.update(coverageCheckId, {
    status: 'ready',
    progressStep: null,
    result: coverage,
    agentRunIds: [result.runId],
    costPaise: result.costPaise,
    readyAt: new Date().toISOString(),
  });
}

function buildPrompt(rec: {
  scenario: { condition: string; hospital: string; expected_amount_band: string; when: string; details: string | null };
  locale: string;
}): string {
  return [
    `A user is about to make a health-insurance claim. Predict whether this specific scenario will be covered under the attached policy. Locale: ${rec.locale}.`,
    `Scenario:`,
    `  - Condition / treatment: ${rec.scenario.condition}`,
    `  - Hospital: ${rec.scenario.hospital}`,
    `  - Expected bill band: ${humanBand(rec.scenario.expected_amount_band)}`,
    `  - Timing: ${humanWhen(rec.scenario.when)}`,
    rec.scenario.details ? `  - Additional context: ${rec.scenario.details}` : '',
    ``,
    `Respond with ONLY the JSON object per your system prompt.`,
  ]
    .filter(Boolean)
    .join('\n');
}

function humanBand(b: string): string {
  switch (b) {
    case '<25k':
      return 'Less than ₹25,000';
    case '25k-50k':
      return '₹25,000 – ₹50,000';
    case '50k-1L':
      return '₹50,000 – ₹1,00,000';
    case '1L-2L':
      return '₹1,00,000 – ₹2,00,000';
    case '2L-5L':
      return '₹2,00,000 – ₹5,00,000';
    case '>5L':
      return 'Over ₹5,00,000';
    default:
      return b;
  }
}

function humanWhen(w: string): string {
  switch (w) {
    case 'this_month':
      return 'Within the next month';
    case '3_months':
      return 'Within the next 3 months';
    case '6_months':
      return 'Within the next 6 months';
    case '1_year':
      return 'Within the next year';
    default:
      return w;
  }
}

function parseCoverage(raw: unknown): CoverageResult | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if ('raw' in o && Object.keys(o).length === 1) return null;
  if (!('prediction' in o) || !('prediction_summary' in o) || !('clauses_that_apply' in o)) return null;
  const p = o.prediction;
  if (p !== 'green' && p !== 'amber' && p !== 'red') return null;
  return raw as CoverageResult;
}

async function runStubbed(coverageCheckId: string) {
  const cStore = getCoverageStore();
  const rec = await cStore.get(coverageCheckId);
  if (!rec) return;

  // Simulate ~8s of thinking then return a canned amber result
  await new Promise((r) => setTimeout(r, 8000));

  const stub: CoverageResult = {
    version: 1,
    generated_at: new Date().toISOString(),
    locale: rec.locale,
    confidence: 0.72,
    prediction: 'amber',
    prediction_summary: `Your "${rec.scenario.condition}" claim is likely partially covered — expect proportionate deduction on the total bill because of the 1% room-rent cap.`,
    scenario_echo: {
      condition: rec.scenario.condition,
      hospital: rec.scenario.hospital,
      expected_amount_band: rec.scenario.expected_amount_band,
      when: rec.scenario.when,
    },
    reasoning: [
      `The procedure itself is an in-patient hospitalisation and is covered under § 2.1.`,
      `The 1% room-rent cap (₹5,000/day under ₹5L sum insured) triggers proportionate deduction on every line of the bill if you take a private room above that rate.`,
      `No waiting period applies — you're in your 2nd year of coverage and this is not a specified-condition exclusion.`,
      `Consumables (gloves, syringes) will be disallowed per § 3.7; expect ~₹3k–10k out-of-pocket on that alone.`,
    ],
    clauses_that_apply: [
      {
        name: 'In-patient coverage',
        impact: 'covered',
        detail: 'Standard hospitalisation (room + surgery + nursing + diagnostics) is covered.',
        citation: {
          page: 4,
          section_label: '§ 2.1',
          quoted_text: 'Covers expenses incurred on inpatient treatment including room rent, ICU, …',
        },
      },
      {
        name: 'Room-rent cap + proportionate deduction',
        impact: 'capped',
        detail: `Room rent is limited to 1% of sum assured per day. If your actual room rent exceeds this, every line of the bill is proportionately reduced — this is the single biggest payout-shrinker.`,
        citation: {
          page: 13,
          section_label: '§ 5.1',
          quoted_text: 'Room rent limited to 1% of sum assured per day. Proportionate deduction applies.',
        },
      },
    ],
    what_could_go_wrong: [
      {
        risk: 'Hospital assigns a single private room above ₹5,000/day',
        probability: 'high',
        mitigation: 'Explicitly ask at admission for a room within ₹5,000/day.',
      },
      {
        risk: 'Doctor prescribes consumables not covered by the policy',
        probability: 'medium',
        mitigation: 'Budget ₹3k–10k out-of-pocket for gloves, syringes, PPE, disposables.',
      },
    ],
    what_to_do_now: [
      {
        action: 'Call the hospital and ask for cashless pre-authorisation',
        urgency: 'do_this_month',
        why: 'Pre-auth catches disputes before they become rejections.',
      },
      {
        action: 'Ask your insurer about a room-rent-waiver add-on before admission',
        urgency: 'do_this_month',
        why: 'A one-time add-on (~₹2,000/yr) eliminates the proportionate-deduction risk.',
      },
    ],
    estimated_payout_range_paise: {
      min: 12000000,
      max: 18000000,
      explanation: 'Expected ~₹1.2L–1.8L payout on a ₹2L bill, after proportionate deductions and consumable exclusions.',
    },
    disclaimer:
      'AI prediction based on the policy text you uploaded. Verify with your insurer before acting.',
  };

  const costPaise = 8000 + Math.floor(Math.random() * 3000);
  await cStore.update(coverageCheckId, {
    status: 'ready',
    progressStep: null,
    result: stub,
    costPaise,
    readyAt: new Date().toISOString(),
  });
}
