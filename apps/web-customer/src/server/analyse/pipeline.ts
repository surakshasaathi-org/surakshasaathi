import 'server-only';
import {
  digitizerModelsAnthropic,
  invokeAgent,
  type InlineAttachment,
} from '@suraksha/agent-sdk';
import {
  getAnalysisStore,
  getDigitizedDocument,
  saveDigitizedDocument,
  type AnalysisStatus,
  type DigitizedDocument,
} from './store';
import { demoReportFor, type AnalysisReport } from './demo-report';
import { loadAgentDefinition, makePersistRun } from './agent-runs';
import { downloadPolicyDocument } from './storage';
import type {
  CoverageOutput,
  DemographicsInput,
  ExtractorOutput,
  ReportV2,
} from './report-v2-types';
import { validateCoverageOutput, validateExtractorOutput } from './report-v2-validate';
import { linkAnalysisToPolicy } from './policy-link';
import { enrichExtractor } from '@/server/policies/categorise';
import { computeAndStoreScore } from '@/server/scoring';
import { enqueueAnalysisReadyEmail } from '@/server/notifications/renewal-reminders';

/**
 * Error raised by the Stage-0 intake gate when the uploaded document isn't a
 * health policy. actions.ts catches this specifically so we can persist a
 * distinct errorCode for the UI.
 */
export class NotAHealthPolicyError extends Error {
  constructor(
    public detectedType: string,
    public reason: string,
    public confidence: number,
  ) {
    super(`not_a_policy: ${detectedType} — ${reason}`);
    this.name = 'NotAHealthPolicyError';
  }
}

/**
 * Raised when any agent in the chain fails because the upstream LLM provider
 * is unreachable / overloaded (429, 5xx, connection resets). Separate from
 * NotAHealthPolicyError because the user-facing message + recovery path are
 * different: "Gemini is having a moment, retry in a minute" vs "we don't
 * think this is a policy".
 */
export class UpstreamUnavailableError extends Error {
  constructor(
    public stage: string,
    cause: string,
  ) {
    super(`upstream_unavailable at ${stage}: ${cause}`);
    this.name = 'UpstreamUnavailableError';
  }
}

/**
 * Wrap an invokeAgent call so that fallback-worthy errors from the agent-sdk
 * (upstreamTransient=true or modelUnavailable=true) surface as our
 * `UpstreamUnavailableError`. Without this, actions.ts would catch a generic
 * Error and mis-classify as `pipeline_error` instead of `upstream_unavailable`
 * when all candidate models exhaust — the UI would then show the red "couldn't
 * complete" banner with a Gemini error dump instead of the friendly yellow
 * "having a moment" retry banner.
 */
async function callAgentWithUpstreamMap<T>(
  stage: string,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    const e = err as Error & { upstreamTransient?: boolean; modelUnavailable?: boolean };
    if (e.upstreamTransient === true || e.modelUnavailable === true) {
      throw new UpstreamUnavailableError(stage, e.message.slice(0, 240));
    }
    throw err;
  }
}

/**
 * Analyse-My-Policy v2 pipeline — 2-stage agent chain.
 *
 *   Stage 1: policy-extractor  (Sonnet) — PDF vision → ExtractorOutput
 *   Stage 2: policy-coverage   (Opus)   → CoverageOutput (per-member cards)
 *   (Stage 3: customer-explainer runs on-demand from the report page chat, not here.)
 *
 * Modes:
 *   - Stub mode: DEV_STUBS=true OR no GOOGLE_API_KEY → canned demo report (v1 shape)
 *   - Real mode: run the two-agent chain
 *   - Partial failure: if extractor succeeds but coverage fails, persist a ReportV2
 *     with `coverage: null` and status='ready'; the UI offers a "retry coverage" path.
 *   - Total failure: status='failed' with a concrete errorMessage. Never silently
 *     fall back to the demo report.
 */

function isDevStubNow(): boolean {
  return !process.env.GOOGLE_API_KEY || process.env.DEV_STUBS === 'true';
}

