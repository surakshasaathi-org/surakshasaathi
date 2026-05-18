import { GoogleGenerativeAI, type Content, type GenerativeModel, type Part } from '@google/generative-ai';
import type { AgentDefinition, AgentInvocation, AgentRunOutcome, ModelTier } from '@suraksha/types';
import { modelsFor } from './router';
import { costPaiseFor } from './pricing';

/**
 * Invoke an agent with full persistence. Provider: Google Gemini.
 *
 *   - Native PDF/image vision (up to 1,000 pages) — no OCR vendor
 *   - Generous free tier; competitive paid pricing
 *   - Prompt caching is implicit today; switch to `cacheContents` API for
 *     large contexts when needed
 *
 * Contract is provider-agnostic — same InvokeArgs / InvokeResult surface so
 * consumers don't care who the LLM is. Swapping back to Anthropic is a 20-line
 * edit here + pricing table update.
 */

export interface InvokeArgs {
  def: AgentDefinition;
  invocation: AgentInvocation;
  persist: PersistRunFn;
  inlineAttachments?: InlineAttachment[];
  /** Per-call override of the per-request wall-clock timeout (ms). Defaults
   *  to 90s — fine for JSON-extractor-style outputs but too short for the
   *  vision-digitizer transcribing a 50-page policy (output decode alone can
   *  exceed 3 minutes). Pass a higher value (e.g. 300_000) for that call site. */
  requestTimeoutMs?: number;
  /** Per-call override of the candidate model list. Bypasses the modelTier
   *  → models mapping for agents that need a curated list (e.g. the digitizer
   *  pins to `gemini-2.5-flash` and skips the flash-lite fallback because
   *  flash-lite mangles tables). Pass undefined to use the def.modelTier
   *  default. */
  modelCandidatesOverride?: string[];
  /** Which LLM provider to dispatch to. Defaults to 'gemini' (existing
   *  behaviour). Pass 'anthropic' to route through the Claude API path —
   *  used by the policy-digitizer for vision PDF transcription with
   *  prompt caching. The persist row + InvokeResult shape is identical
   *  across providers, so callers don't branch on this. */
  provider?: 'gemini' | 'anthropic';
  /**
   * Optional per-LLM-call hook. The SDK invokes this once per generateContent
   * round-trip (NOT once per invokeAgent call) so the consumer can persist
   * an `agent_run_step` row for the trace viewer. Best-effort — failures
   * are logged but never propagate into the agent result.
   *
   * Lives in the consumer (web-customer) so this package stays free of DB
   * imports. The Eval Lab admin trace viewer reads what this writes.
   * (Decision 2026-04-25 — see docs/prd/01c-eval-lab.md §6.3.)
   */
  recordStep?: StepRecorderFn;
  /** Tags every persisted agent_run with `customer_upload` (real customer
   *  document) or `eval_lab` (admin Run/Run-batch/Run-judge). Defaults to
   *  `customer_upload` so existing call sites stay correct without edits. */
  runSource?: 'customer_upload' | 'eval_lab';
  /** Deployment env for the run; defaults from APP_ENV / VERCEL_ENV. */
  deployEnv?: 'prod' | 'uat' | 'local';
}

export interface StepRecorderFn {
  (step: {
    agentRunId: string;
    stepIndex: number;
    kind: 'llm_call' | 'tool_call';
    modelId: string | null;
    toolName: string | null;
    inputTokens: number | null;
    outputTokens: number | null;
    cacheCreationInputTokens: number | null;
    cacheReadInputTokens: number | null;
    costPaise: number;
    latencyMs: number;
    promptRedacted: string | null;
    completionRedacted: string | null;
    toolArgsJson: Record<string, unknown> | null;
    toolResultJson: Record<string, unknown> | null;
    errorMessage: string | null;
    startedAt: Date;
    endedAt: Date;
    runSource: 'customer_upload' | 'eval_lab';
    deployEnv: 'prod' | 'uat' | 'local';
  }): Promise<void>;
}

