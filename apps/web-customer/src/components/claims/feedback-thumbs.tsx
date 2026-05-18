'use client';

import { useState } from 'react';
import { ThumbsUp, ThumbsDown, Check } from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  /** Discriminator for what's being rated; mirrors user_feedback.target CHECK constraint. */
  target: 'analysis_overall' | 'coverage_card' | 'red_flag' | 'chat_message' | 'report_section';
  targetRef?: string;
  analysisId?: string;
  chatMessageId?: string;
  label?: string;
  /** Compact = two icon-only buttons, default = labelled chips */
  compact?: boolean;
}

/**
 * Thumbs up/down on any AI output. Optimistic: on click we mark as sent and
 * then POST in the background. If the write fails we let the user re-submit.
 */
export function FeedbackThumbs({
  target,
  targetRef,
  analysisId,
  chatMessageId,
  label,
  compact = false,
}: Props) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'error'>('idle');
  const [rating, setRating] = useState<-1 | 0 | 1>(0);

  async function send(r: -1 | 1) {
    if (state === 'sending' || state === 'done') return;
    // If we're retrying after an error, return to idle before re-attempting
    // so the spinner briefly shows on re-submit.
    if (state === 'error') setState('idle');
    setRating(r);
    setState('sending');
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          target,
          target_ref: targetRef,
          analysis_id: analysisId,
          chat_message_id: chatMessageId,
          rating: r,
        }),
      });
      if (res.ok) {
        setState('done');
      } else {
        // On failure, reset the visual rating so the buttons don't appear
        // locked into the attempted selection. User can click again to retry.
        setRating(0);
        setState('error');
      }
    } catch {
      setRating(0);
      setState('error');
    }
  }

  if (state === 'done') {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-subtle">
        <Check className="size-3.5 text-success" aria-hidden />
        Thanks — recorded
      </span>
    );
  }

  return (
    <div className={cn('inline-flex items-center gap-2', compact ? 'text-xs' : 'text-sm')}>
      {label && !compact && <span className="text-ink-subtle">{label}</span>}
      <button
        type="button"
        onClick={() => send(1)}
        disabled={state === 'sending'}
        aria-label="Helpful"
        className={cn(
          'rounded-md border border-border px-2 py-1 transition hover:border-success/50 hover:text-success disabled:opacity-50',
          rating === 1 && state === 'sending' && 'bg-success-subtle text-success',
        )}
      >
        <ThumbsUp className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => send(-1)}
        disabled={state === 'sending'}
        aria-label="Not helpful"
        className={cn(
          'rounded-md border border-border px-2 py-1 transition hover:border-danger/50 hover:text-danger disabled:opacity-50',
          rating === -1 && state === 'sending' && 'bg-danger-subtle text-danger',
        )}
      >
        <ThumbsDown className="size-3.5" />
      </button>
      {state === 'error' && <span className="text-xs text-danger">Try again</span>}
    </div>
  );
}