export async function runAnalysisPipeline(analysisId: string): Promise<void> {
  const store = getAnalysisStore();
  const rec = await store.get(analysisId);
  if (!rec) throw new Error(`analysis not found: ${analysisId}`);

  const mode = isDevStubNow() ? 'stub' : 'real';
  console.log(
    `[pipeline] analysisId=${analysisId} mode=${mode} locale=${rec.locale} storagePath=${rec.fileMeta.storagePath}`,
  );

  const startedAt = new Date().toISOString();
  await store.update(analysisId, { startedAt, status: 'intake_running', progressStep: 'Starting…' });

  if (mode === 'stub') {
    await runStubbed(analysisId, rec.locale);
    return;
  }
  await runReal(analysisId);
}

/* ───────── Real pipeline ───────── */

async function runReal(analysisId: string) {
  const store = getAnalysisStore();
  const rec = await store.get(analysisId);
  if (!rec) return;

  if (!rec.fileMeta.storagePath) {
    throw new Error('storage_path missing on analysis record');
  }

  let fileAttachment: InlineAttachment;
  try {
    const buf = await downloadPolicyDocument(rec.fileMeta.storagePath);
    fileAttachment = { mime: rec.fileMeta.mime, data: buf };
  } catch (err) {
    throw new Error(
      `failed to read uploaded file analysisId=${analysisId} path=${rec.fileMeta.storagePath} cause=${(err as Error).message}`,
    );
  }

  // ── Stage 0a: policy-digitizer ─────────────────────────────────────────
  // Vision pass over the raw PDF/image — emits structured markdown that
  // every downstream agent (intake, extractor, coverage) consumes as TEXT
  // instead of re-vision-ing the binary. The output is persisted to
  // policy_document.extracted so re-runs (refine, coverage-check) skip it.
  let digitized = await getDigitizedDocument(analysisId);
  let digitizerRunId: string | null = null;
  let digitizerCostPaise = 0;
  if (!digitized) {
    await store.update(analysisId, {
      status: 'digitizing',
      progressStep: 'Digitizing the policy document…',
    });
    const digitizerDef = await loadAgentDefinition('policy-digitizer');
    const digitizerResult = await callAgentWithUpstreamMap(
      'digitizer',
      () =>
        invokeAgent({
          def: digitizerDef,
          invocation: buildInvocation(
            rec,
            'Digitize the attached document into faithful markdown per your system prompt. Respond with ONLY the JSON object.',
          ),
          persist: makePersistRun(),
          inlineAttachments: [fileAttachment],
          // 120s is the upper bound of an acceptable customer wait on a
          // single call. A 50-page policy that exceeds this surfaces as a
          // transient upstream error → "retry in a minute" banner; far
          // better customer UX than spinning for 3-5 min. Long-tail
          // documents are addressed by per-page parallel digitization
          // (followup task) rather than longer single-call timeouts.
          requestTimeoutMs: 120 * 1000,
          // Provider + model are admin-editable per agent (see
          // agent_definition.provider / .model_override). Defaults below
          // apply when admin hasn't overridden. The digitizer wants Claude
          // for vision PDF transcription with prompt caching; if admin
          // pins a specific model, that wins.
          provider: digitizerDef.provider ?? 'anthropic',
          modelCandidatesOverride: digitizerDef.modelOverride
            ? [digitizerDef.modelOverride]
            : digitizerModelsAnthropic(),
        }),
    );
    digitizerRunId = digitizerResult.runId;
    digitizerCostPaise = digitizerResult.costPaise;
    const parsedDigitizer = parseDigitizerOutput(digitizerResult.outputJson);
    if (!parsedDigitizer) {
      const raw = digitizerResult.outputJson;
      const isUpstream =
        typeof raw === 'object' &&
        raw !== null &&
        ((raw as Record<string, unknown>).upstreamTransient === true ||
          (raw as Record<string, unknown>).modelUnavailable === true);
      if (isUpstream) {
        const cause = String(
          (raw as Record<string, unknown> | null)?.error ?? 'unknown',
        ).slice(0, 240);
        throw new UpstreamUnavailableError('digitizer', cause);
      }
      // Surface the actual model-side message (truncation, schema mismatch,
      // empty response) so the admin can diagnose from the agent_run row.
      const rawObj = raw as Record<string, unknown> | null;
      const inner = String(rawObj?.error ?? rawObj?.raw ?? '').slice(0, 240);
      throw new Error(
        `policy-digitizer returned no usable markdown${inner ? ` — ${inner}` : ''}. Try again; if this persists, the document may be too large or unreadable.`,
      );
    }
    digitized = {
      text: parsedDigitizer.markdown,
      totalPages: parsedDigitizer.totalPages,
      charCount: parsedDigitizer.markdown.length,
      qualityFlags: parsedDigitizer.qualityFlags,
      digitizedAt: new Date().toISOString(),
      digitizerRunId: digitizerResult.runId,
    };
    await saveDigitizedDocument(analysisId, digitized);
    console.log(
      `[pipeline] digitizer done analysisId=${analysisId} pages=${digitized.totalPages} chars=${digitized.charCount} flags=[${digitized.qualityFlags.join(',')}] cost=₹${(digitizerResult.costPaise / 100).toFixed(2)}`,
    );
  } else {
    console.log(
      `[pipeline] digitizer cache hit analysisId=${analysisId} chars=${digitized.charCount}`,
    );
  }
  const policyMarkdown = digitized.text;

  // ── Stage 0b: intake gate ─────────────────────────────────────────────
  // Cheap text-only check: is this actually a health-insurance policy?
  // Prevents us from spending ~₹20 on extractor+coverage for a wedding invite.
  await store.update(analysisId, {
    status: 'intake_running',
    progressStep: 'Checking this is a health-insurance policy…',
  });

  const intakeDef = await loadAgentDefinition('policy-intake-classifier');
  const intakeResult = await callAgentWithUpstreamMap(
    'intake',
    () =>
      invokeAgent({
        def: intakeDef,
        invocation: buildInvocation(
          rec,
          [
            'Classify whether the digitized document below is a genuine Indian health-insurance policy.',
            'Respond with ONLY the JSON object specified in your system prompt.',
            '',
            '--- BEGIN DIGITIZED MARKDOWN ---',
            policyMarkdown,
            '--- END DIGITIZED MARKDOWN ---',
          ].join('\n'),
        ),
        persist: makePersistRun(),
        inlineAttachments: [],
        provider: intakeDef.provider ?? undefined,
        modelCandidatesOverride: intakeDef.modelOverride
          ? [intakeDef.modelOverride]
          : undefined,
      }),
  );

  const intake = parseIntakeOutput(intakeResult.outputJson);
  console.log(
    `[pipeline] intake analysisId=${analysisId} is_health_policy=${intake?.is_health_policy} type=${intake?.detected_document_type} conf=${intake?.confidence} cost=₹${(intakeResult.costPaise / 100).toFixed(2)}`,
  );

  if (!intake) {
    // Distinguish the two failure modes:
    //   (a) Gemini itself errored out (429/5xx/model-404) — run.ts stored
    //       `{error: "...", upstreamTransient: true|false, modelUnavailable?: true}`.
    //       Route to UpstreamUnavailableError so the UI shows a "retry in a
    //       minute" banner with no implication the user's document is bad.
    //   (b) The model returned text we couldn't parse as JSON — that's
    //       "unreadable" territory, surface as NotAHealthPolicyError.
    const raw = intakeResult.outputJson;
    const rawObj = raw as Record<string, unknown> | null;
    const isUpstream =
      typeof raw === 'object' &&
      raw !== null &&
      (rawObj?.upstreamTransient === true || rawObj?.modelUnavailable === true);
    const preview =
      typeof raw === 'object' && raw !== null
        ? JSON.stringify(raw).slice(0, 400)
        : String(raw).slice(0, 400);
    console.warn(
      `[pipeline] intake-classifier no usable output analysisId=${analysisId} upstream=${isUpstream} preview=${preview}`,
    );
    if (isUpstream) {
      const cause =
        (raw && typeof raw === 'object' && 'error' in (raw as Record<string, unknown>)
          ? String((raw as { error: unknown }).error)
          : 'unknown'
        ).slice(0, 240);
      throw new UpstreamUnavailableError('intake', cause);
    }
    throw new NotAHealthPolicyError(
      'unreadable',
      'intake classifier returned unparseable JSON',
      0,
    );
  }
  if (!intake.is_health_policy) {
    throw new NotAHealthPolicyError(
      intake.detected_document_type,
      intake.reason,
      intake.confidence,
    );
  }

  // ── Stage 1: policy-extractor ─────────────────────────────────────────
  await store.update(analysisId, {
    status: 'extracting',
    progressStep: 'Extracting coverage, exclusions, waiting periods…',
  });

  const extractorDef = await loadAgentDefinition('policy-extractor');
  const persist = makePersistRun();

  const extractorResult = await callAgentWithUpstreamMap(
    'extractor',
    () =>
      invokeAgent({
        def: extractorDef,
        invocation: buildInvocation(
          rec,
          [
            'Extract the structured policy snapshot for this Indian health-insurance document.',
            'The digitized markdown below is the ONLY source of truth — there is no PDF attached.',
            'Follow the schema in your system prompt exactly. Respond with ONLY the JSON object.',
            '',
            '--- BEGIN DIGITIZED MARKDOWN ---',
            policyMarkdown,
            '--- END DIGITIZED MARKDOWN ---',
          ].join('\n'),
        ),
        persist,
        inlineAttachments: [],
        provider: extractorDef.provider ?? undefined,
        modelCandidatesOverride: extractorDef.modelOverride
          ? [extractorDef.modelOverride]
          : undefined,
      }),
  );

  console.log(
    `[pipeline] policy-extractor done analysisId=${analysisId} outcome=${extractorResult.outcome} cost=₹${(extractorResult.costPaise / 100).toFixed(2)} confidence=${extractorResult.confidence ?? 'n/a'}`,
  );

  // Upstream LLM failure during extractor call — agent-sdk stashes the
  // thrown error into `outputJson: { error, upstreamTransient, modelUnavailable }`.
  // Detect that here BEFORE Zod validation, otherwise the error-shaped
  // object fails the schema check and users see a confusing Zod dump
  // instead of the "Gemini is having a moment" retry banner.
  if (extractorResult.outcome === 'refused' &&
      extractorResult.outputJson &&
      typeof extractorResult.outputJson === 'object') {
    const obj = extractorResult.outputJson as { upstreamTransient?: boolean; modelUnavailable?: boolean; error?: unknown };
    if (obj.upstreamTransient === true || obj.modelUnavailable === true) {
      const causeText = String(obj.error ?? 'upstream provider unavailable').slice(0, 240);
      throw new UpstreamUnavailableError('extractor', causeText);
    }
  }

  const extractorValidation = validateExtractorOutput(extractorResult.outputJson);
  if (!extractorValidation.ok) {
    // When the model's response is unparseable JSON, parseOutput wraps it as
    // `{ raw: "<truncated text>" }`. Detect that so the user sees a
    // recoverable "try again" message instead of a 200-char Zod-error dump.
    const isRawFallback =
      typeof extractorResult.outputJson === 'object' &&
      extractorResult.outputJson !== null &&
      'raw' in (extractorResult.outputJson as Record<string, unknown>);
    if (isRawFallback) {
      throw new Error(
        `policy-extractor output was truncated or malformed — the model likely hit maxTokens. ` +
          `Try again; if this persists, raise agent_definition.max_tokens for policy-extractor.`,
      );
    }
    throw new Error(
      `policy-extractor output failed validation: ${extractorValidation.errors.join('; ')} | preview: ${extractorValidation.preview}`,
    );
  }
  // Mint stable citation ids BEFORE handing the extractor output to the
  // coverage agent. Coverage will reference clauses via citation_ref = id,
  // so re-ordering between runs can't silently mis-point the UI.
  const extractor = mintCitationIds(extractorValidation.value);

  // Persist an INTERMEDIATE report containing just the extractor output so
  // the customer-facing progress UI can surface live snapshots (insurer
  // name, plan name, member count, sub-limit / exclusion / waiting-period
  // counts) while the coverage agent is still running. Coverage agent
  // adds the per-member cards in the next stage; the final report write
  // (~lines 497) overwrites this one with the full payload.
  try {
    await store.update(analysisId, {
      report: { version: 2, extractor, coverage: null } as unknown as AnalysisReport,
    });
  } catch (err) {
    console.warn(
      `[pipeline] intermediate report write failed (non-fatal) analysisId=${analysisId} err=${(err as Error).message}`,
    );
  }

  // Link this analysis to its canonical `policy` row. Best-effort: if the
  // extractor didn't pull a clean insurer + policy_number the link is
  // skipped (policy_id stays NULL). We do NOT fail the pipeline here —
  // the analysis can be viewed independent of whether it's linked.
  try {
    const linkedPolicyId = await linkAnalysisToPolicy(
      analysisId,
      rec.tenantId,
      rec.userId,
      extractor,
    );
    if (linkedPolicyId) {
      console.log(
        `[pipeline] analysis linked to policy analysisId=${analysisId} policyId=${linkedPolicyId}`,
      );
    }
  } catch (err) {
    console.warn(
      `[pipeline] policy link failed (non-fatal) analysisId=${analysisId} err=${(err as Error).message}`,
    );
  }

  const agentRunIds: string[] = [extractorResult.runId];
  let totalCostPaise = extractorResult.costPaise;

  // ── Stage 2: policy-coverage ──────────────────────────────────────────
  await store.update(analysisId, {
    status: 'analysing',
    progressStep: 'Building per-member coverage cards and finding must-watch items…',
  });

  const demographics = readDemographics(rec.demographics) ?? defaultDemographicsFromExtractor(extractor, rec.locale);

  let coverage: CoverageOutput | null = null;
  let coverageError: string | null = null;

  try {
    const coverageDef = await loadAgentDefinition('policy-coverage');
    const coverageResult = await invokeAgent({
      def: coverageDef,
      invocation: buildInvocation(
        rec,
        [
          `You are analysing the uploaded policy for the user. Locale: ${rec.locale}.`,
          `Here is the policy-extractor output (Stage 1, ground truth — never invent beyond this).`,
          `Every clause-carrying item has a stable "id" field (cs_N / ex_N / wp_N / sl_N).`,
          `Use that id verbatim as "citation_ref" in your output — do NOT invent new ids, do NOT use names.`,
          '```json',
          JSON.stringify(extractor),
          '```',
          `Here is the user-supplied demographics / family context:`,
          '```json',
          JSON.stringify(demographics),
          '```',
          `Produce the per-member CoverageOutput JSON as specified in your system prompt. Respond with ONLY the JSON object.`,
        ].join('\n'),
      ),
      persist: makePersistRun(),
      inlineAttachments: [], // coverage reasons over the extractor output; no PDF attachment needed
      provider: coverageDef.provider ?? undefined,
      modelCandidatesOverride: coverageDef.modelOverride
        ? [coverageDef.modelOverride]
        : undefined,
    });

    agentRunIds.push(coverageResult.runId);
    totalCostPaise += coverageResult.costPaise;

    const coverageValidation = validateCoverageOutput(coverageResult.outputJson);
    if (!coverageValidation.ok) {
      coverage = null;
      coverageError = `policy-coverage output failed validation: ${coverageValidation.errors.join('; ')}`;
      console.warn(
        `[pipeline] ${coverageError} analysisId=${analysisId} preview=${coverageValidation.preview}`,
      );
    } else {
      coverage = coverageValidation.value;
      console.log(
        `[pipeline] policy-coverage done analysisId=${analysisId} outcome=${coverageResult.outcome} cost=₹${(coverageResult.costPaise / 100).toFixed(2)} cards=${coverage.member_cards.length}`,
      );
    }
  } catch (err) {
    coverageError = (err as Error).message;
    console.warn(`[pipeline] policy-coverage failed analysisId=${analysisId} err=${coverageError}`);
    // partial-failure path: we still ship the extractor output below
  }

  // ── Persist composite ReportV2 ─────────────────────────────────────────
  const report: ReportV2 = { version: 2, extractor, coverage };

  // Include the intake cost + run id in the final ledger so cost + audit are
  // complete on the analysis row.
  agentRunIds.unshift(intakeResult.runId);
  totalCostPaise += intakeResult.costPaise;
  // Digitizer runs once per document; on a re-run (refine, coverage-check)
  // it's a cache hit and contributes 0. Only push the run id when we
  // actually invoked it on this pipeline pass.
  if (digitizerRunId) {
    agentRunIds.unshift(digitizerRunId);
    totalCostPaise += digitizerCostPaise;
  }

  await store.update(analysisId, {
    status: 'ready',
    progressStep: null,
    report: report as unknown as AnalysisReport, // v1/v2 union stored on same column
    readyAt: new Date().toISOString(),
    agentRunIds,
    costPaise: totalCostPaise,
    // v2 has no numeric readiness_score — intentionally null (see architecture decision)
    readinessScore: null,
    redFlagsCount: coverage?.red_flags.length ?? 0,
    confidenceOverall:
      coverage?.confidence_overall ?? extractor.confidence_overall ?? extractorResult.confidence ?? null,
    errorCode: coverage ? null : 'coverage_failed',
    errorMessage: coverage ? null : coverageError,
  });

  // Background: compute + persist the readiness score. Best-effort — failure
  // here must never flip the analysis status or the email send. Scoring is
  // internal-only by default (per product decision #7 — gated behind
  // `policy_score.is_internal=true` until calibration month completes).
  computeAndStoreScore({
    tenantId: rec.tenantId,
    analysisId,
    userId: rec.userId,
    extractor: enrichExtractor(extractor),
  }).catch((err) => {
    console.warn(
      `[pipeline] readiness-score compute failed (non-fatal) analysisId=${analysisId} err=${(err as Error).message}`,
    );
  });

  // Fire the "analysis ready" email for signed-in users. Best-effort: email
  // failures must never fail the pipeline. The dedupe key on enqueueNotification
  // guarantees no double-sends if the pipeline is somehow retried.
  if (rec.userId && coverage) {
    const highSeverityCount = coverage.red_flags.filter((f) => f.severity === 'high').length;
    enqueueAnalysisReadyEmail({
      userId: rec.userId,
      tenantId: rec.tenantId,
      analysisId,
      insurerName: extractor.basic_facts.insurer_name,
      highSeverityCount,
    }).catch((err) => {
      console.warn(
        `[pipeline] analysis_ready email enqueue failed (non-fatal) analysisId=${analysisId} err=${(err as Error).message}`,
      );
    });
  }
}