export interface PersistRunFn {
  (row: {
    tenantId: string;
    userId: string | null;
    caseId: string | null;
    analysisId: string | null;
    agentSlug: string;
    agentVersion: number;
    parentRunId: string | null;
    inputSummary: string;
    attachedDocumentIds: string[];
    outputJson: unknown;
    confidence: number | null;
    outcome: AgentRunOutcome;
    modelUsed: string;
    promptTokens: number;
    completionTokens: number;
    cachedTokens: number;
    costPaise: number;
    latencyMs: number;
    userVisibleSummary: string | null;
    startedAt: Date;
    endedAt: Date;
    /** 'customer_upload' (real customer triggered) | 'eval_lab' (admin
     *  Run/Run-batch/Run-judge in the Eval Lab). Optional for backward-
     *  compat: persistors should default missing values to 'customer_upload'. */
    runSource?: 'customer_upload' | 'eval_lab';
    /** 'prod' | 'uat' | 'local'. Optional for backward-compat. */
    deployEnv?: 'prod' | 'uat' | 'local';
    /** When runSource = 'eval_lab' and the run is part of a batch, this
     *  binds the run to its eval_batch_run row. */
    batchRunId?: string | null;
    /** When runSource = 'eval_lab', the golden case being scored. */
    goldenCaseId?: string | null;
  }): Promise<string>;
}

export interface InvokeResult {
  runId: string;
  outputJson: unknown;
  outcome: AgentRunOutcome;
  confidence: number | null;
  needsReview: boolean;
  costPaise: number;
}

/**
 * Per-invocation file attachment. Gemini accepts inline base64 (up to 20 MB
 * per part); larger documents go via the Files API (fast-follow).
 */
export interface InlineAttachment {
  mime: string;
  /** Raw bytes (Buffer/Uint8Array) or a base64-encoded string. */
  data: Buffer | Uint8Array | string;
}

const client = () => {
  const key = process.env.GOOGLE_API_KEY;
  if (!key) throw new Error('GOOGLE_API_KEY not set');
  return new GoogleGenerativeAI(key);
};

export async function invokeAgent(args: InvokeArgs): Promise<InvokeResult> {
  // Provider dispatch — Anthropic path is used by the digitizer (vision PDF
  // transcription with prompt caching). Default Gemini path handles the
  // rest of the agent fleet. Both call paths return identical shape.
  if (args.provider === 'anthropic') {
    const { invokeAgentAnthropic } = await import('./run-anthropic');
    return invokeAgentAnthropic(args);
  }
  const { def, invocation, persist, inlineAttachments = [], modelCandidatesOverride } = args;
  const candidates =
    modelCandidatesOverride && modelCandidatesOverride.length > 0
      ? modelCandidatesOverride
      : modelsFor(def.modelTier);
  const startedAt = new Date();

  // Model-fallback loop: try each candidate model in turn, each with its own
  // full retry budget. If the primary (e.g. gemini-2.5-flash) is in a
  // sustained-overload window, we transparently drop to the fallback (e.g.
  // gemini-2.0-flash) instead of failing the analysis. The persisted
  // `model_used` reflects whichever model actually produced the output, so
  // cost + audit lines up.
  let modelId = candidates[0]!;
  let lastError: (Error & { upstreamTransient?: boolean; modelUnavailable?: boolean }) | null = null;
  for (let i = 0; i < candidates.length; i += 1) {
    modelId = candidates[i]!;
    try {
      return await invokeWithSpecificModel({ ...args, modelId, startedAt });
    } catch (err) {
      const e = err as Error & { upstreamTransient?: boolean; modelUnavailable?: boolean };
      lastError = e;
      // Fall through to the next candidate on:
      //   - Transient upstream failures (429 / 5xx / network): the next model
      //     likely sits in a different capacity pool and may succeed.
      //   - 404 "model not available": the named model doesn't exist on this
      //     endpoint (e.g. deprecated or not released on v1beta). Try the next.
      // Other errors (auth, malformed prompt, content-policy, code bugs) are
      // NOT helped by retrying elsewhere — surface them immediately.
      const shouldFallThrough = e.upstreamTransient === true || e.modelUnavailable === true;
      if (!shouldFallThrough) throw e;
      if (i < candidates.length - 1) {
        console.warn(
          `[agent-sdk] model failed, falling back agent=${def.id as unknown as string} ` +
            `from=${candidates[i]} to=${candidates[i + 1]} reason=${e.modelUnavailable ? '404' : 'transient'} cause="${e.message.slice(0, 140)}"`,
        );
      }
    }
  }
  // All candidates exhausted — rethrow the last error so callers render the
  // appropriate banner (upstream_unavailable for transient, pipeline_error
  // for everything else).
  throw lastError ?? new Error('no_model_candidates_tried');
}

