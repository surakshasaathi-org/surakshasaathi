import * as React from 'react';
import { cn } from '../lib/cn';

export interface StatChipProps {
  value: string;
  label: string;
  className?: string;
}

export function StatChip({ value, label, className }: StatChipProps) {
  return (
    <div className={cn('rounded-md border border-border bg-card p-4 text-center shadow-card', className)}>
      <div className="font-display text-2xl font-semibold tracking-tight text-primary">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-ink-muted">{label}</div>
    </div>
  );
}