/* ───────── Intake classifier output ───────── */

/**
 * Stage-0 digitizer output. The agent emits per-page markdown; downstream
 * agents only need the concatenated text + summary metadata. We flatten the
 * pages[] array into one string here so callers don't need to re-stitch.
 */
interface DigitizerParsed {
  markdown: string;
  totalPages: number;
  qualityFlags: string[];
}

function parseDigitizerOutput(raw: unknown): DigitizerParsed | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if ('raw' in o && Object.keys(o).length === 1) return null;
  if (!Array.isArray(o.pages)) return null;
  const parts: string[] = [];
  for (const p of o.pages) {
    if (typeof p !== 'object' || p === null) continue;
    const pp = p as Record<string, unknown>;
    const md = typeof pp.markdown === 'string' ? pp.markdown : '';
    const pageNo = typeof pp.pageNo === 'number' ? pp.pageNo : parts.length + 1;
    if (md.length > 0) parts.push(`<!-- page ${pageNo} -->\n${md}`);
  }
  if (parts.length === 0) return null;
  const totalPages = typeof o.totalPages === 'number' ? o.totalPages : parts.length;
  const qualityFlags = Array.isArray(o.qualityFlags)
    ? o.qualityFlags.filter((f): f is string => typeof f === 'string')
    : [];
  return { markdown: parts.join('\n\n'), totalPages, qualityFlags };
}