async function invokeWithSpecificModel(
  args: InvokeArgs & { modelId: string; startedAt: Date },
): Promise<InvokeResult> {
  const { def, invocation, persist, inlineAttachments = [], modelId, startedAt, requestTimeoutMs } = args;

  const genai = client();
  const model: GenerativeModel = genai.getGenerativeModel(
    {
      model: modelId,
      systemInstruction: {
        role: 'system',
        parts: [
          { text: def.systemPrompt },
          { text: `Locale for this invocation: ${invocation.locale}.` },
        ],
      },
      generationConfig: {
        temperature: def.temperature,
        maxOutputTokens: def.maxTokens,
        responseMimeType: outputIsStructured(def) ? 'application/json' : 'text/plain',
      },
    },
    {
      // Per-request wall-clock cap. Default 90s suits JSON-extractor-style
      // calls (~45s typical). Vision-heavy calls like policy-digitizer pass a
      // higher override via InvokeArgs.requestTimeoutMs because per-page
      // markdown transcription of a 50-page policy can decode for 2-4 min.
      timeout: requestTimeoutMs ?? 90 * 1000,
    },
  );

  const userParts = buildUserParts(invocation, inlineAttachments);
  const contents: Content[] = [{ role: 'user', parts: userParts }];

  let outcome: AgentRunOutcome = 'success';
  let finalOutput: unknown = null;
  let confidence: number | null = null;
  let promptTokens = 0;
  let completionTokens = 0;
  const cachedTokens = 0;

  // Captures any error so we can rethrow after persisting the agent_run
  // row. Transient errors (5xx / 429) and "model not available" (404) both
  // need to surface to `invokeAgent`'s model-fallback loop so the next
  // candidate can be tried. Without this rethrow, the loop only sees
  // silently-swallowed "refused" results and never falls through.
  let attemptFailure: (Error & { upstreamTransient?: boolean; modelUnavailable?: boolean }) | null = null;

  try {
    // Retry transient upstream failures — Gemini throws 429 (rate-limited),
    // 500/502/503/504 (overloaded), and connection resets fairly regularly
    // during spikes. Exponential backoff keeps retries bounded; we also tag
    // the thrown error so pipeline can tell "Gemini was down" from "model
    // returned gibberish" and show the right user-facing message.
    const resp = await generateWithRetry(
      () => model.generateContent({ contents }),
      def.id as unknown as string,
    );
    const usage = resp.response.usageMetadata;
    promptTokens = usage?.promptTokenCount ?? 0;
    completionTokens = usage?.candidatesTokenCount ?? 0;

    // Surface truncation explicitly. When Gemini hits maxOutputTokens the
    // finishReason is "MAX_TOKENS" and the partial text is NOT valid JSON —
    // parseOutput falls back to {raw: "..."} and the pipeline's schema
    // validator later rejects it with a confusing error. Logging this makes
    // "why did the extractor fail?" a 5-second answer instead of 20 minutes
    // of spelunking through the eval logs.
    const finishReason =
      (resp.response.candidates?.[0] as { finishReason?: string } | undefined)?.finishReason ?? null;
    if (finishReason === 'MAX_TOKENS') {
      console.warn(
        `[agent-sdk] response truncated at maxTokens agent=${def.id as unknown as string} ` +
          `completionTokens=${completionTokens} maxOutputTokens=${def.maxTokens} — ` +
          `bump agent_definition.max_tokens or split the task`,
      );
      outcome = 'low_confidence';
    }

    const text = resp.response.text();
    finalOutput = parseOutput(text);
    confidence = extractConfidence(finalOutput);
    if (confidence !== null && confidence < 0.5) outcome = 'low_confidence';
  } catch (err) {
    outcome = 'refused';
    const e = err as Error & { upstreamTransient?: boolean };
    const is404 = /\[404[\s,]|not found|is not available/i.test(e.message);
    finalOutput = {
      error: e.message,
      upstreamTransient: e.upstreamTransient === true,
      modelUnavailable: is404,
    };
    // Transient (429/5xx) and 404 "model not available" both need to
    // surface to the outer fallback loop so it can try the next candidate.
    // Everything else (auth, malformed prompt, content-policy) doesn't
    // benefit from retrying on another model — the pipeline should see
    // the refused result as-is.
    if (e.upstreamTransient || is404) {
      attemptFailure = Object.assign(e, { modelUnavailable: is404 });
    }
  }

  const endedAt = new Date();
  const costPaise = costPaiseFor(def.modelTier, {
    prompt: promptTokens,
    completion: completionTokens,
    cached: cachedTokens,
  });

  const runSource = args.runSource ?? 'customer_upload';
  const deployEnv = args.deployEnv ?? resolveDeployEnv();

  const runId = await persist({
    tenantId: invocation.tenantId as unknown as string,
    userId: (invocation.userId as unknown as string | null) ?? null,
    caseId: (invocation.caseId as unknown as string | null) ?? null,
    analysisId: invocation.analysisId ?? null,
    agentSlug: def.id as unknown as string,
    agentVersion: def.version,
    parentRunId: (invocation.parentRunId as unknown as string | null) ?? null,
    inputSummary: invocation.userMessage.slice(0, 500),
    attachedDocumentIds: invocation.attachments.map((a) => a.documentId as unknown as string),
    outputJson: finalOutput,
    confidence,
    outcome,
    modelUsed: modelId,
    promptTokens,
    completionTokens,
    cachedTokens,
    costPaise,
    latencyMs: endedAt.getTime() - startedAt.getTime(),
    userVisibleSummary: summarizeForUser(finalOutput),
    startedAt,
    endedAt,
    runSource,
    deployEnv,
  });

  // Per-LLM-call step row for the Eval Lab trace viewer. Best-effort —
  // never let a step-recording failure mutate the agent's outcome.
  // Prompt + completion are passed as redacted-already strings; consumers
  // that need PII scrubbing apply it BEFORE handing the user message in.
  if (args.recordStep) {
    void args
      .recordStep({
        agentRunId: runId,
        stepIndex: 0,
        kind: 'llm_call',
        modelId,
        toolName: null,
        inputTokens: promptTokens,
        outputTokens: completionTokens,
        cacheCreationInputTokens: null,
        cacheReadInputTokens: cachedTokens || null,
        costPaise,
        latencyMs: endedAt.getTime() - startedAt.getTime(),
        promptRedacted: invocation.userMessage.slice(0, 50_000),
        completionRedacted: typeof finalOutput === 'string'
          ? finalOutput.slice(0, 50_000)
          : JSON.stringify(finalOutput).slice(0, 50_000),
        toolArgsJson: null,
        toolResultJson: null,
        errorMessage: attemptFailure?.message ?? null,
        startedAt,
        endedAt,
        runSource,
        deployEnv,
      })
      .catch((err) => {
        console.warn(
          `[agent-sdk] recordStep failed run=${runId} agent=${def.id as unknown as string} err=${(err as Error).message.slice(0, 200)}`,
        );
      });
  }

  // Rethrow any fallback-worthy error AFTER persisting the failed run so the
  // outer model-fallback loop in `invokeAgent` can try the next candidate
  // and the agent_run audit row captures every attempt.
  if (attemptFailure) {
    throw attemptFailure;
  }

  return {
    runId,
    outputJson: finalOutput,
    outcome,
    confidence,
    needsReview: def.reviewRequired && outcome !== 'refused',
    costPaise,
  };
}

function outputIsStructured(def: AgentDefinition): boolean {
  return /strict JSON|JSON object|json output|Output JSON/i.test(def.systemPrompt);
}

function buildUserParts(inv: AgentInvocation, inline: InlineAttachment[]): Part[] {
  const parts: Part[] = [{ text: inv.userMessage }];

  for (const a of inv.attachments) {
    if (a.ocrText) {
      parts.push({
        text: `\n\nAttached document (kind: ${a.kind}, id: ${a.documentId}) OCR:\n${a.ocrText}`,
      });
    }
  }

  for (const att of inline) {
    const base64 =
      typeof att.data === 'string' ? att.data : Buffer.from(att.data).toString('base64');
    parts.push({
      inlineData: {
        mimeType: att.mime,
        data: base64,
      },
    });
  }

  if (inv.extraContext && Object.keys(inv.extraContext).length > 0) {
    parts.push({
      text: `\n\nExtra context:\n${JSON.stringify(inv.extraContext, null, 2)}`,
    });
  }
  return parts;
}

function parseOutput(text: string): unknown {
  // Strategy 1 — parse the raw string as-is. The happy path when the model
  // respects responseMimeType=application/json (Sonnet/Opus tiers).
  try {
    return JSON.parse(text);
  } catch {
    /* fall through */
  }

  // Strategy 2 — strip a single surrounding ```json fence. Some model versions
  // ignore the mime-type hint and emit code-fenced JSON instead.
  const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
  try {
    return JSON.parse(unfenced);
  } catch {
    /* fall through */
  }

  // Strategy 3 — extract the largest balanced {...} substring and parse that.
  // Haiku-tier models (gemini-2.0-flash-lite) sometimes add a preamble like
  // "Here's my classification:" before the actual JSON; the strict fallback
  // loses the output entirely, this recovers it. Walks once, tracking depth.
  const firstBrace = text.indexOf('{');
  if (firstBrace !== -1) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = firstBrace; i < text.length; i += 1) {
      const ch = text[i];
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === '\\') {
        escape = true;
        continue;
      }
      if (ch === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;
      if (ch === '{') depth += 1;
      else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          const candidate = text.slice(firstBrace, i + 1);
          try {
            return JSON.parse(candidate);
          } catch {
            break;
          }
        }
      }
    }
  }

  // Give up — surface the raw text so the caller can log/diagnose.
  return { raw: text };
}

