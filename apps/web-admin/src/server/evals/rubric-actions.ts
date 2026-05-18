'use server';

import { and, asc, desc, eq } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { serviceDb, schema } from '@suraksha/db';
import { requireAdminSession } from '@/lib/auth';

/**
 * Eval-rubric editing actions used by /agents/[slug]/rubric.
 *
 *   listRubricVersions(slug)        — every version row, default first
 *   getDefaultRubric(slug)          — current is_default row
 *   saveNewRubricVersion(...)       — insert next-version row, mark default
 *   setDefaultRubricVersion(...)    — flip default to a prior version (rollback)
 */

export interface RubricRow {
  id: string;
  agentSlug: string;
  version: number;
  judgeModelTier: 'opus' | 'sonnet' | 'haiku';
  judgePrompt: string;
  outputSchema: Record<string, unknown>;
  enabled: boolean;
  isDefault: boolean;
  changeNote: string | null;
  createdBy: string | null;
  createdAt: string;
}

function row(r: typeof schema.evalRubric.$inferSelect): RubricRow {
  return {
    id: r.id,
    agentSlug: r.agentSlug,
    version: r.version,
    judgeModelTier: r.judgeModelTier as RubricRow['judgeModelTier'],
    judgePrompt: r.judgePrompt,
    outputSchema: r.outputSchema as Record<string, unknown>,
    enabled: r.enabled,
    isDefault: r.isDefault,
    changeNote: r.changeNote,
    createdBy: r.createdBy,
    createdAt: r.createdAt.toISOString(),
  };
}

export async function listRubricVersions(agentSlug: string): Promise<RubricRow[]> {
  await requireAdminSession(['super_admin', 'admin', 'content_editor', 'viewer']);
  const db = serviceDb();
  const rows = await db
    .select()
    .from(schema.evalRubric)
    .where(eq(schema.evalRubric.agentSlug, agentSlug))
    .orderBy(desc(schema.evalRubric.version));
  return rows.map(row);
}

export async function getDefaultRubric(agentSlug: string): Promise<RubricRow | null> {
  await requireAdminSession(['super_admin', 'admin', 'content_editor', 'viewer']);
  const db = serviceDb();
  const [r] = await db
    .select()
    .from(schema.evalRubric)
    .where(and(eq(schema.evalRubric.agentSlug, agentSlug), eq(schema.evalRubric.isDefault, true)))
    .limit(1);
  return r ? row(r) : null;
}

export async function saveNewRubricVersion(args: {
  agentSlug: string;
  judgePrompt: string;
  judgeModelTier: 'opus' | 'sonnet' | 'haiku';
  changeNote: string;
}): Promise<{ ok: boolean; version?: number; error?: string }> {
  const session = await requireAdminSession(['super_admin', 'admin', 'content_editor']);
  const db = serviceDb();

  const trimmed = args.judgePrompt.trim();
  if (trimmed.length < 50) {
    return { ok: false, error: 'Judge prompt must be at least 50 characters.' };
  }

  // Reuse the existing default's outputSchema — schema changes go through a
  // dedicated migration, not the prompt editor.
  const [existing] = await db
    .select()
    .from(schema.evalRubric)
    .where(eq(schema.evalRubric.agentSlug, args.agentSlug))
    .orderBy(desc(schema.evalRubric.version))
    .limit(1);

  const nextVersion = (existing?.version ?? 0) + 1;
  const outputSchema =
    existing?.outputSchema ?? {
      type: 'object',
      properties: {
        quality_score: { type: 'integer', minimum: 0, maximum: 100 },
        passed: { type: 'boolean' },
        summary: { type: 'string' },
      },
      required: ['quality_score', 'passed', 'summary'],
    };

  await db.transaction(async (tx) => {
    await tx
      .update(schema.evalRubric)
      .set({ isDefault: false })
      .where(eq(schema.evalRubric.agentSlug, args.agentSlug));

    await tx.insert(schema.evalRubric).values({
      agentSlug: args.agentSlug,
      version: nextVersion,
      judgeModelTier: args.judgeModelTier,
      judgePrompt: trimmed,
      outputSchema,
      enabled: true,
      isDefault: true,
      changeNote: args.changeNote.trim() || null,
      createdBy: session.email ?? 'admin',
    });
  });

  revalidatePath(`/agents/${args.agentSlug}/rubric`);
  revalidatePath(`/products`);
  revalidatePath(`/products/[slug]`, 'page');
  return { ok: true, version: nextVersion };
}

export async function setDefaultRubricVersion(args: {
  agentSlug: string;
  version: number;
}): Promise<{ ok: boolean; error?: string }> {
  await requireAdminSession(['super_admin', 'admin', 'content_editor']);
  const db = serviceDb();

  await db.transaction(async (tx) => {
    await tx
      .update(schema.evalRubric)
      .set({ isDefault: false })
      .where(eq(schema.evalRubric.agentSlug, args.agentSlug));

    await tx
      .update(schema.evalRubric)
      .set({ isDefault: true })
      .where(
        and(
          eq(schema.evalRubric.agentSlug, args.agentSlug),
          eq(schema.evalRubric.version, args.version),
        ),
      );
  });

  revalidatePath(`/agents/${args.agentSlug}/rubric`);
  revalidatePath(`/products/[slug]`, 'page');
  return { ok: true };
}