interface IntakeOutput {
  is_health_policy: boolean;
  confidence: number;
  detected_document_type: string;
  reason: string;
  insurer_hint: string | null;
  policy_type_hint: string | null;
}

function parseIntakeOutput(raw: unknown): IntakeOutput | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if ('raw' in o && Object.keys(o).length === 1) return null;
  if (typeof o.is_health_policy !== 'boolean') return null;
  return {
    is_health_policy: o.is_health_policy,
    confidence: typeof o.confidence === 'number' ? o.confidence : 0,
    detected_document_type:
      typeof o.detected_document_type === 'string' ? o.detected_document_type : 'other_document',
    reason: typeof o.reason === 'string' ? o.reason : '',
    insurer_hint: typeof o.insurer_hint === 'string' ? o.insurer_hint : null,
    policy_type_hint: typeof o.policy_type_hint === 'string' ? o.policy_type_hint : null,
  };
}

/* ───────── Citation id minting ───────── */

/**
 * Deterministic id minting for every citation-carrying item. Pattern:
 *   coverage_sections[0]  → cs_0
 *   exclusions[3]         → ex_3
 *   waiting_periods[1]    → wp_1
 *   sub_limits[0]         → sl_0
 *
 * Short + stable + collision-free within a single extractor run. We don't
 * attempt content-addressable hashing here — if the LLM re-extracts the same
 * clause with slightly different wording on a retry, the ids will still map
 * by position in the new output. The coverage agent always receives these ids
 * alongside the content, so it references the current set, not a stale one.
 */