function extractConfidence(obj: unknown): number | null {
  if (
    obj &&
    typeof obj === 'object' &&
    'confidence' in obj &&
    typeof (obj as { confidence: unknown }).confidence === 'number'
  ) {
    return (obj as { confidence: number }).confidence;
  }
  return null;
}

function summarizeForUser(obj: unknown): string | null {
  if (obj && typeof obj === 'object' && 'user_visible_summary' in obj) {
    return String((obj as { user_visible_summary: unknown }).user_visible_summary);
  }
  return null;
}

export type { ModelTier };

/**
 * Retry wrapper for a single Gemini generateContent call.
 *
 * Retries on these transient conditions:
 *   - HTTP 429  — rate limited
 *   - HTTP 5xx  — provider overload / outage
 *   - connection reset / fetch failed
 *
 * Does NOT retry on 4xx (other than 429) — those indicate caller bugs
 * (malformed request, bad auth, content blocked) and repeating won't help.
 *
 * Exponential backoff with jitter: 800ms → 2.0s → 5.0s + up to 500ms jitter.
 * Three retries after the initial call (4 attempts total), max ~8s added
 * latency in the worst case. We tag the final thrown error with
 * `upstreamTransient=true` so the pipeline can distinguish "Gemini was down"
 * from other failures and render a retry-able banner instead of a generic
 * "classifier returned junk" message.
 */
