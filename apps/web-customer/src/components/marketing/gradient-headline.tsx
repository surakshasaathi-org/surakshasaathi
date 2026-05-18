import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Display heading primitive. Wraps a single word or phrase with a warm
 * gradient underline — a simple device that adds editorial weight without
 * leaning on decorative art. Works on both cream and dark backgrounds.
 *
 *   <GradientHeadline emphasis="what's covered">
 *     Know what's covered before you pay the premium.
 *   </GradientHeadline>
 *
 * To render the emphasis word mid-sentence, pass the whole sentence as children
 * and the emphasised slice as `emphasis` — the component finds the first
 * occurrence and splits.
 */

interface Props {
  children: string;
  emphasis?: string;
  tone?: 'light' | 'dark';
  as?: 'h1' | 'h2' | 'h3';
  size?: 'hero' | 'section' | 'default';
  className?: string;
}

export function GradientHeadline({
  children,
  emphasis,
  tone = 'light',
  as: Tag = 'h1',
  size = 'hero',
  className,
}: Props) {
  const sizeClass =
    size === 'hero'
      ? 'text-hero'
      : size === 'section'
        ? 'text-section-hero'
        : 'text-4xl sm:text-5xl md:text-6xl';

  const classes = cn(
    'font-display font-semibold tracking-tight',
    sizeClass,
    tone === 'light' ? 'text-ink' : 'text-white',
    className,
  );

  if (!emphasis) return <Tag className={classes}>{children}</Tag>;

  const idx = children.toLowerCase().indexOf(emphasis.toLowerCase());
  if (idx === -1) return <Tag className={classes}>{children}</Tag>;

  const before = children.slice(0, idx);
  const match = children.slice(idx, idx + emphasis.length);
  const after = children.slice(idx + emphasis.length);

  return (
    <Tag className={classes}>
      {before}
      <EmphasisSlice tone={tone}>{match}</EmphasisSlice>
      {after}
    </Tag>
  );
}

function EmphasisSlice({
  children,
  tone,
}: {
  children: ReactNode;
  tone: 'light' | 'dark';
}) {
  return (
    <span className="relative inline-block whitespace-nowrap">
      <span
        className={cn(
          'relative z-10',
          tone === 'light'
            ? 'bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent'
            : 'bg-gradient-to-r from-accent to-warn bg-clip-text text-transparent',
        )}
      >
        {children}
      </span>
      <span
        aria-hidden
        className={cn(
          'absolute -bottom-1 left-0 right-0 h-[0.35em] rounded-sm',
          tone === 'light' ? 'bg-primary/15' : 'bg-accent/20',
        )}
      />
    </span>
  );
}
