import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Editorial-style statistic — a huge display number with a single journalistic
 * sentence beside. Not a card. Used to anchor sections and let one number do
 * the emotional work, then the prose says what it means.
 *
 *   <StatDisplay
 *     value="80%"
 *     sentence="of Indian health-insurance claims are rejected on technicalities most families never read."
 *   />
 */

interface Props {
  value: string;
  /** Small label above the number (e.g. "IRDAI 2024 data"). */
  source?: string;
  sentence: ReactNode;
  tone?: 'light' | 'dark';
  align?: 'left' | 'right';
}

export function StatDisplay({
  value,
  source,
  sentence,
  tone = 'light',
  align = 'left',
}: Props) {
  return (
    <figure
      className={cn(
        'grid items-end gap-6 sm:gap-10',
        'sm:grid-cols-[minmax(auto,max-content)_1fr]',
        align === 'right' && 'sm:grid-cols-[1fr_minmax(auto,max-content)]',
      )}
    >
      <div
        className={cn(
          'order-1 min-w-0',
          align === 'right' && 'sm:order-2 sm:text-right',
        )}
      >
        {source && (
          <div
            className={cn(
              'mb-2 text-[11px] font-medium uppercase tracking-[0.3em]',
              tone === 'light' ? 'text-ink-subtle' : 'text-ink-deep-muted',
            )}
          >
            {source}
          </div>
        )}
        <div
          className={cn(
            'font-display font-semibold leading-none tracking-tighter',
            'text-[clamp(4.5rem,10vw,8rem)]',
            tone === 'light' ? 'text-ink' : 'text-white',
          )}
        >
          {value}
        </div>
      </div>
      <blockquote
        className={cn(
          'order-2 font-display text-xl leading-snug',
          'sm:text-2xl',
          align === 'right' && 'sm:order-1',
          tone === 'light' ? 'text-ink-muted' : 'text-white/80',
        )}
      >
        {sentence}
      </blockquote>
    </figure>
  );
}
