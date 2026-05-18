import Link from 'next/link';
import { CheckCircle2, XCircle, AlertTriangle, ArrowUpRight } from 'lucide-react';
import type { LastEvalRun } from '@/server/evals/golden-actions';

interface Props {
  lastRun: LastEvalRun | null;
}

/**
 * Compact last-run summary for a golden case card. Click → trace page.
 */
export function LastRunPill({ lastRun }: Props) {
  if (!lastRun) {
    return <span className="text-[10px] text-ink-subtle">never run</span>;
  }

  const isError = lastRun.errorMessage !== null;
  const tone = isError
    ? 'bg-danger/10 text-danger hover:bg-danger/15'
    : lastRun.passed === true
      ? 'bg-success/10 text-success hover:bg-success/15'
      : lastRun.passed === false
        ? 'bg-warn/10 text-warn hover:bg-warn/15'
        : 'bg-background text-ink-muted hover:bg-card';

  const Icon = isError ? AlertTriangle : lastRun.passed ? CheckCircle2 : XCircle;
  const label = isError
    ? 'error'
    : lastRun.passed === true
      ? 'passed'
      : lastRun.passed === false
        ? 'failed'
        : 'no verdict';

  return (
    <div className="flex flex-col items-end gap-1">
      <Link
        href={`/evals/runs/${lastRun.runId}`}
        className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium transition ${tone}`}
        title={lastRun.errorMessage ?? 'Open trace →'}
      >
        <Icon className="size-3" />
        last: {label}
        {lastRun.qualityScore !== null && ` · ${lastRun.qualityScore}/100`}
        <ArrowUpRight className="size-3" />
      </Link>
      <span className="text-[10px] text-ink-subtle">
        {new Date(lastRun.createdAt).toLocaleString('en-IN', {
          day: 'numeric',
          month: 'short',
          hour: 'numeric',
          minute: '2-digit',
        })}
        {' · '}
        {lastRun.trigger}
        {lastRun.latencyMs !== null && ` · ${(lastRun.latencyMs / 1000).toFixed(1)}s`}
        {lastRun.costPaise > 0 && ` · ₹${(lastRun.costPaise / 100).toFixed(2)}`}
        {' · v'}
        {lastRun.agentVersion}
      </span>
    </div>
  );
}
