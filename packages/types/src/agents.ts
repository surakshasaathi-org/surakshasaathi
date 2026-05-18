import { z } from 'zod';
import { AgentDefinitionId, AgentRunId, CaseId, DocumentId, TenantId, UserId } from './ids';
import { AgentRunOutcome, Locale, ModelTier } from './enums';

/**
 * Agent definition = row in `agent_definition`. Versioned.
 * Promoting a new version: insert a new row with the next version and flip `isDefault`.
 */
export const AgentDefinition = z.object({
  id: AgentDefinitionId,            // slug, e.g. "rejection-classifier"
  version: z.number().int(),
  displayName: z.string(),
  purpose: z.string(),
  modelTier: ModelTier,
  systemPrompt: z.string(),
  tools: z.array(z.string()),       // tool slugs registered in the agent registry
  temperature: z.number().min(0).max(1).default(0.2),
  maxTokens: z.number().int().positive().default(4096),
  reviewRequired: z.boolean(),      // if true, outputs gated through human review
  enabled: z.boolean(),
  isDefault: z.boolean(),           // only one version per slug can be default
  localesSupported: z.array(Locale),
  createdAt: z.string().datetime(),
});
export type AgentDefinition = z.infer<typeof AgentDefinition>;

export const AgentRun = z.object({
  id: AgentRunId,
  tenantId: TenantId,
  userId: UserId.nullable(),        // null for system-triggered runs
  agentDefinitionId: AgentDefinitionId,
  agentVersion: z.number().int(),
  parentRunId: AgentRunId.nullable(),
  caseId: CaseId.nullable(),
  inputSummary: z.string(),
  attachedDocumentIds: z.array(DocumentId),
  outputJson: z.unknown(),
  confidence: z.number().min(0).max(1).nullable(),
  outcome: AgentRunOutcome,
  modelUsed: z.string(),
  promptTokens: z.number().int(),
  completionTokens: z.number().int(),
  cachedTokens: z.number().int(),
  costPaise: z.number().int(),      // paise, not rupees. Integer avoids float drift.
  latencyMs: z.number().int(),
  userVisibleSummary: z.string().nullable(),
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
});
export type AgentRun = z.infer<typeof AgentRun>;

/**
 * Input an agent receives. Agents SHOULD NOT see raw secrets — the SDK strips
 * payment tokens, Aadhaar numbers, and service keys before handoff.
 */
export const AgentInvocation = z.object({
  agentId: AgentDefinitionId,
  tenantId: TenantId,
  userId: UserId.nullable(),
  caseId: CaseId.nullable(),
  /** policy_analysis.id when the run originates from the analyse flow.
   *  Persisted as agent_run.analysis_id so the admin UI can list every
   *  agent_run that contributed to a given analysis (intake → extract →
   *  coverage → refine → chat → coverage-check). Null for cases-only runs.
   *  Optional in the type so existing eval/scoring callsites that have no
   *  analysis context don't have to declare it. */
  analysisId: z.string().uuid().nullable().optional(),
  parentRunId: AgentRunId.nullable(),
  userMessage: z.string(),
  attachments: z.array(z.object({
    documentId: DocumentId,
    kind: z.string(),
    ocrText: z.string().nullable(),
  })).default([]),
  locale: Locale.default('en'),
  extraContext: z.record(z.unknown()).default({}),
});
export type AgentInvocation = z.infer<typeof AgentInvocation>;
