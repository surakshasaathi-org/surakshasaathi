import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * A testimonial block that leads with *outcome* — named Indian family +
 * specific ₹ number. Plain quote below. Replaces the abstract "great product"
 * pattern that users have learned to ignore.
 *
 * Photo is optional. When omitted, we show a warm monogram so the layout
 * stays balanced without stock faces (which we deliberately avoid).
 */

interface Props {
  familyName: string;
  city: string;
  outcome: string;
  quote: ReactNode;
  initials?: string;
  tone?: 'light' | 'dark';
}

export function NamedTestimonial({
  familyName,
  city,
  outcome,
  quote,
  initials,
  tone = 'light',
}: Props) {
  const mono = initials ?? familyName.slice(0, 2).toUpperCase();
  return (
    <figure
      className={cn(
        'rounded-3xl border p-8 shadow-card transition sm:p-10',
        tone === 'light'
          ? 'border-border bg-card hover:shadow-floating'
          : 'border-white/10 bg-white/5 backdrop-blur',
      )}
    >
      {/* Outcome — the thing that matters. */}
      <div
        className={cn(
          'mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]',
          tone === 'light'
            ? 'bg-success/10 text-success'
            : 'bg-accent/20 text-accent',
        )}
      >
        {outcome}
      </div>
      <blockquote
        className={cn(
          'font-display text-xl leading-snug sm:text-2xl',
          tone === 'light' ? 'text-ink' : 'text-white',
        )}
      >
        "{quote}"
      </blockquote>
      <figcaption className="mt-6 flex items-center gap-3">
        <div
          className={cn(
            'flex size-10 items-center justify-center rounded-full font-display text-sm font-semibold',
            tone === 'light'
              ? 'bg-primary/10 text-primary'
              : 'bg-accent/20 text-accent',
          )}
          aria-hidden
        >
          {mono}
        </div>
        <div>
          <div
            className={cn(
              'text-sm font-semibold',
              tone === 'light' ? 'text-ink' : 'text-white',
            )}
          >
            The {familyName} family
          </div>
          <div
            className={cn(
              'text-xs',
              tone === 'light' ? 'text-ink-muted' : 'text-white/70',
            )}
          >
            {city}
          </div>
        </div>
      </figcaption>
    </figure>
  );
}
