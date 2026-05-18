import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowLeft, Quote } from 'lucide-react';

/**
 * Split-screen auth frame. Left: the form (rendered by the caller). Right:
 * a dark warm-navy panel with a testimonial + ambient glow. The panel
 * collapses to a thin band above the form on mobile so the form remains the
 * hero on small screens.
 */

interface Props {
  locale: string;
  children: ReactNode;
  pitch: {
    eyebrow: string;
    headline: string;
    body: string;
    quote: string;
    quoteAttribution: string;
  };
}

export function AuthSplit({ locale, children, pitch }: Props) {
  return (
    <div className="grid min-h-[calc(100vh-4rem)] grid-cols-1 bg-background lg:grid-cols-[1.05fr_1fr]">
      {/* Form column */}
      <div className="flex min-h-full flex-col">
        <header className="px-6 pt-6 sm:px-10">
          <Link
            href={`/${locale}`}
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-ink"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to home
          </Link>
        </header>
        <div className="flex flex-1 items-center px-6 py-12 sm:px-10">
          <div className="mx-auto w-full max-w-md">{children}</div>
        </div>
      </div>

      {/* Pitch column — dark panel */}
      <aside className="relative order-first hidden overflow-hidden bg-ink-deep lg:order-last lg:block">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-warm-dawn opacity-80"
        />
        <div className="relative flex h-full flex-col justify-between p-12 text-white xl:p-16">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.25em] text-accent">
              <span className="h-px w-8 bg-accent/60" aria-hidden />
              {pitch.eyebrow}
            </div>
            <h2 className="mt-6 font-display text-4xl font-semibold leading-[1.05] tracking-tight text-white sm:text-5xl">
              {pitch.headline}
            </h2>
            <p className="mt-4 max-w-[38ch] text-base leading-relaxed text-white/70">
              {pitch.body}
            </p>
          </div>

          <figure className="mt-16 rounded-2xl border border-white/10 bg-white/5 p-7 backdrop-blur">
            <Quote className="size-5 text-accent" aria-hidden />
            <blockquote className="mt-4 font-display text-xl leading-snug text-white">
              {pitch.quote}
            </blockquote>
            <figcaption className="mt-4 text-xs uppercase tracking-[0.2em] text-accent">
              {pitch.quoteAttribution}
            </figcaption>
          </figure>
        </div>
      </aside>
    </div>
  );
}
