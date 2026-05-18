'use server';

import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { invokeAgent, type PersistRunFn } from '@suraksha/agent-sdk';
import { serviceDb, schema } from '@suraksha/db';
import { requireAdminSession } from '@/lib/admin/auth';
import { syntheticPdfFromText } from './synthetic-pdf';

const STORAGE_ROOT = '/tmp/suraksha-uploads';

/**
 * Resolve the on-disk file path for a stored object. Mirrors the customer
 * helper at apps/web-customer/src/server/analyse/storage.ts — the `dev-local/`
 * prefix lives on the storage_path so prod (Supabase Storage) can route by
 * bucket; local dev strips it and writes flat under STORAGE_ROOT.
 */
function fsPathFor(storagePath: string): string {
  return `${STORAGE_ROOT}/${storagePath.replace(/^dev-local\//, '')}`;
}

/**
 * Resolve the attached PDF/image for a golden case.
 *
 * Rules:
 *   1. If `policyDocumentId` is set AND the file is on disk → use it.
 *      The eval exercises the exact same input the operator attached.
 *   2. If `policyDocumentId` is set but the policy_document row is gone
 *      OR the file is missing on disk → SELF-HEAL: clear the dangling link
 *      on the case row and fall back to the synthetic PDF. This way a stale
 *      link (e.g. from an expired customer-side upload) doesn't permanently
 *      break the case.
 *   3. If no link is set → synthesise a PDF from
 *      `expectedExtraction.synthetic_first_pages_text`.
 */
async function resolveAttachment(
  goldenCase: typeof schema.evalGoldenCase.$inferSelect,
): Promise<{ mime: string; data: Buffer; source: 'uploaded_fixture' | 'synthetic_pdf' } | null> {
  const db = serviceDb();
  if (goldenCase.policyDocumentId) {
    const [doc] = await db
      .select({
        mime: schema.policyDocument.mime,
        storagePath: schema.policyDocument.storagePath,
      })
      .from(schema.policyDocument)
      .where(eq(schema.policyDocument.id, goldenCase.policyDocumentId))
      .limit(1);
    if (doc) {
      try {
        const buf = await readFile(fsPathFor(doc.storagePath));
        return { mime: doc.mime, data: buf, source: 'uploaded_fixture' };
      } catch (err) {
        const e = err as NodeJS.ErrnoException;
        if (e.code !== 'ENOENT') throw err;
        // File missing — self-heal below.
      }
    }
    // Either policy_document row is gone or file is missing. Clear the link
    // so future runs don't keep retrying the dead reference.
    console.warn(
      `[eval] self-healing dangling attachment on case ${goldenCase.id} ` +
        `(policy_document_id=${goldenCase.policyDocumentId} → cleared)`,
    );
    await db
      .update(schema.evalGoldenCase)
      .set({ policyDocumentId: null, updatedAt: new Date() })
      .where(eq(schema.evalGoldenCase.id, goldenCase.id));
  }
  const extr = (goldenCase.expectedExtraction ?? {}) as Record<string, unknown>;
  const text =
    typeof extr.synthetic_first_pages_text === 'string'
      ? (extr.synthetic_first_pages_text as string)
      : '';
  if (!text) return null;
  return {
    mime: 'application/pdf',
    data: syntheticPdfFromText(text),
    source: 'synthetic_pdf',
  };
}

/**
 * Map a Drizzle agent_definition row → the zod AgentDefinition shape that
 * @suraksha/agent-sdk expects. Critical: SDK uses `id` (the slug) — passing
 * the raw row would surface as `undefined` inside the SDK and break runs.
 */
function mapAgentDef(r: typeof schema.agentDefinition.$inferSelect) {
  return {
    id: r.slug as never,
    version: r.version,
    displayName: r.displayName,
    purpose: r.purpose,
    modelTier: r.modelTier as 'opus' | 'sonnet' | 'haiku',
    systemPrompt: r.systemPrompt,
    tools: r.tools,
    temperature: r.temperature,
    maxTokens: r.maxTokens,
    reviewRequired: r.reviewRequired,
    enabled: r.enabled,
    isDefault: r.isDefault,
    localesSupported: r.localesSupported as Array<'en' | 'hi' | 'kn'>,
    createdAt: r.createdAt.toISOString(),
  } as never;
}

/**
 * Persistence adapter — writes a real agent_run row so admin-triggered eval
 * runs land in the same audit table as production runs. The closure captures
 * the assigned runId so the caller can link it onto eval_run.agentRunId.
 */
