import 'server-only';
import { and, avg, count, desc, eq, gte, sql, sum } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';

/**
 * Admin eval dashboard queries. Rolls up eval_run rows into pass rate +
 * quality trend per agent, and lists recent runs with rubric + case context.
 */

export interface AgentEvalSummary {
  agentSlug: string;
  runs7d: number;
  passRate7d: number | null;
  avgScore7d: number | null;
  lastRunAt: string | null;
  lastRunPassed: boolean | null;
  rubricVersion: number | null;
}

export interface EvalRunListRow {
  id: string;
  agentSlug: string;
  agentVersion: number;
  trigger: string;
  goldenCaseName: string | null;
  qualityScore: number | null;
  passed: boolean | null;
  costPaise: number;
  errorMessage: string | null;
  createdAt: string;
}

export async function getAgentEvalSummary(): Promise<AgentEvalSummary[]> {
  const db = serviceDb();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000);

  // Aggregate in one query: runs, pass rate, avg score, last run per agent.
  const rows = await db
    .select({
      agentSlug: schema.evalRun.agentSlug,
      runs: count(),
      avgScore: avg(schema.evalRun.qualityScore).mapWith(Number),
      passed: sum(sql<number>`case when ${schema.evalRun.passed} = true then 1 else 0 end`).mapWith(Number),
      total: sum(sql<number>`case when ${schema.evalRun.passed} is not null then 1 else 0 end`).mapWith(Number),
    })
    .from(schema.evalRun)
    .where(gte(schema.evalRun.createdAt, sevenDaysAgo))
    .groupBy(schema.evalRun.agentSlug);

  // Last-run lookup per agent. A window function would be cleaner but keeping
  // this readable for now — agent count is <20 so the double round-trip is fine.
  const summary: AgentEvalSummary[] = [];
  for (const r of rows) {
    const [lastRun] = await db
      .select({
        createdAt: schema.evalRun.createdAt,
        passed: schema.evalRun.passed,
        rubricVersion: schema.evalRubric.version,
      })
      .from(schema.evalRun)
      .leftJoin(schema.evalRubric, eq(schema.evalRubric.id, schema.evalRun.rubricId))
      .where(eq(schema.evalRun.agentSlug, r.agentSlug))
      .orderBy(desc(schema.evalRun.createdAt))
      .limit(1);

    summary.push({
      agentSlug: r.agentSlug,
      runs7d: Number(r.runs ?? 0),
      passRate7d:
        r.total && Number(r.total) > 0
          ? Math.round((Number(r.passed ?? 0) / Number(r.total)) * 100)
          : null,
      avgScore7d: r.avgScore != null ? Math.round(Number(r.avgScore)) : null,
      lastRunAt: lastRun?.createdAt.toISOString() ?? null,
      lastRunPassed: lastRun?.passed ?? null,
      rubricVersion: lastRun?.rubricVersion ?? null,
    });
  }

  // Also include agents with zero runs in the window so ops can see they're
  // not being exercised at all.
  const allRubrics = await db
    .select({ slug: schema.evalRubric.agentSlug })
    .from(schema.evalRubric)
    .where(eq(schema.evalRubric.enabled, true));
  const covered = new Set(summary.map((s) => s.agentSlug));
  for (const rr of allRubrics) {
    if (!covered.has(rr.slug)) {
      summary.push({
        agentSlug: rr.slug,
        runs7d: 0,
        passRate7d: null,
        avgScore7d: null,
        lastRunAt: null,
        lastRunPassed: null,
        rubricVersion: null,
      });
    }
  }

  summary.sort((a, b) => a.agentSlug.localeCompare(b.agentSlug));
  return summary;
}

export async function listRecentEvalRuns(limit = 50): Promise<EvalRunListRow[]> {
  const db = serviceDb();
  const rows = await db
    .select({
      id: schema.evalRun.id,
      agentSlug: schema.evalRun.agentSlug,
      agentVersion: schema.evalRun.agentVersion,
      trigger: schema.evalRun.trigger,
      qualityScore: schema.evalRun.qualityScore,
      passed: schema.evalRun.passed,
      costPaise: schema.evalRun.costPaise,
      errorMessage: schema.evalRun.errorMessage,
      createdAt: schema.evalRun.createdAt,
      goldenCaseName: schema.evalGoldenCase.name,
    })
    .from(schema.evalRun)
    .leftJoin(schema.evalGoldenCase, eq(schema.evalGoldenCase.id, schema.evalRun.goldenCaseId))
    .orderBy(desc(schema.evalRun.createdAt))
    .limit(limit);

  return rows.map((r) => ({
    id: r.id,
    agentSlug: r.agentSlug,
    agentVersion: r.agentVersion,
    trigger: r.trigger,
    goldenCaseName: r.goldenCaseName,
    qualityScore: r.qualityScore,
    passed: r.passed,
    costPaise: r.costPaise,
    errorMessage: r.errorMessage,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function getGoldenCasesCount(): Promise<{ enabled: number; total: number }> {
  const db = serviceDb();
  const [total] = await db.select({ c: count() }).from(schema.evalGoldenCase);
  const [enabled] = await db
    .select({ c: count() })
    .from(schema.evalGoldenCase)
    .where(eq(schema.evalGoldenCase.enabled, true));
  return {
    enabled: Number(enabled?.c ?? 0),
    total: Number(total?.c ?? 0),
  };
}