function isTimeoutAbort(err: Error): boolean {
  // Our own per-request timeout (or the user navigating away) surfaces as
  // an AbortError. Distinct from a transient network error: there's no
  // reason to retry the SAME model — it just won't fit in the wall-clock
  // budget the second time either. Let the outer model-fallback loop try
  // the next candidate; don't burn minutes inside the per-model retry.
  const m = err.message.toLowerCase();
  return m.includes('operation was aborted') || m.includes('aborterror');
}

async function generateWithRetry<T>(
  call: () => Promise<T>,
  agentId: string,
): Promise<T> {
  // Retry budget per model. Kept intentionally tight (~28s of delays across
  // 4 retries) so that when the primary model is persistently overloaded
  // we fall through to the next candidate quickly instead of making the
  // user wait 7 minutes for a red banner.
  //
  // Worst-case error-surface time: 28s × 3 candidate models ≈ 90s of delay
  // plus the individual request response-time — still inside the window the
  // user already spends staring at the progress spinner.
  const delaysMs = [1000, 3000, 8000, 15000];
  let lastErr: Error & { upstreamTransient?: boolean } = new Error('no_attempt_made');
  for (let attempt = 0; attempt <= delaysMs.length; attempt += 1) {
    try {
      return await call();
    } catch (err) {
      const e = err as Error;
      const transient = isTransientUpstreamError(e);
      const timeoutAbort = isTimeoutAbort(e);
      lastErr = Object.assign(e, { upstreamTransient: transient });
      // Non-transient errors fail fast. Timeout aborts are still tagged
      // transient (so invokeAgent's model-fallback loop tries the next
      // candidate), but we DON'T retry them on the SAME model — that just
      // wastes another full timeout window. End the loop instead.
      if (!transient || timeoutAbort || attempt === delaysMs.length) break;
      const jitter = Math.floor(Math.random() * 500);
      const wait = delaysMs[attempt]! + jitter;
      console.warn(
        `[agent-sdk] upstream transient error agent=${agentId} attempt=${attempt + 1}/${delaysMs.length + 1} ` +
          `waitMs=${wait} cause="${e.message.slice(0, 140)}"`,
      );
      await sleep(wait);
    }
  }
  throw lastErr;
}

