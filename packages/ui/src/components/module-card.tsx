import * as React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { cn } from '../lib/cn';
import { Badge } from './badge';

export interface ModuleCardProps {
  href: string;
  name: string;
  tagline: string;
  icon?: React.ReactNode;
  pricingLabel?: string;
  statusLabel?: 'live' | 'beta' | 'comingSoon' | null;
  statusText?: string;
  className?: string;
}

/**
 * The card rendered on the landing page for every product_module row.
 * Pure presentational — all copy comes from the DB i18n fields via `resolveI18n`.
 */
export function ModuleCard({
  href,
  name,
  tagline,
  icon,
  pricingLabel,
  statusLabel,
  statusText,
  className,
}: ModuleCardProps) {
  const statusTone = statusLabel === 'live' ? 'success' : statusLabel === 'beta' ? 'primary' : 'neutral';
  return (
    <Link
      href={href}
      className={cn(
        'group relative flex h-full flex-col justify-between rounded-lg border border-border bg-card p-6 shadow-card transition hover:border-primary/40 hover:shadow-floating',
        className,
      )}
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="flex size-10 items-center justify-center rounded-md bg-primary-subtle text-primary">
            {icon}
          </div>
          <div className="flex flex-col items-end gap-1">
            {pricingLabel ? <Badge tone="accent">{pricingLabel}</Badge> : null}
            {statusLabel && statusText ? <Badge tone={statusTone}>{statusText}</Badge> : null}
          </div>
        </div>
        <h3 className="mt-4 text-lg font-semibold tracking-tight text-ink">{name}</h3>
        <p className="mt-2 text-sm text-ink-muted">{tagline}</p>
      </div>
      <div className="mt-6 flex items-center gap-1.5 text-sm font-medium text-primary">
        <span className="transition group-hover:translate-x-0.5">Explore</span>
        <ArrowRight className="size-4 transition group-hover:translate-x-1" />
      </div>
    </Link>
  );
}
