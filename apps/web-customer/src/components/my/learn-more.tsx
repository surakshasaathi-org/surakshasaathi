'use client';

import { useEffect, useRef, useState } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { GLOSSARY } from './policy-glossary';

/**
 * Inline "What's this?" trigger — sits next to a section heading as a small
 * help icon. On click, expands a popover with the glossary entry for the
 * given key. Dismisses on escape / outside click. Deliberately simple: no
 * portals, no overlays — the popover anchors to the button and layers on top.
 */
interface Props {
  termKey: keyof typeof GLOSSARY;
  /** Visible label the user clicks. Defaults to "What's this?" */
  label?: string;
  /** Compact icon-only variant for tight contexts. */
  iconOnly?: boolean;
}

export function LearnMore({ termKey, label = "What's this?", iconOnly }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const entry = GLOSSARY[termKey];

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (!entry) return null;

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border border-border/80 bg-background px-2 py-0.5 text-[11px] font-medium text-ink-muted transition hover:border-primary/50 hover:text-primary',
          open && 'border-primary/60 bg-primary/5 text-primary',
          iconOnly && 'px-1 py-1',
        )}
      >
        <HelpCircle className="size-3" />
        {!iconOnly && <span className="whitespace-nowrap">{label}</span>}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label={entry.title}
          className="absolute left-0 top-[calc(100%+0.5rem)] z-30 w-[min(22rem,calc(100vw-2rem))] rounded-2xl border border-border bg-card p-5 text-sm shadow-floating"
        >
          <div className="flex items-start justify-between gap-3">
            <h4 className="font-display text-base font-semibold text-ink">{entry.title}</h4>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="-m-1 rounded p-1 text-ink-muted hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-subtle">{entry.short}</p>

          <div className="mt-4 space-y-3 text-sm leading-relaxed text-ink-muted">
            {entry.body.map((p, i) =>
              typeof p === 'string' ? (
                <p key={i} className="whitespace-pre-line">
                  {p}
                </p>
              ) : (
                <p
                  key={i}
                  className="rounded-lg border-l-4 border-primary bg-primary/5 px-3 py-2 text-sm font-medium text-ink"
                >
                  {p.em}
                </p>
              ),
            )}
          </div>

          {entry.example && (
            <div className="mt-4 rounded-lg bg-background/60 p-3 text-xs">
              <div className="mb-1 font-semibold uppercase tracking-wider text-ink-subtle">
                Example
              </div>
              <p className="leading-relaxed text-ink-muted">{entry.example}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
