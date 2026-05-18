import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Full-bleed alternating-background section container. Marketing pages stack
 * these to create visual rhythm — cream baseline interspersed with warm-navy
 * dark panels. Vertical breathing room is generous on purpose; editorial
 * pages earn the whitespace.
 *
 *   variant='cream' (default) — on the warm background.
 *   variant='dark'            — ink-deep navy with cream text. Use sparingly.
 *   variant='primary'         — terracotta fill; for closing CTAs only.
 */

interface Props {
  children: ReactNode;
  variant?: 'cream' | 'dark' | 'primary';
  id?: string;
  /** Extra top/bottom padding for hero-weight sections. */
  weight?: 'regular' | 'hero';
  className?: string;
}

export function ChapterSection({
  children,
  variant = 'cream',
  id,
  weight = 'regular',
  className,
}: Props) {
  return (
    <section
      id={id}
      className={cn(
        'relative overflow-hidden',
        weight === 'hero' ? 'py-24 sm:py-32' : 'py-20 sm:py-28',
        variant === 'cream' && 'bg-background text-ink',
        variant === 'dark' && 'bg-ink-deep text-white',
        variant === 'primary' && 'bg-primary text-primary-foreground',
        className,
      )}
    >
      {variant === 'dark' && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-0 bg-warm-dawn opacity-60"
        />
      )}
      <div className="relative mx-auto max-w-6xl px-5 sm:px-8">{children}</div>
    </section>
  );
}

/**
 * Dark-panel-safe eyebrow — inverts color based on parent variant via a
 * simple `tone` prop. Use `tone='dark'` inside a ChapterSection variant='dark'.
 */
export function Eyebrow({
  children,
  tone = 'light',
  className,
}: {
  children: ReactNode;
  tone?: 'light' | 'dark';
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em]',
        tone === 'light' ? 'text-primary' : 'text-accent',
        className,
      )}
    >
      <span
        className={cn(
          'h-px w-8',
          tone === 'light' ? 'bg-primary/60' : 'bg-accent/60',
        )}
      />
      {children}
    </span>
  );
}
