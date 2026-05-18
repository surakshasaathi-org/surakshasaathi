'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Play, CheckCircle2, XCircle, ArrowUpRight } from 'lucide-react';
import { runEvalsForAgent, type EvalRunOutcome } from '@/server/admin/evals/run-actions';

interface Props {
  agentSlug: string;
  caseId: string;
  /** Optional version override; omit to use current default. */
  agentVersion?: number;
}

export function RunSingleCase({ agentSlug, caseId, agentVersion }: Props) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [outcome, setOutcome] = useState<EvalRunOutcome | null>(null);

  function run() {
    setOutcome(null);
    start(async () => {
      const r = await runEvalsForAgent({ agentSlug, caseIds: [caseId], agentVersion });
      setOutcome(r.outcomes[0] ?? null);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={run}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium text-ink hover:border-primary/40 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Play className="size-3" />
        {pending ? 'Running…' : 'Run'}
      </button>

      {outcome && (
        <div className="flex flex-col items-end gap-1">
          <div
            className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium ${
              outcome.ok
                ? outcome.passed
                  ? 'bg-success/10 text-success'
                  : 'bg-warn/10 text-warn'
                : 'bg-danger/10 text-danger'
            }`}
          >
            {outcome.ok ? (
              outcome.passed ? (
                <>
                  <CheckCircle2 className="size-3" /> just-ran: passed
                  {outcome.qualityScore !== null && ` · ${outcome.qualityScore}`}
                </>
              ) : (
                <>
                  <XCircle className="size-3" /> just-ran: failed
                  {outcome.qualityScore !== null && ` · ${outcome.qualityScore}`}
                </>
              )
            ) : (
              <>
                <XCircle className="size-3" /> just-ran: error
              </>
            )}
          </div>
          {outcome.errorMessage && (
            <div
              className="max-w-[280px] truncate text-[10px] text-danger"
              title={outcome.errorMessage}
            >
              {outcome.errorMessage}
            </div>
          )}
          {outcome.runId && (
            <Link
              href={`/evals/runs/${outcome.runId}`}
              className="inline-flex items-center gap-0.5 text-[10px] font-medium text-primary hover:underline"
            >
              View trace
              <ArrowUpRight className="size-3" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
