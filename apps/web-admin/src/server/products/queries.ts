import 'server-only';
import { and, desc, eq, gte, inArray, sql } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import { resolveActiveModel } from '@/lib/active-model';

/**
 * Reads the product_module registry + denormalises each module's
 * agents/evals/cases/analyses into one dashboard-shaped struct. Called by
 * /products/[slug] and the cross-module overview.
 */

export interface ProductModuleRow {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  cluster: string;
  status: string;
  pricingModel: string;
  authRequired: string;
  agentIds: string[];
  landingRoute: string;
  iconSlug: string | null;
}

export async function listProductModules(): Promise<ProductModuleRow[]> {
  const db = serviceDb();
  const rows = await db.select().from(schema.productModule).orderBy(schema.productModule.orderIndex);
  return rows.map((r) => ({
    id: r.id,
    slug: r.id,
    name: (r.nameI18n as Record<string, string>)?.en ?? r.id,
    tagline: (r.taglineI18n as Record<string, string>)?.en ?? '',
    cluster: r.cluster,
    status: r.status,
    pricingModel: r.pricingModel,
    authRequired: r.authRequired,
    agentIds: r.agentDefinitionIds,
    landingRoute: r.landingRoute,
    iconSlug: r.iconSlug,
  }));
}

export async function getProductModule(slug: string): Promise<ProductModuleRow | null> {
  const list = await listProductModules();
  return list.find((p) => p.id === slug) ?? null;
}

export interface ProductDetail {
  module: ProductModuleRow;
  agents: Array<{
    slug: string;
    displayName: string;
    modelTier: string;
    /** Resolved model id actually used at runtime — modelOverride if set,
     *  else the first candidate from the modelTier mapping for the provider.
     *  Shown to admins instead of the abstract "tier" label. */
    activeModel: string;
    provider: string | null;
    defaultVersion: number;
    enabled: boolean;
  }>;
  agentEvals: Array<{
    agentSlug: string;
    rubricId: string | null;
    rubricVersion: number | null;
    rubricEnabled: boolean;
    judgeModelTier: string | null;
    goldenCasesTotal: number;
    goldenCasesEnabled: number;
    runs7d: number;
    passRate7d: number | null;
    avgScore7d: number | null;
    lastRunAt: string | null;
    lastRunPassed: boolean | null;
  }>;
  counts: {
    casesActive: number;
    casesTotal: number;
    analyses: number;
    evalRuns7d: number;
  };
  recentCases: Array<{
    id: string;
    kind: string;
    status: string;
    insurerName: string | null;
    createdAt: string;
  }>;
  recentAnalyses: Array<{
    id: string;
    userId: string | null;
    status: string;
    createdAt: string;
  }>;
}

