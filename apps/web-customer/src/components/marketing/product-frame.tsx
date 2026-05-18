import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/**
 * Chromed frame around a product screenshot — shows "the app is real" without
 * forcing us to stitch real images into a hero photo. Two variants:
 *
 *   chrome='phone'   — rounded phone bezel. Best for chat/mobile-first UI.
 *   chrome='browser' — browser window with traffic-light dots + URL bar.
 *                      Best for showing the report page, dashboard, etc.
 *
 * Pass whatever you want inside — a static JSX mock, a screenshot <img>, or
 * a live component fragment. The frame is purely presentational.
 */

interface Props {
  children: ReactNode;
  chrome?: 'phone' | 'browser';
  url?: string;
  className?: string;
  /** Floating-card treatment with subtle rotation for landing pages. */
  tilt?: boolean;
}

export function ProductFrame({
  children,
  chrome = 'browser',
  url,
  className,
  tilt,
}: Props) {
  if (chrome === 'phone') {
    return (
      <div
        className={cn(
          'relative mx-auto w-full max-w-sm',
          tilt && 'rotate-2 hover:rotate-0 transition-transform duration-500',
          className,
        )}
      >
        <div className="overflow-hidden rounded-[2.5rem] border border-ink-deep/20 bg-ink-deep p-3 shadow-floating">
          <div className="relative overflow-hidden rounded-[2rem] bg-background">
            <div
              aria-hidden
              className="absolute left-1/2 top-2 z-10 h-5 w-28 -translate-x-1/2 rounded-b-xl bg-ink-deep"
            />
            <div className="pt-8">{children}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative w-full',
        tilt && '-rotate-1 hover:rotate-0 transition-transform duration-500',
        className,
      )}
    >
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-floating">
        {/* Browser chrome */}
        <div className="flex items-center gap-3 border-b border-border bg-background/80 px-4 py-2.5">
          <div className="flex gap-1.5">
            <span aria-hidden className="size-3 rounded-full bg-danger/70" />
            <span aria-hidden className="size-3 rounded-full bg-warn/70" />
            <span aria-hidden className="size-3 rounded-full bg-success/70" />
          </div>
          {url && (
            <div className="flex-1 truncate rounded-md border border-border bg-card px-2.5 py-1 text-center text-[11px] font-mono text-ink-subtle">
              {url}
            </div>
          )}
        </div>
        <div className="bg-background">{children}</div>
      </div>
    </div>
  );
}
