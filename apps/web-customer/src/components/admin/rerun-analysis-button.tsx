'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCcw } from 'lucide-react';
import { buttonVariants } from '@suraksha/ui';
import { rerunAnalysisAction } from '@/server/admin/analyses/rerun';

interface Props {
  analysisId: string;
}

export function RerunAnalysisButton({ analysisId }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [forceDigitize, setForceDigitize] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const onClick = () => {
    setFeedback(null);
    startTransition(async () => {
      const res = await rerunAnalysisAction(analysisId, { forceDigitize });
      if (res.ok) {
        setFeedback('Re-run started — pipeline is running. Refreshing in a moment…');
        // Give the customer-side endpoint a beat to flip status='queued',
        // then refresh so the admin sees the new status + cleared report.
        setTimeout(() => router.refresh(), 800);
      } else {
        setFeedback(`Failed: ${res.error}`);
      }
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onClick}
        disabled={pending}
        className={buttonVariants({ variant: 'outline', size: 'sm' })}
      >
        <RefreshCcw className={`mr-1.5 size-3.5 ${pending ? 'animate-spin' : ''}`} aria-hidden />
        {pending ? 'Re-running…' : 'Re-run with latest prompts'}
      </button>
      <label className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
        <input
          type="checkbox"
          className="size-3.5 rounded border-border accent-primary"
          checked={forceDigitize}
          onChange={(e) => setForceDigitize(e.target.checked)}
          disabled={pending}
        />
        Also re-digitize (slower; only needed if digitizer prompt changed)
      </label>
      {feedback && (
        <span className="ml-1 text-xs text-ink-muted" role="status">
          {feedback}
        </span>
      )}
    </div>
  );
}
