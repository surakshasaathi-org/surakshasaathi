'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Loader2, RotateCw } from 'lucide-react';
import { Button } from '@suraksha/ui';

/**
 * "Recompute score" button shown on the Score tab when no PolicyScore
 * exists for the analysis. The score agent is triggered as a background
 * task at end-of-pipeline; transient failures (parser, LLM 5xx, dev-server
 * restart mid-run) leave the analysis without a score until the next
 * regenerate. This button gives the customer a one-click recovery path.
 *
 * On success it triggers a router.refresh() so the parent server component
 * re-fetches the score and renders the populated Score tab.
 */
export function RecomputeScoreButton({ analysisId }: { analysisId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleClick() {
    setServerError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/analyse/${analysisId}/recompute-score`, {
        method: 'POST',
        cache: 'no-store',
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        const code = body.error ?? `http_${res.status}`;
        setServerError(humanError(code));
        return;
      }
      // Refresh the server tree so the analysis page re-loads the score.
      startTransition(() => router.refresh());
    } catch {
      setServerError("Couldn't reach the network. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const busy = pending || submitting;

  return (
    <div className="mt-4 flex flex-col items-start gap-2">
      <Button type="button" onClick={handleClick} disabled={busy} variant="primary" size="sm">
        {busy ? (
          <>
            <Loader2 className="mr-1.5 size-4 animate-spin" />
            Computing…
          </>
        ) : (
          <>
            <RotateCw className="mr-1.5 size-4" />
            Compute score now
          </>
        )}
      </Button>
      {serverError && (
        <p className="inline-flex items-start gap-1.5 text-xs text-danger">
          <AlertTriangle className="mt-0.5 size-3.5 flex-none" />
          <span>{serverError}</span>
        </p>
      )}
    </div>
  );
}

function humanError(code: string): string {
  switch (code) {
    case 'analysis_not_ready':
      return 'Wait for the analysis to finish before computing a score.';
    case 'incompatible_report_shape':
      return 'This analysis was generated before the scoring pipeline existed. Re-run the analysis to score it.';
    case 'upstream_unavailable':
      return 'Our AI is busy right now. Give it a few seconds and try again.';
    case 'score_not_persisted':
      return 'The scorer ran but the score didn’t save. Try once more — if it keeps failing, contact support.';
    default:
      return 'Something went wrong on our side. Please try again.';
  }
}
