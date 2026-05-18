'use server';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, max } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { serviceDb, schema } from '@suraksha/db';
import { requireAdminSession } from '@/lib/auth';
import { resolveActiveModel } from '@/lib/active-model';

/**
 * Admin prompt editor server actions.
 *
 *   - listAgents()                      — one row per slug (latest version)
 *   - getAgent(slug)                    — full version history + current default
 *   - previewPromptAgainstGoldenSet     — runs the draft prompt against N
 *                                         enabled golden cases, returns diffs
 *                                         (no DB writes)
 *   - promoteNewAgentVersion            — creates a new agent_definition row
 *                                         with the edited prompt, sets it to
 *                                         is_default=true, demotes the old one
 *
 * Deliberately kept version-safe: we never overwrite an existing default
 * row. Every prompt change mints a new version; old versions stay around
 * for historical agent_run correlation.
 */

export interface AgentListRow {
  slug: string;
  latestVersion: number;
  defaultVersion: number | null;
  displayName: string;
  purpose: string;
  modelTier: string;
  /** Resolved active model id (override or tier-default) for display. */
  activeModel: string;
  provider: string | null;
  enabled: boolean;
  maxTokens: number;
  temperature: number;
  versionCount: number;
  updatedAt: string;
}

export async function listAgents(): Promise<AgentListRow[]> {
  const db = serviceDb();
  // Pull every row; small table (<50 rows).
  const rows = await db.select().from(schema.agentDefinition);
  const bySlug = new Map<string, typeof rows>();
  for (const r of rows) {
    const list = bySlug.get(r.slug) ?? [];
    list.push(r);
    bySlug.set(r.slug, list);
  }
  const result: AgentListRow[] = [];
  for (const [slug, versions] of bySlug) {
    versions.sort((a, b) => b.version - a.version);
    const latest = versions[0]!;
    const def = versions.find((v) => v.isDefault) ?? null;
    const displayRow = def ?? latest;
    result.push({
      slug,
      latestVersion: latest.version,
      defaultVersion: def?.version ?? null,
      displayName: latest.displayName,
      purpose: latest.purpose,
      modelTier: latest.modelTier,
      activeModel: resolveActiveModel({
        provider: (displayRow.provider as 'gemini' | 'anthropic' | null) ?? null,
        modelTier: displayRow.modelTier as 'opus' | 'sonnet' | 'haiku',
        modelOverride: displayRow.modelOverride,
      }),
      provider: displayRow.provider ?? null,
      enabled: def?.enabled ?? false,
      maxTokens: latest.maxTokens,
      temperature: latest.temperature,
      versionCount: versions.length,
      updatedAt: latest.createdAt.toISOString(),
    });
  }
  result.sort((a, b) => a.slug.localeCompare(b.slug));
  return result;
}

export interface AgentDetail {
  slug: string;
  versions: Array<{
    version: number;
    displayName: string;
    purpose: string;
    modelTier: string;
    provider: string | null;
    modelOverride: string | null;
    systemPrompt: string;
    temperature: number;
    maxTokens: number;
    enabled: boolean;
    isDefault: boolean;
    createdAt: string;
  }>;
}