function makePersistRun(captureId?: { runId: string | null }): PersistRunFn {
  return async (row) => {
    const db = serviceDb();
    const id = randomUUID();
    await db.insert(schema.agentRun).values({
      id,
      tenantId: row.tenantId,
      userId: row.userId,
      caseId: row.caseId,
      agentSlug: row.agentSlug,
      agentVersion: row.agentVersion,
      parentRunId: row.parentRunId,
      inputSummary: row.inputSummary,
      attachedDocumentIds: row.attachedDocumentIds,
      outputJson: row.outputJson,
      confidence: row.confidence,
      outcome: row.outcome,
      modelUsed: row.modelUsed,
      promptTokens: row.promptTokens,
      completionTokens: row.completionTokens,
      cachedTokens: row.cachedTokens,
      costPaise: row.costPaise,
      latencyMs: row.latencyMs,
      userVisibleSummary: row.userVisibleSummary,
      startedAt: row.startedAt,
      endedAt: row.endedAt,
    });
    if (captureId) captureId.runId = id;
    return id;
  };
}

/**
 * Manual eval orchestration. Triggered from the admin golden-cases page —
 * one eval_run row per (agentSlug, caseId, rubric) tuple.
 *
 * Each run:
 *   1. Build a user-message payload from the case's expected* JSON
 *   2. Invoke the agent under test
 *   3. Invoke the judge LLM with the rubric + agent input + agent output
 *      + the case's expected output (when present)
 *   4. Parse the judge's JSON, extract quality_score + passed
 *   5. Persist eval_run with trigger='manual'
 *
 * Per-agent input building lives in PER_AGENT_RUNNERS — agents not listed
 * record an eval_run with a stub error so ops can see the framework but
 * know the runner isn't wired yet for that agent.
 */

export interface EvalRunOutcome {
  caseId: string;
  caseName: string;
  ok: boolean;
  passed: boolean | null;
  qualityScore: number | null;
  errorMessage: string | null;
  runId: string | null;
  /** Raw judge LLM output JSON — surfaced in the UI for inspection. */
  judgeOutput: unknown;
  /** Raw agent-under-test output JSON — surfaced in the UI for inspection. */
  agentOutput: unknown;
}

export interface RunEvalsResult {
  total: number;
  succeeded: number;
  failed: number;
  outcomes: EvalRunOutcome[];
}

const TENANT_ID = '00000000-0000-0000-0000-000000000001';

export async function runEvalsForAgent(args: {
  agentSlug: string;
  caseIds?: string[]; // omitted = run all enabled cases tagged for this agent
  /** Specific agent_definition.version to evaluate. Omit = current default. */
  agentVersion?: number;
}): Promise<RunEvalsResult> {
  const session = await requireAdminSession(['super_admin', 'admin', 'content_editor']);
  const db = serviceDb();

  const cases = await db
    .select()
    .from(schema.evalGoldenCase)
    .where(
      args.caseIds && args.caseIds.length > 0
        ? inArray(schema.evalGoldenCase.id, args.caseIds)
        : and(
            eq(schema.evalGoldenCase.enabled, true),
            sql`${args.agentSlug} = ANY (${schema.evalGoldenCase.tags})`,
          ),
    );

  if (cases.length === 0) {
    return { total: 0, succeeded: 0, failed: 0, outcomes: [] };
  }

  const [agentDef] = await db
    .select()
    .from(schema.agentDefinition)
    .where(
      and(
        eq(schema.agentDefinition.slug, args.agentSlug),
        args.agentVersion !== undefined
          ? eq(schema.agentDefinition.version, args.agentVersion)
          : eq(schema.agentDefinition.isDefault, true),
      ),
    )
    .limit(1);

  const [rubric] = await db
    .select()
    .from(schema.evalRubric)
    .where(
      and(
        eq(schema.evalRubric.agentSlug, args.agentSlug),
        eq(schema.evalRubric.isDefault, true),
      ),
    )
    .limit(1);

  const outcomes: EvalRunOutcome[] = [];
  for (const c of cases) {
    const out = await runOne({
      agentSlug: args.agentSlug,
      agentDef,
      rubric,
      goldenCase: c,
      ranBy: session.email ?? 'admin',
    });
    outcomes.push(out);
  }

  revalidatePath(`/agents/${args.agentSlug}/golden-cases`);
  revalidatePath(`/products/[slug]`, 'page');
  revalidatePath('/evals');

  const succeeded = outcomes.filter((o) => o.ok).length;
  return {
    total: outcomes.length,
    succeeded,
    failed: outcomes.length - succeeded,
    outcomes,
  };
}

