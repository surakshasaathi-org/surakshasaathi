'use client';

import { useTransition } from 'react';
import { toggleGoldenCase } from '@/server/evals/golden-actions';

interface Props {
  caseId: string;
  agentSlug: string;
  enabled: boolean;
}

export function GoldenCaseToggle({ caseId, agentSlug, enabled }: Props) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      onClick={() =>
        start(async () => {
          await toggleGoldenCase({ caseId, agentSlug, enabled: !enabled });
        })
      }
      disabled={pending}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition ${
        enabled
          ? 'border-success/30 bg-success/10 text-success hover:border-success/60'
          : 'border-border bg-background text-ink-muted hover:border-primary/40 hover:text-primary'
      } disabled:cursor-not-allowed disabled:opacity-50`}
    >
      {pending ? '…' : enabled ? 'enabled · click to pause' : 'paused · click to enable'}
    </button>
  );
}