function isTransientUpstreamError(err: Error): boolean {
  const m = err.message.toLowerCase();
  if (/\[(429|500|502|503|504)\s/.test(err.message)) return true;
  if (m.includes('service unavailable') || m.includes('overloaded')) return true;
  if (m.includes('too many requests') || m.includes('resource exhausted')) return true;
  if (m.includes('econnreset') || m.includes('fetch failed') || m.includes('etimedout')) return true;
  // Per-request timeout firing surfaces as "operation was aborted" / "AbortError".
  // Treat as transient so the SDK's model-fallback loop and the pipeline's
  // upstream-error mapper kick in instead of falling through to a generic
  // "no usable output" error that hides the real cause from the user.
  if (m.includes('operation was aborted') || m.includes('aborterror')) return true;
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Resolve deploy env for runSource bookkeeping. APP_ENV / NEXT_PUBLIC_APP_ENV
 *  win, then VERCEL_ENV ('production' | 'preview' | 'development'),
 *  finally NODE_ENV. Defaults to 'prod' so we never accidentally label a
 *  production run 'local'. */
function resolveDeployEnv(): 'prod' | 'uat' | 'local' {
  const env = (process.env.APP_ENV ?? process.env.NEXT_PUBLIC_APP_ENV ?? '').toLowerCase();
  if (env === 'prod' || env === 'production') return 'prod';
  if (env === 'uat' || env === 'staging') return 'uat';
  if (env === 'local' || env === 'development') return 'local';
  const vercel = (process.env.VERCEL_ENV ?? '').toLowerCase();
  if (vercel === 'production') return 'prod';
  if (vercel === 'preview') return 'uat';
  if (vercel === 'development') return 'local';
  if (process.env.NODE_ENV === 'development') return 'local';
  return 'prod';
}