async function runOne(args: {
  agentSlug: string;
  agentDef: typeof schema.agentDefinition.$inferSelect | undefined;
  rubric: typeof schema.evalRubric.$inferSelect | undefined;
  goldenCase: typeof schema.evalGoldenCase.$inferSelect;
  ranBy: string;
}): Promise<EvalRunOutcome> {
  const db = serviceDb();
  const startedAt = Date.now();

  // Pre-flight checks — record an eval_run with a clear error so ops still
  // see the row in /evals and the per-case last-run badge updates.
  if (!args.agentDef) {
    return await persistFailure({
      agentSlug: args.agentSlug,
      agentVersion: 0,
      caseId: args.goldenCase.id,
      caseName: args.goldenCase.name,
      rubricId: args.rubric?.id ?? null,
      ranBy: args.ranBy,
      latencyMs: Date.now() - startedAt,
      errorMessage: `No default agent_definition row for slug "${args.agentSlug}".`,
    });
  }
  if (!args.rubric) {
    return await persistFailure({
      agentSlug: args.agentSlug,
      agentVersion: args.agentDef.version,
      caseId: args.goldenCase.id,
      caseName: args.goldenCase.name,
      rubricId: null,
      ranBy: args.ranBy,
      latencyMs: Date.now() - startedAt,
      errorMessage: `No default eval_rubric row for slug "${args.agentSlug}".`,
    });
  }

  // GOOGLE_API_KEY (or ANTHROPIC_API_KEY) is loaded from apps/web-admin/.env.local
  // by Next.js automatically. We don't pre-check here — if the key is missing or
  // invalid the SDK throws a precise upstream error which we surface verbatim.

  const runner = PER_AGENT_RUNNERS[args.agentSlug];
  if (!runner) {
    return await persistFailure({
      agentSlug: args.agentSlug,
      agentVersion: args.agentDef.version,
      caseId: args.goldenCase.id,
      caseName: args.goldenCase.name,
      rubricId: args.rubric.id,
      ranBy: args.ranBy,
      latencyMs: Date.now() - startedAt,
      errorMessage: `No eval runner registered for agent "${args.agentSlug}". Add one in apps/web-admin/src/server/evals/run-actions.ts.`,
    });
  }

  let agentOutput: unknown = null;
  let totalCostPaise = 0;
  const agentCapture = { runId: null as string | null };
  const judgeCapture = { runId: null as string | null };
  try {
    const agentRun = await runner.runAgent({
      agentDef: args.agentDef,
      goldenCase: args.goldenCase,
      captureId: agentCapture,
    });
    agentOutput = agentRun.outputJson;
    totalCostPaise += agentRun.costPaise;
  } catch (err) {
    return await persistFailure({
      agentSlug: args.agentSlug,
      agentVersion: args.agentDef.version,
      caseId: args.goldenCase.id,
      caseName: args.goldenCase.name,
      rubricId: args.rubric.id,
      ranBy: args.ranBy,
      latencyMs: Date.now() - startedAt,
      errorMessage: `agent call failed: ${(err as Error).message}`,
    });
  }

  // Run the judge: synthesise a virtual judge agent_definition from the rubric,
  // matching the AgentDefinition zod shape (id is the slug, not "slug").
  let judgeOutput: unknown = null;
  try {
    const judgeUserMessage = JSON.stringify(
      {
        agent_input: runner.snapshotInput(args.goldenCase),
        agent_output: agentOutput,
        golden_expected: pickExpected(args.goldenCase),
      },
      null,
      0,
    );
    const judgeDef = {
      id: `${args.agentSlug}-judge` as never,
      version: args.rubric.version,
      displayName: `${args.agentSlug} judge`,
      purpose: 'eval judge',
      modelTier: args.rubric.judgeModelTier as 'opus' | 'sonnet' | 'haiku',
      systemPrompt: args.rubric.judgePrompt,
      tools: [],
      temperature: 0.0,
      maxTokens: 2048,
      reviewRequired: false,
      enabled: true,
      isDefault: true,
      localesSupported: ['en'] as Array<'en' | 'hi' | 'kn'>,
      createdAt: new Date().toISOString(),
    } as never;

    const judgeRun = await invokeAgent({
      def: judgeDef,
      invocation: {
        agentId: `${args.agentSlug}-judge` as never,
        tenantId: TENANT_ID as never,
        userId: null,
        caseId: null,
        parentRunId: agentCapture.runId as never,
        userMessage: judgeUserMessage,
        attachments: [],
        locale: 'en',
        extraContext: { eval_run: true, golden_case_id: args.goldenCase.id },
      },
      persist: makePersistRun(judgeCapture),
      inlineAttachments: [],
    });
    judgeOutput = judgeRun.outputJson;
    totalCostPaise += judgeRun.costPaise;
  } catch (err) {
    return await persistFailure({
      agentSlug: args.agentSlug,
      agentVersion: args.agentDef.version,
      caseId: args.goldenCase.id,
      caseName: args.goldenCase.name,
      rubricId: args.rubric.id,
      ranBy: args.ranBy,
      latencyMs: Date.now() - startedAt,
      errorMessage: `judge call failed: ${(err as Error).message}`,
    });
  }

  const judgeParsed = parseJudgeOutput(judgeOutput);
  const [inserted] = await db
    .insert(schema.evalRun)
    .values({
      tenantId: TENANT_ID,
      trigger: 'manual',
      goldenCaseId: args.goldenCase.id,
      agentSlug: args.agentSlug,
      agentVersion: args.agentDef.version,
      agentRunId: agentCapture.runId,
      rubricId: args.rubric.id,
      judgeScoreJson: judgeOutput as never,
      qualityScore: judgeParsed.qualityScore,
      passed: judgeParsed.passed,
      costPaise: totalCostPaise,
      latencyMs: Date.now() - startedAt,
      ranBy: args.ranBy,
    })
    .returning({ id: schema.evalRun.id });

  return {
    caseId: args.goldenCase.id,
    caseName: args.goldenCase.name,
    ok: true,
    passed: judgeParsed.passed,
    qualityScore: judgeParsed.qualityScore,
    errorMessage: null,
    runId: inserted?.id ?? null,
    judgeOutput,
    agentOutput,
  };
}