function mintCitationIds(extractor: ExtractorOutput): ExtractorOutput {
  return {
    ...extractor,
    coverage_sections: extractor.coverage_sections.map((s, i) => ({ ...s, id: `cs_${i}` })),
    exclusions: extractor.exclusions.map((e, i) => ({ ...e, id: `ex_${i}` })),
    waiting_periods: extractor.waiting_periods.map((w, i) => ({ ...w, id: `wp_${i}` })),
    sub_limits: extractor.sub_limits.map((s, i) => ({ ...s, id: `sl_${i}` })),
  };
}

/* ───────── Parsing ───────── */

function readDemographics(raw: unknown): DemographicsInput | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.members)) return null;
  return raw as DemographicsInput;
}

/**
 * Fallback demographics when the user hasn't filled the supplemental form —
 * synthesise one member per extractor-listed member so coverage can still run.
 * This keeps upload-to-report flow working for users who skip the form.
 */
function defaultDemographicsFromExtractor(
  extractor: ExtractorOutput,
  locale: string,
): DemographicsInput {
  return {
    members: extractor.basic_facts.members.map((m, i) => ({
      ref: m.relation || `member_${i + 1}`,
      // If the extractor couldn't determine age, pass null through rather than
      // defaulting to 0 (which the coverage agent would reason over as a real
      // age). The agent prompt tolerates null and will flag "age_unknown" on
      // the resulting card.
      age: m.age ?? (null as unknown as number),
      display_label: [m.relation, m.age ? `${m.age}` : 'age unknown']
        .filter(Boolean)
        .join(', '),
      pre_existing: m.pre_existing,
      notes: m.age == null ? 'age_unknown' : undefined,
    })),
    locale: (locale as 'en' | 'hi' | 'kn') ?? 'en',
  };
}