export async function getProductDetail(slug: string): Promise<ProductDetail | null> {
  const module = await getProductModule(slug);
  if (!module) return null;

  const db = serviceDb();

  // Agents tied to this module. Join into agent_definition for display info.
  const agentRows = module.agentIds.length
    ? await db
        .select()
        .from(schema.agentDefinition)
        .where(
          and(
            inArray(schema.agentDefinition.slug, module.agentIds),
            eq(schema.agentDefinition.isDefault, true),
          ),
        )
    : [];

  // Cases filed against this module.
  const CLOSED = ['resolved_in_favour', 'resolved_against', 'withdrawn', 'abandoned'];
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  const [[active], [total], [evalCount], recentCases, recentAnalyses] = await Promise.all([
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.caseRow)
      .where(
        and(
          eq(schema.caseRow.moduleId, module.id),
          sql`${schema.caseRow.status} NOT IN (${sql.join(CLOSED.map((s) => sql`${s}`), sql`, `)})`,
        ),
      ),
    db
      .select({ c: sql<number>`count(*)::int` })
      .from(schema.caseRow)
      .where(eq(schema.caseRow.moduleId, module.id)),
    module.agentIds.length
      ? db
          .select({ c: sql<number>`count(*)::int` })
          .from(schema.evalRun)
          .where(
            and(
              inArray(schema.evalRun.agentSlug, module.agentIds),
              gte(schema.evalRun.createdAt, sevenDaysAgo),
            ),
          )
      : Promise.resolve([{ c: 0 }]),
    db
      .select({
        id: schema.caseRow.id,
        kind: schema.caseRow.kind,
        status: schema.caseRow.status,
        insurerName: schema.caseRow.insurerName,
        createdAt: schema.caseRow.createdAt,
      })
      .from(schema.caseRow)
      .where(eq(schema.caseRow.moduleId, module.id))
      .orderBy(desc(schema.caseRow.createdAt))
      .limit(8),
    // Analyses don't carry a module_id today. The Analyse-My-Policy flow
    // belongs to Policy Health Score (Before chapter); Claims Advocacy is the
    // separate After-chapter rejection flow.
    module.id === 'policy-health-score'
      ? db
          .select({
            id: schema.policyAnalysis.id,
            userId: schema.policyAnalysis.userId,
            status: schema.policyAnalysis.status,
            createdAt: schema.policyAnalysis.createdAt,
          })
          .from(schema.policyAnalysis)
          .orderBy(desc(schema.policyAnalysis.createdAt))
          .limit(8)
      : Promise.resolve([]),
  ]);

  // Per-agent eval rollup. One row per agent in the module, even if no rubric
  // exists yet (so ops can see "no rubric — add one" gaps at a glance).
  const agentEvals = await Promise.all(
    module.agentIds.map(async (slug) => {
      const sevenDaysAgoEval = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      const [
        [rubric],
        [casesTotal],
        [casesEnabled],
        [runs],
        [lastRun],
      ] = await Promise.all([
        db
          .select({
            id: schema.evalRubric.id,
            version: schema.evalRubric.version,
            enabled: schema.evalRubric.enabled,
            judgeModelTier: schema.evalRubric.judgeModelTier,
          })
          .from(schema.evalRubric)
          .where(
            and(
              eq(schema.evalRubric.agentSlug, slug),
              eq(schema.evalRubric.isDefault, true),
            ),
          )
          .limit(1),
        db
          .select({ c: sql<number>`count(*)::int` })
          .from(schema.evalGoldenCase)
          .where(sql`${slug} = ANY (${schema.evalGoldenCase.tags})`),
        db
          .select({ c: sql<number>`count(*)::int` })
          .from(schema.evalGoldenCase)
          .where(
            and(
              eq(schema.evalGoldenCase.enabled, true),
              sql`${slug} = ANY (${schema.evalGoldenCase.tags})`,
            ),
          ),
        db
          .select({
            total: sql<number>`count(*)::int`,
            passed: sql<number>`count(*) filter (where ${schema.evalRun.passed} = true)::int`,
            withVerdict: sql<number>`count(*) filter (where ${schema.evalRun.passed} is not null)::int`,
            avgScore: sql<number>`avg(${schema.evalRun.qualityScore})::int`,
          })
          .from(schema.evalRun)
          .where(
            and(
              eq(schema.evalRun.agentSlug, slug),
              gte(schema.evalRun.createdAt, sevenDaysAgoEval),
            ),
          ),
        db
          .select({
            createdAt: schema.evalRun.createdAt,
            passed: schema.evalRun.passed,
          })
          .from(schema.evalRun)
          .where(eq(schema.evalRun.agentSlug, slug))
          .orderBy(desc(schema.evalRun.createdAt))
          .limit(1),
      ]);

      const total = Number(runs?.total ?? 0);
      const withVerdict = Number(runs?.withVerdict ?? 0);
      const passed = Number(runs?.passed ?? 0);
      return {
        agentSlug: slug,
        rubricId: rubric?.id ?? null,
        rubricVersion: rubric?.version ?? null,
        rubricEnabled: rubric?.enabled ?? false,
        judgeModelTier: rubric?.judgeModelTier ?? null,
        goldenCasesTotal: Number(casesTotal?.c ?? 0),
        goldenCasesEnabled: Number(casesEnabled?.c ?? 0),
        runs7d: total,
        passRate7d: withVerdict > 0 ? Math.round((passed / withVerdict) * 100) : null,
        avgScore7d: runs?.avgScore != null ? Number(runs.avgScore) : null,
        lastRunAt: lastRun?.createdAt?.toISOString() ?? null,
        lastRunPassed: lastRun?.passed ?? null,
      };
    }),
  );

  return {
    module,
    agents: agentRows.map((a) => ({
      slug: a.slug,
      displayName: a.displayName,
      modelTier: a.modelTier,
      activeModel: resolveActiveModel({
        provider: a.provider as 'gemini' | 'anthropic' | null,
        modelTier: a.modelTier as 'opus' | 'sonnet' | 'haiku',
        modelOverride: a.modelOverride,
      }),
      provider: a.provider ?? null,
      defaultVersion: a.version,
      enabled: a.enabled,
    })),
    agentEvals,
    counts: {
      casesActive: Number(active?.c ?? 0),
      casesTotal: Number(total?.c ?? 0),
      analyses: recentAnalyses.length,
      evalRuns7d: Number(evalCount?.c ?? 0),
    },
    recentCases: recentCases.map((c) => ({
      id: c.id,
      kind: c.kind,
      status: c.status,
      insurerName: c.insurerName,
      createdAt: c.createdAt.toISOString(),
    })),
    recentAnalyses: recentAnalyses.map((a) => ({
      id: a.id,
      userId: a.userId,
      status: a.status,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}
