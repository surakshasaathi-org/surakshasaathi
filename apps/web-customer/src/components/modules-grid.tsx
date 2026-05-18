import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { Badge, buttonVariants } from '@suraksha/ui';
import type { ProductModule } from '@suraksha/types';
import { resolveI18n } from '@suraksha/i18n';
import { iconFor } from '@/lib/icon-map';
import { cn } from '@/lib/cn';

export interface ModulesGridProps {
  modules: ProductModule[];
  locale: string;
  liveCtaLabel: string;
  waitlistCtaLabel: string;
  statusLabels: { live: string; beta: string; comingSoon: string };
  pricingLabels: { free: string; paid: string; successFee: string; subscription: string };
}

export function ModulesGrid({
  modules,
  locale,
  liveCtaLabel,
  waitlistCtaLabel,
  statusLabels,
  pricingLabels,
}: ModulesGridProps) {
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {modules.map((m) => {
        const Icon = iconFor(m.iconSlug);
        const isLive = m.status === 'live' || m.status === 'beta';
        const statusKey = isLive ? m.status : 'comingSoon';
        const statusText =
          statusKey === 'live' ? statusLabels.live : statusKey === 'beta' ? statusLabels.beta : statusLabels.comingSoon;
        const pricingLabel =
          m.pricingModel === 'free'
            ? pricingLabels.free
            : m.pricingModel === 'success_fee'
              ? pricingLabels.successFee
              : m.pricingModel === 'subscription'
                ? pricingLabels.subscription
                : pricingLabels.paid;

        const ctaLabel = isLive ? liveCtaLabel : waitlistCtaLabel;
        const href = `/${locale}${m.landingRoute}`;

        return (
          <Link
            key={m.id}
            href={href}
            className={cn(
              'group relative flex h-full flex-col rounded-lg border bg-card p-6 shadow-card transition',
              isLive
                ? 'border-border hover:border-primary/50 hover:shadow-floating'
                : 'border-dashed border-border/80 hover:border-ink-muted/60',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div
                className={cn(
                  'flex size-10 items-center justify-center rounded-md',
                  isLive ? 'bg-primary-subtle text-primary' : 'bg-ink/5 text-ink-muted',
                )}
              >
                <Icon className="size-5" aria-hidden />
              </div>
              <div className="flex flex-col items-end gap-1">
                {isLive ? (
                  <Badge tone="success">{statusText}</Badge>
                ) : (
                  <Badge tone="neutral">
                    <Clock className="mr-1 size-3" aria-hidden />
                    {statusText}
                  </Badge>
                )}
                <Badge tone={isLive ? 'accent' : 'neutral'}>{pricingLabel}</Badge>
              </div>
            </div>

            <h3
              className={cn(
                'mt-5 font-display text-lg font-semibold tracking-tight',
                isLive ? 'text-ink' : 'text-ink-muted',
              )}
            >
              {resolveI18n(m.nameI18n, locale)}
            </h3>
            <p className="mt-2 text-sm text-ink-muted">{resolveI18n(m.taglineI18n, locale)}</p>

            <div className="mt-6 flex items-center gap-1.5 text-sm font-medium">
              <span className={isLive ? 'text-primary' : 'text-ink-muted'}>{ctaLabel}</span>
              <ArrowRight
                className={cn(
                  'size-4 transition',
                  isLive ? 'text-primary group-hover:translate-x-1' : 'text-ink-muted',
                )}
                aria-hidden
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