async function persistFailure(args: {
  agentSlug: string;
  agentVersion: number;
  caseId: string;
  caseName: string;
  rubricId: string | null;
  ranBy: string;
  latencyMs: number;
  errorMessage: string;
}): Promise<EvalRunOutcome> {
  const db = serviceDb();
  const [inserted] = await db
    .insert(schema.evalRun)
    .values({
      tenantId: TENANT_ID,
      trigger: 'manual',
      goldenCaseId: args.caseId,
      agentSlug: args.agentSlug,
      agentVersion: args.agentVersion,
      rubricId: args.rubricId,
      qualityScore: null,
      passed: null,
      costPaise: 0,
      latencyMs: args.latencyMs,
      ranBy: args.ranBy,
      errorMessage: args.errorMessage,
    })
    .returning({ id: schema.evalRun.id });

  return {
    caseId: args.caseId,
    caseName: args.caseName,
    ok: false,
    passed: null,
    qualityScore: null,
    errorMessage: args.errorMessage,
    runId: inserted?.id ?? null,
    judgeOutput: null,
    agentOutput: null,
  };
}

function pickExpected(c: typeof schema.evalGoldenCase.$inferSelect): unknown {
  return {
    expectedExtraction: c.expectedExtraction,
    expectedCoverage: c.expectedCoverage,
    expectedChatQa: c.expectedChatQa,
    description: c.description,
  };
}

function parseJudgeOutput(raw: unknown): { qualityScore: number | null; passed: boolean | null } {
  if (typeof raw !== 'object' || raw === null) return { qualityScore: null, passed: null };
  const o = raw as Record<string, unknown>;
  const qs = typeof o.quality_score === 'number' ? Math.round(o.quality_score) : null;
  const passed = typeof o.passed === 'boolean' ? o.passed : null;
  return { qualityScore: qs, passed };
}

/* ─────────────── Per-agent runners ─────────────── */

interface AgentRunner {
  /** Build the agent's user-message payload from the golden case + invoke it. */
  runAgent(args: {
    agentDef: typeof schema.agentDefinition.$inferSelect;
    goldenCase: typeof schema.evalGoldenCase.$inferSelect;
    captureId: { runId: string | null };
  }): Promise<{ outputJson: unknown; costPaise: number }>;
  /** What the judge should see as "agent input" — usually the user message. */
  snapshotInput(goldenCase: typeof schema.evalGoldenCase.$inferSelect): unknown;
}

