import Link from 'next/link';
import { ArrowRight, Clock } from 'lucide-react';
import { Badge } from '@suraksha/ui';
import { resolveI18n } from '@suraksha/i18n';
import { iconFor } from '@/lib/icon-map';
import { cn } from '@/lib/cn';
import type { Moment } from '@/content/moments';

export interface MomentsChapterProps {
  chapter: {
    label: string;      // "Before" / "दौरान" etc.
    title: string;
    subtitle: string;
  };
  moments: Moment[];
  locale: string;
  statusLabels: { live: string; beta: string; comingSoon: string };
  ctaLiveLabel: string;
  ctaComingLabel: string;
  accentTone: 'primary' | 'accent' | 'success';
}

export function MomentsChapter({
  chapter,
  moments,
  locale,
  statusLabels,
  ctaLiveLabel,
  ctaComingLabel,
  accentTone,
}: MomentsChapterProps) {
  if (moments.length === 0) return null;

  return (
    <div className="py-14 first:pt-0">
      <div className="mb-2 flex items-center gap-3">
        <span
          className={cn(
            'inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider',
            accentTone === 'primary'
              ? 'bg-primary-subtle text-primary'
              : accentTone === 'accent'
                ? 'bg-accent/15 text-accent-foreground'
                : 'bg-success-subtle text-success',
          )}
        >
          {chapter.label}
        </span>
      </div>
      <h3 className="max-w-2xl font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
        {chapter.title}
      </h3>
      <p className="mt-3 max-w-2xl text-ink-muted">{chapter.subtitle}</p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {moments.map((m) => {
          const Icon = iconFor(m.iconSlug);
          const isLive = m.status === 'live' || m.status === 'beta';
          const statusText =
            m.status === 'live'
              ? statusLabels.live
              : m.status === 'beta'
                ? statusLabels.beta
                : statusLabels.comingSoon;
          const href = m.href ?? `/${locale}/${m.moduleSlug}`;
          const cta = isLive ? ctaLiveLabel : ctaComingLabel;

          return (
            <Link
              key={m.id}
              href={href}
              className={cn(
                'group flex h-full flex-col rounded-2xl border bg-card p-6 shadow-card transition',
                isLive
                  ? 'border-border hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-floating'
                  : 'border-dashed border-border/70 hover:border-ink-muted/60',
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
                {isLive ? (
                  <Badge tone="success">{statusText}</Badge>
                ) : (
                  <Badge tone="neutral">
                    <Clock className="mr-1 size-3" aria-hidden />
                    {statusText}
                  </Badge>
                )}
              </div>

              <h4
                className={cn(
                  'mt-4 text-base font-semibold leading-snug',
                  isLive ? 'text-ink' : 'text-ink-muted',
                )}
              >
                {resolveI18n(m.titleI18n, locale)}
              </h4>
              <p className="mt-2 text-sm text-ink-muted">{resolveI18n(m.bodyI18n, locale)}</p>

              <div className="mt-5 flex items-center gap-1.5 text-sm font-medium">
                <span className={isLive ? 'text-primary' : 'text-ink-muted'}>{cta}</span>
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
    </div>
  );
}