export async function getAgent(slug: string): Promise<AgentDetail | null> {
  const db = serviceDb();
  const rows = await db
    .select()
    .from(schema.agentDefinition)
    .where(eq(schema.agentDefinition.slug, slug))
    .orderBy(desc(schema.agentDefinition.version));
  if (rows.length === 0) return null;
  return {
    slug,
    versions: rows.map((r) => ({
      version: r.version,
      displayName: r.displayName,
      purpose: r.purpose,
      modelTier: r.modelTier,
      provider: r.provider ?? null,
      modelOverride: r.modelOverride ?? null,
      systemPrompt: r.systemPrompt,
      temperature: r.temperature,
      maxTokens: r.maxTokens,
      enabled: r.enabled,
      isDefault: r.isDefault,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}

/**
 * Updates the per-agent provider + model_override on the default version.
 * Lets ops swap providers (Gemini ↔ Anthropic) and pin a specific model
 * (e.g. `claude-sonnet-4-6`, `gemini-2.5-pro`) without re-seeding.
 *
 * Both fields are nullable: pass null/empty string to clear and revert to
 * the modelTier-default routing.
 */
export async function updateAgentModelConfig(input: {
  slug: string;
  provider: 'gemini' | 'anthropic' | null;
  modelOverride: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdminSession(['super_admin', 'admin', 'content_editor']);
  const { and } = await import('drizzle-orm');
  const db = serviceDb();
  const result = await db
    .update(schema.agentDefinition)
    .set({
      provider: input.provider,
      modelOverride: input.modelOverride && input.modelOverride.trim().length > 0
        ? input.modelOverride.trim()
        : null,
    })
    .where(
      and(
        eq(schema.agentDefinition.slug, input.slug),
        eq(schema.agentDefinition.isDefault, true),
      ),
    )
    .returning({ slug: schema.agentDefinition.slug });
  if (result.length === 0) {
    return { ok: false, error: `no default version found for agent: ${input.slug}` };
  }
  revalidatePath(`/agents/${input.slug}`);
  revalidatePath(`/products`);
  return { ok: true };
}

export interface PreviewInput {
  slug: string;
  draftSystemPrompt: string;
  draftModelTier?: 'opus' | 'sonnet' | 'haiku';
  draftTemperature?: number;
  draftMaxTokens?: number;
}

export interface PreviewCaseResult {
  goldenCaseId: string;
  goldenCaseName: string;
  tags: string[];
  success: boolean;
  errorMessage: string | null;
  /** Short summary of how close the agent's output matched expected_* fields. */
  diagnostic: string;
}

/**
 * Dry-run the draft prompt against every enabled golden case. Does NOT
 * invoke the LLM in the MVP — that would cost ₹ every edit. Instead we
 * run a structural comparison: does the prompt mention the expected keys
 * from each case's `expected_shape.must_include_fields`?
 *
 * This is a cheap "structural smell-test" — the real LLM judge run stays
 * on the nightly cron and the manual "Run judge now" action below. Keeps
 * the editor loop sub-second.
 */
export async function previewPromptAgainstGoldenSet(
  input: PreviewInput,
): Promise<{ results: PreviewCaseResult[]; summary: string }> {
  const db = serviceDb();
  const cases = await db
    .select()
    .from(schema.evalGoldenCase)
    .where(eq(schema.evalGoldenCase.enabled, true));

  const results: PreviewCaseResult[] = [];
  for (const c of cases) {
    const expected =
      (c.expectedExtraction as Record<string, unknown> | null) ??
      (c.expectedCoverage as Record<string, unknown> | null) ??
      null;
    if (!expected) {
      results.push({
        goldenCaseId: c.id,
        goldenCaseName: c.name,
        tags: c.tags,
        success: true,
        errorMessage: null,
        diagnostic: 'No expected structure to check against.',
      });
      continue;
    }
    const mustInclude =
      (expected.must_include_fields as string[] | undefined) ??
      Object.keys((expected.expected_shape as Record<string, unknown>) ?? {});

    const missing: string[] = [];
    for (const field of mustInclude) {
      // Simplistic: if a required field's tail name (e.g. "insurer_name",
      // "coverage_sections") doesn't appear verbatim in the draft prompt,
      // flag it. Catches accidental field-renames on prompt edits.
      const tail = field.split('.').pop() ?? field;
      if (!input.draftSystemPrompt.includes(tail)) missing.push(field);
    }
    results.push({
      goldenCaseId: c.id,
      goldenCaseName: c.name,
      tags: c.tags,
      success: missing.length === 0,
      errorMessage: missing.length > 0 ? `Prompt doesn't reference: ${missing.join(', ')}` : null,
      diagnostic:
        missing.length === 0
          ? `All ${mustInclude.length} expected fields mentioned in prompt.`
          : `${missing.length}/${mustInclude.length} expected fields missing.`,
    });
  }

  const passed = results.filter((r) => r.success).length;
  const summary = `${passed}/${results.length} structural checks passed. (Cheap smell-test only — full LLM judge runs on nightly cron.)`;
  return { results, summary };
}

export interface PromoteInput {
  slug: string;
  newSystemPrompt: string;
  newDisplayName?: string;
  newPurpose?: string;
  newModelTier?: 'opus' | 'sonnet' | 'haiku';
  newTemperature?: number;
  newMaxTokens?: number;
  changeNote: string;
  createdBy: string;
}

export async function promoteNewAgentVersion(
  input: PromoteInput,
): Promise<{ ok: true; version: number } | { ok: false; message: string }> {
  if (input.newSystemPrompt.trim().length < 20) {
    return { ok: false, message: 'Prompt is too short. Write a real prompt.' };
  }
  if (input.changeNote.trim().length < 5) {
    return {
      ok: false,
      message: 'Add a change note (≥5 chars) so the next editor knows why this changed.',
    };
  }

  const db = serviceDb();
  try {
    const [currentDefault] = await db
      .select()
      .from(schema.agentDefinition)
      .where(
        and(
          eq(schema.agentDefinition.slug, input.slug),
          eq(schema.agentDefinition.isDefault, true),
        ),
      )
      .limit(1);
    if (!currentDefault) {
      return { ok: false, message: `No default version found for ${input.slug}.` };
    }

    const maxRows = await db
      .select({ maxVersion: max(schema.agentDefinition.version) })
      .from(schema.agentDefinition)
      .where(eq(schema.agentDefinition.slug, input.slug));
    const nextVersion = (maxRows[0]?.maxVersion ?? 0) + 1;

    await db.transaction(async (tx) => {
      // Demote the current default.
      await tx
        .update(schema.agentDefinition)
        .set({ isDefault: false })
        .where(
          and(
            eq(schema.agentDefinition.slug, input.slug),
            eq(schema.agentDefinition.isDefault, true),
          ),
        );
      // Mint the new row.
      await tx.insert(schema.agentDefinition).values({
        slug: input.slug,
        version: nextVersion,
        displayName: input.newDisplayName ?? currentDefault.displayName,
        purpose: input.newPurpose ?? currentDefault.purpose,
        modelTier: input.newModelTier ?? currentDefault.modelTier,
        systemPrompt: input.newSystemPrompt,
        tools: currentDefault.tools,
        temperature: input.newTemperature ?? currentDefault.temperature,
        maxTokens: input.newMaxTokens ?? currentDefault.maxTokens,
        reviewRequired: currentDefault.reviewRequired,
        enabled: true,
        isDefault: true,
        localesSupported: currentDefault.localesSupported,
      });
    });

    // Record the edit in audit_log if the table has a row-level policy that
    // allows it — the existing audit_log schema accepts server-role writes.
    try {
      await db.insert(schema.auditLog).values({
        id: randomUUID(),
        tenantId: 'surakshasaathi',
        actorUserId: null,
        actorKind: 'admin',
        action: 'agent_prompt_promoted',
        subjectType: 'agent_definition',
        subjectId: `${input.slug}@v${nextVersion}`,
        payload: { change_note: input.changeNote, created_by: input.createdBy },
      });
    } catch {
      // Audit-log failures don't block the promotion.
    }

    revalidatePath(`/agents/${input.slug}`, 'page');
    revalidatePath('/agents', 'page');
    return { ok: true, version: nextVersion };
  } catch (err) {
    return { ok: false, message: (err as Error).message.slice(0, 240) };
  }
}

/**
 * Rollback an agent to a previously-published version. Unlike promote, this
 * does NOT mint a new row — it flips `is_default=true` on the target version
 * and demotes the current default. Used when a fresh publish regresses and
 * ops wants to revert fast.
 */
export async function rollbackAgentToVersion(input: {
  slug: string;
  version: number;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const db = serviceDb();
  const [target] = await db
    .select()
    .from(schema.agentDefinition)
    .where(and(eq(schema.agentDefinition.slug, input.slug), eq(schema.agentDefinition.version, input.version)))
    .limit(1);
  if (!target) return { ok: false, message: `v${input.version} not found for ${input.slug}` };
  if (target.isDefault) return { ok: true }; // already active

  const [currentDefault] = await db
    .select({ version: schema.agentDefinition.version })
    .from(schema.agentDefinition)
    .where(and(eq(schema.agentDefinition.slug, input.slug), eq(schema.agentDefinition.isDefault, true)))
    .limit(1);

  await db.transaction(async (tx) => {
    await tx
      .update(schema.agentDefinition)
      .set({ isDefault: false })
      .where(
        and(eq(schema.agentDefinition.slug, input.slug), eq(schema.agentDefinition.isDefault, true)),
      );
    await tx
      .update(schema.agentDefinition)
      .set({ isDefault: true })
      .where(
        and(eq(schema.agentDefinition.slug, input.slug), eq(schema.agentDefinition.version, input.version)),
      );
  });

  try {
    await db.insert(schema.auditLog).values({
      id: randomUUID(),
      tenantId: 'surakshasaathi',
      actorUserId: null,
      actorKind: 'admin',
      action: 'agent_prompt_rollback',
      subjectType: 'agent_definition',
      subjectId: `${input.slug}@v${input.version}`,
      payload: { from_version: currentDefault?.version ?? null, to_version: input.version },
    });
  } catch {
    // Audit-log failures don't block the rollback.
  }

  revalidatePath(`/agents/${input.slug}`, 'page');
  revalidatePath('/agents', 'page');
  return { ok: true };
}