/**
 * Build a sample EnrichedExtractor from a golden case's expectedExtraction
 * payload. Coverage / scorer evals consume this — they don't see the PDF
 * directly. Caller can store either:
 *   - a full ready-to-use object under expectedExtraction.sample_extractor_output
 *   - a synthetic shape under expectedExtraction.expected_shape (less rich,
 *     used when only field-presence matters)
 */
function syntheticExtractorOutput(
  goldenCase: typeof schema.evalGoldenCase.$inferSelect,
): Record<string, unknown> | null {
  const extr = (goldenCase.expectedExtraction ?? {}) as Record<string, unknown>;
  if (extr.sample_extractor_output && typeof extr.sample_extractor_output === 'object') {
    return extr.sample_extractor_output as Record<string, unknown>;
  }
  return null;
}

const PER_AGENT_RUNNERS: Record<string, AgentRunner> = {
  'policy-intake-classifier': {
    runAgent: async ({ agentDef, goldenCase, captureId }) => {
      const attachment = await resolveAttachment(goldenCase);
      if (!attachment) {
        throw new Error(
          'no PDF attachment available — upload one via the case editor or set expectedExtraction.synthetic_first_pages_text',
        );
      }
      const result = await invokeAgent({
        def: mapAgentDef(agentDef),
        invocation: {
          agentId: agentDef.slug as never,
          tenantId: TENANT_ID as never,
          userId: null,
          caseId: null,
          parentRunId: null,
          userMessage:
            'Please classify the attached document per your system instructions. Output strict JSON.',
          attachments: [],
          locale: 'en',
          extraContext: {
            eval_run: true,
            golden_case_id: goldenCase.id,
            attachment_source: attachment.source,
          },
        },
        persist: makePersistRun(captureId),
        inlineAttachments: [{ mime: attachment.mime, data: attachment.data }],
      });
      return { outputJson: result.outputJson, costPaise: result.costPaise };
    },
    snapshotInput: (goldenCase) => {
      const extr = (goldenCase.expectedExtraction ?? {}) as Record<string, unknown>;
      return {
        attachment_source: goldenCase.policyDocumentId
          ? `uploaded_fixture · policy_document ${goldenCase.policyDocumentId}`
          : 'synthetic PDF generated from synthetic_first_pages_text',
        synthetic_first_pages_text: extr.synthetic_first_pages_text,
      };
    },
  },

  /**
   * policy-extractor — input is a PDF/image (uploaded fixture preferred,
   * synthetic fallback). Produces structured field extraction JSON.
   */
  'policy-extractor': {
    runAgent: async ({ agentDef, goldenCase, captureId }) => {
      const attachment = await resolveAttachment(goldenCase);
      if (!attachment) {
        throw new Error(
          'no PDF attachment available — upload one via the case editor or set expectedExtraction.synthetic_first_pages_text',
        );
      }
      const result = await invokeAgent({
        def: mapAgentDef(agentDef),
        invocation: {
          agentId: agentDef.slug as never,
          tenantId: TENANT_ID as never,
          userId: null,
          caseId: null,
          parentRunId: null,
          userMessage:
            'Extract the structured fields from the attached Indian health-insurance policy. Output strict JSON per your system schema.',
          attachments: [],
          locale: 'en',
          extraContext: {
            eval_run: true,
            golden_case_id: goldenCase.id,
            attachment_source: attachment.source,
          },
        },
        persist: makePersistRun(captureId),
        inlineAttachments: [{ mime: attachment.mime, data: attachment.data }],
      });
      return { outputJson: result.outputJson, costPaise: result.costPaise };
    },
    snapshotInput: (goldenCase) => ({
      attachment_source: goldenCase.policyDocumentId
        ? `uploaded_fixture · policy_document ${goldenCase.policyDocumentId}`
        : 'synthetic PDF',
    }),
  },

  /**
   * policy-coverage — input is a structured EnrichedExtractor JSON +
   * demographics. Eval expects sample_extractor_output on the golden case
   * (or coverage will get nothing to reason over).
   */
  'policy-coverage': {
    runAgent: async ({ agentDef, goldenCase, captureId }) => {
      const sample = syntheticExtractorOutput(goldenCase);
      if (!sample) {
        throw new Error(
          'policy-coverage runner needs expectedExtraction.sample_extractor_output (a synthetic EnrichedExtractor object). Add one to the case JSON.',
        );
      }
      const userMessage = JSON.stringify(
        {
          extractor: sample,
          demographics: goldenCase.demographicsJson ?? {},
          locale: 'en',
        },
        null,
        0,
      );
      const result = await invokeAgent({
        def: mapAgentDef(agentDef),
        invocation: {
          agentId: agentDef.slug as never,
          tenantId: TENANT_ID as never,
          userId: null,
          caseId: null,
          parentRunId: null,
          userMessage,
          attachments: [],
          locale: 'en',
          extraContext: { eval_run: true, golden_case_id: goldenCase.id },
        },
        persist: makePersistRun(captureId),
        inlineAttachments: [],
      });
      return { outputJson: result.outputJson, costPaise: result.costPaise };
    },
    snapshotInput: (goldenCase) => ({
      sample_extractor_output_keys: Object.keys(syntheticExtractorOutput(goldenCase) ?? {}),
      demographics: goldenCase.demographicsJson,
    }),
  },

  /**
   * policy-scorer — input is the same EnrichedExtractor + profile shape as
   * the production runtime path (see /server/scoring/llm.ts).
   */
  'policy-scorer': {
    runAgent: async ({ agentDef, goldenCase, captureId }) => {
      const sample = syntheticExtractorOutput(goldenCase);
      if (!sample) {
        throw new Error(
          'policy-scorer runner needs expectedExtraction.sample_extractor_output (a synthetic EnrichedExtractor object). Add one to the case JSON.',
        );
      }
      const profile = (goldenCase.demographicsJson as { cityTier?: string } | null) ?? {};
      const userMessage = JSON.stringify(
        {
          profile: { cityTier: profile.cityTier ?? null },
          extractor: sample,
        },
        null,
        0,
      );
      const result = await invokeAgent({
        def: mapAgentDef(agentDef),
        invocation: {
          agentId: agentDef.slug as never,
          tenantId: TENANT_ID as never,
          userId: null,
          caseId: null,
          parentRunId: null,
          userMessage,
          attachments: [],
          locale: 'en',
          extraContext: { eval_run: true, golden_case_id: goldenCase.id },
        },
        persist: makePersistRun(captureId),
        inlineAttachments: [],
      });
      return { outputJson: result.outputJson, costPaise: result.costPaise };
    },
    snapshotInput: (goldenCase) => ({
      profile: goldenCase.demographicsJson,
      sample_extractor_output_keys: Object.keys(syntheticExtractorOutput(goldenCase) ?? {}),
    }),
  },

  /**
   * customer-explainer — chat agent. Takes a single user question along with
   * coverage output context. Eval iterates each Q in expectedChatQa and runs
   * one invocation per Q; for the eval_run row we summarise across all Qs.
   *
   * For now the runner takes the FIRST question only (simplest cycle); a
   * fuller multi-Q runner is a fast-follow.
   */
  'customer-explainer': {
    runAgent: async ({ agentDef, goldenCase, captureId }) => {
      const qa = goldenCase.expectedChatQa as Array<{ question: string; expected_answer: string }> | null;
      if (!qa || qa.length === 0) {
        throw new Error(
          'customer-explainer runner needs expectedChatQa[].question. Add at least one Q&A pair.',
        );
      }
      const sample = syntheticExtractorOutput(goldenCase);
      const firstQ = qa[0]!.question;
      const userMessage = JSON.stringify(
        {
          context: sample
            ? { extractor: sample, coverage_summary: 'see context' }
            : { extractor: null, coverage_summary: null },
          locale: 'en',
          user_question: firstQ,
        },
        null,
        0,
      );
      const result = await invokeAgent({
        def: mapAgentDef(agentDef),
        invocation: {
          agentId: agentDef.slug as never,
          tenantId: TENANT_ID as never,
          userId: null,
          caseId: null,
          parentRunId: null,
          userMessage,
          attachments: [],
          locale: 'en',
          extraContext: {
            eval_run: true,
            golden_case_id: goldenCase.id,
            qa_index: 0,
            qa_total: qa.length,
          },
        },
        persist: makePersistRun(captureId),
        inlineAttachments: [],
      });
      return { outputJson: result.outputJson, costPaise: result.costPaise };
    },
    snapshotInput: (goldenCase) => {
      const qa = goldenCase.expectedChatQa as Array<{ question: string }> | null;
      return {
        question: qa?.[0]?.question ?? null,
        total_questions: qa?.length ?? 0,
      };
    },
  },
};
