'use client';

import * as React from 'react';
import { Globe } from 'lucide-react';
import { cn } from '../lib/cn';

export interface LocaleOption {
  code: string;
  label: string; // native script
}

export interface LocaleToggleProps {
  options: LocaleOption[];
  current: string;
  onSelect: (code: string) => void;
  className?: string;
}

/**
 * Prominent, immediately-visible language toggle. Required above the fold by
 * the landing-page spec (CLAUDE.md section 9).
 */
export function LocaleToggle({ options, current, onSelect, className }: LocaleToggleProps) {
  return (
    <div className={cn('inline-flex items-center gap-1 rounded-md border border-border bg-card p-1', className)}>
      <Globe className="ml-2 size-4 text-ink-muted" aria-hidden />
      {options.map((opt) => (
        <button
          key={opt.code}
          type="button"
          onClick={() => onSelect(opt.code)}
          aria-pressed={opt.code === current}
          className={cn(
            'rounded px-2.5 py-1 text-xs font-medium transition',
            opt.code === current
              ? 'bg-primary text-primary-foreground'
              : 'text-ink-muted hover:text-ink',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
