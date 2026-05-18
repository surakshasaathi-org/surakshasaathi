'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import Link from 'next/link';
import { Play, CheckCircle2, XCircle, ArrowUpRight } from 'lucide-react';
import { runEvalsForAgent, type RunEvalsResult } from '@/server/admin/evals/run-actions';
import type { AgentVersionOption } from '@/server/admin/evals/golden-actions';

interface Props {
  agentSlug: string;
  enabledCount: number;
  totalCount: number;
  versions: AgentVersionOption[];
}

/**
 * "Run all enabled" control at the top of the golden-cases page. Per-case
 * "Run" buttons live on each card via <RunSingleCase />.
 */
export function EvalRunControls({ agentSlug, enabledCount, totalCount, versions }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [result, setResult] = useState<RunEvalsResult | null>(null);
  const defaultVersion = versions.find((v) => v.isDefault)?.version ?? versions[0]?.version ?? 1;
  const [selectedVersion, setSelectedVersion] = useState<number>(defaultVersion);

  function runAll() {
    setResult(null);
    start(async () => {
      const r = await runEvalsForAgent({ agentSlug, agentVersion: selectedVersion });
      setResult(r);
      router.refresh();
    });
  }

  return (
    <div className="mb-5 rounded-xl border border-border bg-card p-4 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-ink-muted">
          <strong className="text-ink">{enabledCount} enabled</strong> of {totalCount} tagged
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
            <span className="font-semibold uppercase tracking-wider text-ink-subtle">
              Agent version
            </span>
            <select
              value={selectedVersion}
              onChange={(e) => setSelectedVersion(Number(e.target.value))}
              disabled={pending || versions.length === 0}
              className="rounded-md border border-border bg-background px-2 py-1 text-xs text-ink"
            >
              {versions.map((v) => (
                <option key={v.version} value={v.version}>
                  v{v.version}
                  {v.isDefault ? ' · default' : ''}
                  {!v.enabled ? ' · disabled' : ''}
                  {v.modelTier !== 'sonnet' ? ` · ${v.modelTier}` : ''}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={runAll}
            disabled={pending || enabledCount === 0}
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-card hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Play className="size-3.5" />
            {pending ? 'Running…' : `Run all ${enabledCount} on v${selectedVersion}`}
          </button>
        </div>
      </div>

      {result && (
        <div className="mt-4 rounded-lg border border-border bg-background p-3">
          <div className="text-xs text-ink-muted">
            <strong className="text-ink">{result.succeeded} ok</strong>
            {' · '}
            <strong className="text-ink">{result.failed} failed</strong> across {result.total} runs
            {(() => {
              const passed = result.outcomes.filter((o) => o.passed === true).length;
              const failed = result.outcomes.filter((o) => o.passed === false).length;
              const totalScore = result.outcomes.reduce(
                (sum, o) => (o.qualityScore !== null ? sum + o.qualityScore : sum),
                0,
              );
              const scored = result.outcomes.filter((o) => o.qualityScore !== null).length;
              return (
                <>
                  {' · '}
                  <strong className="text-ink">{passed} passed</strong>
                  {' / '}
                  <strong className="text-ink">{failed} failed verdict</strong>
                  {scored > 0 && (
                    <>
                      {' · '}avg score{' '}
                      <strong className="text-ink">
                        {Math.round(totalScore / scored)}/100
                      </strong>
                    </>
                  )}
                </>
              );
            })()}
          </div>
          <ul className="mt-3 space-y-2">
            {result.outcomes.map((o) => (
              <li
                key={o.caseId}
                className="flex items-start justify-between gap-3 rounded-md border border-border bg-card p-2.5 text-[11px]"
              >
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  {o.ok ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success" />
                  ) : (
                    <XCircle className="mt-0.5 size-3.5 shrink-0 text-danger" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-ink">{o.caseName}</div>
                    {o.ok ? (
                      <div className="text-ink-muted">
                        passed: <strong className="text-ink">{String(o.passed)}</strong>
                        {o.qualityScore !== null && ` · score ${o.qualityScore}/100`}
                      </div>
                    ) : (
                      <div
                        className="truncate whitespace-pre-wrap break-words text-danger"
                        title={o.errorMessage ?? undefined}
                      >
                        {o.errorMessage}
                      </div>
                    )}
                  </div>
                </div>
                {o.runId && (
                  <Link
                    href={`/evals/runs/${o.runId}`}
                    className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium text-primary hover:underline"
                  >
                    View trace
                    <ArrowUpRight className="size-3" />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