/* ───────── Stub pipeline (unchanged — still v1 shape) ───────── */

const STUB_STEPS: Array<{ status: AnalysisStatus; ms: number; msg: (locale: string) => string }> = [
  { status: 'intake_running', ms: 1500, msg: () => 'Confirming this is a health-insurance policy…' },
  { status: 'extracting', ms: 4000, msg: () => 'Extracting coverage, exclusions, waiting periods…' },
  { status: 'analysing', ms: 6000, msg: () => 'Reading the fine print and finding red flags…' },
  { status: 'translating', ms: 2000, msg: (l) => `Translating into ${displayLocale(l)}…` },
  { status: 'reviewing', ms: 2000, msg: () => 'Double-checking every citation…' },
];

async function runStubbed(analysisId: string, locale: string) {
  const store = getAnalysisStore();
  for (const s of STUB_STEPS) {
    await store.update(analysisId, { status: s.status, progressStep: s.msg(locale) });
    await sleep(s.ms);
  }
  const report = demoReportFor(locale);
  const costPaise = 13000 + Math.floor(Math.random() * 4000);
  await store.update(analysisId, {
    status: 'ready',
    progressStep: null,
    report,
    readyAt: new Date().toISOString(),
    costPaise,
    readinessScore: report.readiness_score,
    redFlagsCount: report.red_flags.length,
    confidenceOverall: report.confidence_overall,
  });
}

function buildInvocation(
  rec: { id: string; tenantId: string; locale: string; documentId?: string | null; fileMeta?: { mime?: string } },
  userMessage: string,
) {
  // The PDF/image is sent to the model as an inlineAttachment (raw bytes),
  // but we ALSO record its policy_document.id here so the agent_run row's
  // attached_document_ids column links the run back to its source artifact —
  // visible in the admin trace view at /agent-runs/[runId].
  const attachments = rec.documentId
    ? [{ documentId: rec.documentId as never, kind: 'policy_pdf', ocrText: null }]
    : [];
  return {
    agentId: '' as never,
    tenantId: rec.tenantId as never,
    userId: null,
    caseId: null,
    analysisId: rec.id,
    parentRunId: null,
    userMessage,
    attachments,
    locale: rec.locale as 'en' | 'hi' | 'kn',
    extraContext: { analysis_id: rec.id },
  };
}

function displayLocale(locale: string): string {
  if (locale === 'hi') return 'Hindi';
  if (locale === 'kn') return 'Kannada';
  return 'English';
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function isDevStubMode(): boolean {
  return isDevStubNow();
}
