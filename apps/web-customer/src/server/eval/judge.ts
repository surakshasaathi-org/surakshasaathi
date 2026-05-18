import 'server-only';
import { randomUUID } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import { invokeAgent } from '@suraksha/agent-sdk';
import type { AgentDefinition, AgentInvocation } from '@suraksha/types';
import { makePersistRun } from '@/server/analyse/agent-runs';
import { redactForModelContext } from '@/server/safety/redact';

/**
 * LLM-as-judge evaluator.
 *
 *   runJudge({ agentRunId, trigger, goldenCaseId? })
 *
 * Loads the default rubric for the agent, invokes the judge model with the
 * rubric's prompt + the subject run's (input, output) + optional golden case,
 * persists an eval_run row with the judge's score breakdown.
 *
 * Judge output is validated against rubric.output_schema (shape-only; we don't
 * run a full JSON-Schema validator here — structural + type checks are enough
 * to catch catastrophic output drift).
 */

export interface RunJudgeArgs {
  agentRunId: string;
  trigger: 'nightly_cron' | 'manual' | 'prod_sample';
  /** When triggered from a golden-case run, binds the eval to the source case. */
  goldenCaseId?: string;
  /** Optional override for the human / system that kicked off the judge. */
  ranBy?: string;
}

export interface RunJudgeResult {
  evalRunId: string;
  qualityScore: number | null;
  passed: boolean | null;
  costPaise: number;
}

export async function runJudge(args: RunJudgeArgs): Promise<RunJudgeResult> {
  const db = serviceDb();

  const [subject] = await db
    .select()
    .from(schema.agentRun)
    .where(eq(schema.agentRun.id, args.agentRunId))
    .limit(1);
  if (!subject) throw new Error(`agent_run not found: ${args.agentRunId}`);

  const [rubric] = await db
    .select()
    .from(schema.evalRubric)
    .where(
      and(eq(schema.evalRubric.agentSlug, subject.agentSlug), eq(schema.evalRubric.isDefault, true)),
    )
    .orderBy(desc(schema.evalRubric.version))
    .limit(1);
  if (!rubric) throw new Error(`no default rubric for agent: ${subject.agentSlug}`);

  let golden: typeof schema.evalGoldenCase.$inferSelect | null = null;
  if (args.goldenCaseId) {
    const [g] = await db
      .select()
      .from(schema.evalGoldenCase)
      .where(eq(schema.evalGoldenCase.id, args.goldenCaseId))
      .limit(1);
    golden = g ?? null;
  }

  // Construct a synthetic "judge agent" definition on the fly, so we reuse
  // invokeAgent's persistence path. The judge doesn't live in agent_definition —
  // its prompt is the rubric's judge_prompt.
  const judgeDef: AgentDefinition = {
    id: `judge-${subject.agentSlug}` as never,
    version: rubric.version,
    displayName: `Judge for ${subject.agentSlug}`,
    purpose: 'LLM-as-judge eval',
    modelTier: rubric.judgeModelTier as 'opus' | 'sonnet' | 'haiku',
    systemPrompt: rubric.judgePrompt,
    tools: [],
    temperature: 0.1,
    maxTokens: 3072,
    reviewRequired: false,
    enabled: true,
    isDefault: true,
    localesSupported: ['en'] as ('en' | 'hi' | 'kn')[],
    createdAt: new Date().toISOString(),
  };

  // PII-scrub both the subject output and golden case before handing them
  // to the judge model. Judge doesn't need nominee_name or policy_number to
  // score grounding quality.
  const userPayload: Record<string, unknown> = redactForModelContext({
    subject_agent: {
      slug: subject.agentSlug,
      version: subject.agentVersion,
      input_summary: subject.inputSummary,
      output: subject.outputJson,
    },
    golden_case: golden
      ? {
          name: golden.name,
          description: golden.description,
          expected_extraction: golden.expectedExtraction,
          expected_coverage: golden.expectedCoverage,
          expected_chat_qa: golden.expectedChatQa,
        }
      : null,
  });

  const invocation: AgentInvocation = {
    agentId: judgeDef.id,
    tenantId: subject.tenantId as never,
    userId: null,
    caseId: null,
    parentRunId: subject.id as never,
    userMessage: `Evaluate the following agent output. Respond with ONLY the JSON object conforming to the rubric's output schema.\n\n${JSON.stringify(userPayload)}`,
    attachments: [],
    locale: 'en',
    extraContext: { trigger: args.trigger },
  };

  const judgeResult = await invokeAgent({
    def: judgeDef,
    invocation,
    persist: makePersistRun(),
  });

  const parsed = normaliseJudgeOutput(judgeResult.outputJson);

  const [evalRow] = await db
    .insert(schema.evalRun)
    .values({
      id: randomUUID(),
      tenantId: subject.tenantId,
      trigger: args.trigger,
      goldenCaseId: args.goldenCaseId ?? null,
      analysisId: null,
      agentSlug: subject.agentSlug,
      agentVersion: subject.agentVersion,
      agentRunId: subject.id,
      rubricId: rubric.id,
      judgeScoreJson: parsed.judge,
      qualityScore: parsed.qualityScore,
      passed: parsed.passed,
      costPaise: judgeResult.costPaise,
      latencyMs: null,
      errorMessage: parsed.errorMessage,
      ranBy: args.ranBy ?? 'system',
    })
    .returning({ id: schema.evalRun.id });

  return {
    evalRunId: evalRow!.id,
    qualityScore: parsed.qualityScore,
    passed: parsed.passed,
    costPaise: judgeResult.costPaise,
  };
}

/**
 * Best-effort normalisation of the judge's output into the eval_run columns.
 * Tolerates: missing fields, wrong types, "raw" fallback from parseOutput.
 */
function normaliseJudgeOutput(raw: unknown): {
  qualityScore: number | null;
  passed: boolean | null;
  judge: Record<string, unknown>;
  errorMessage: string | null;
} {
  if (!raw || typeof raw !== 'object') {
    return { qualityScore: null, passed: null, judge: { raw }, errorMessage: 'judge_output_not_object' };
  }
  const o = raw as Record<string, unknown>;
  if ('raw' in o && Object.keys(o).length === 1) {
    return { qualityScore: null, passed: null, judge: o, errorMessage: 'judge_output_unparseable' };
  }
  const qs = typeof o.quality_score === 'number' ? Math.max(0, Math.min(100, Math.round(o.quality_score))) : null;
  const passed = typeof o.passed === 'boolean' ? o.passed : null;
  return { qualityScore: qs, passed, judge: o, errorMessage: null };
}
