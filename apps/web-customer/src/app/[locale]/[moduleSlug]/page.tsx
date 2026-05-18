import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react';
import { Badge, buttonVariants } from '@suraksha/ui';
import { resolveI18n } from '@suraksha/i18n';
import { loadModuleBySlug } from '@/lib/modules';
import { iconFor } from '@/lib/icon-map';
import { MODULE_PAGES } from '@/content/module-pages';
import { WaitlistForm, WaitlistPrivacyNote } from '@/components/waitlist-form';
import { ChapterSection, Eyebrow } from '@/components/marketing/chapter-section';
import { GradientHeadline } from '@/components/marketing/gradient-headline';
import { TrustStrip } from '@/components/marketing/trust-strip';
import { cn } from '@/lib/cn';

interface Props {
  params: Promise<{ locale: string; moduleSlug: string }>;
}

export const revalidate = 300;

/**
 * Single-module marketing page. Composed of ChapterSections the same way as
 * the root landing so the visual rhythm carries through. Status-aware: live
 * modules push Analyse/Start CTAs, wip modules push the waitlist form.
 */
export default async function ModulePage({ params }: Props) {
  const { locale, moduleSlug } = await params;
  const mod = await loadModuleBySlug(moduleSlug);
  if (!mod) notFound();

  const t = await getTranslations();
  const Icon = iconFor(mod.iconSlug);
  const copyForLocale = MODULE_PAGES[moduleSlug];
  const copy = copyForLocale
    ? copyForLocale[locale as 'en' | 'hi' | 'kn'] ?? copyForLocale.en
    : null;

  const isLive = mod.status === 'live' || mod.status === 'beta';
  const statusKey = isLive ? mod.status : 'comingSoon';
  const statusText =
    statusKey === 'live'
      ? t('common.status.live')
      : statusKey === 'beta'
        ? t('common.status.beta')
        : t('common.status.comingSoon');
  const pricingLabel =
    mod.pricingModel === 'free'
      ? t('common.pricing.freeLabel')
      : mod.pricingModel === 'success_fee'
        ? t('common.pricing.successFeeLabel')
        : mod.pricingModel === 'subscription'
          ? t('common.pricing.subscriptionLabel')
          : t('common.pricing.paidLabel');

  const liveActionHref = moduleSlug === 'policy-health-score'
    ? `/${locale}/policy-health-score/analyse`
    : `/${locale}/${moduleSlug}`;

  return (
    <>
      {/* ───────── Hero ───────── */}
      <ChapterSection weight="hero">
        <Link
          href={`/${locale}`}
          className="mb-10 inline-flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-ink"
        >
          <ArrowLeft className="size-4" aria-hidden />
          {t('common.cta.backToAll')}
        </Link>

        <div className="grid gap-16 lg:grid-cols-[1.15fr_1fr] lg:items-start">
          <div>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="size-6" aria-hidden />
              </div>
              <Eyebrow>{resolveI18n(mod.nameI18n, locale)}</Eyebrow>
            </div>

            <GradientHeadline
              emphasis={pickEmphasis(locale)}
              size="hero"
              as="h1"
            >
              {resolveI18n(mod.heroHeadlineI18n, locale)}
            </GradientHeadline>

            <p className="mt-6 max-w-[52ch] text-lg leading-relaxed text-ink-muted sm:text-xl">
              {resolveI18n(mod.heroSubheadI18n, locale)}
            </p>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Badge tone={isLive ? 'success' : 'neutral'}>{statusText}</Badge>
              <Badge tone="accent">{pricingLabel}</Badge>
            </div>

            {isLive ? (
              <div className="mt-10">
                <Link
                  href={liveActionHref}
                  className={cn(
                    buttonVariants({ variant: 'primary', size: 'lg' }),
                    'inline-flex items-center gap-1.5',
                  )}
                >
                  {t('common.cta.startFree')}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>
            ) : null}
          </div>

          {/* Waitlist card — cream aside on hero */}
          <aside className="rounded-3xl border border-border bg-card p-7 shadow-card">
            <Eyebrow>
              {isLive
                ? locale === 'hi'
                  ? 'जल्द ही लाइव'
                  : locale === 'kn'
                    ? 'ಶೀಘ್ರದಲ್ಲೇ ಲೈವ್'
                    : 'Launching shortly'
                : t('common.cta.joinWaitlist')}
            </Eyebrow>
            <h2 className="mt-3 font-display text-xl font-semibold text-ink">
              {copy?.launchNote ?? resolveI18n(mod.taglineI18n, locale)}
            </h2>
            <div className="mt-5">
              <WaitlistForm
                moduleSlug={moduleSlug}
                moduleName={resolveI18n(mod.nameI18n, locale)}
              />
              <WaitlistPrivacyNote />
            </div>
          </aside>
        </div>
      </ChapterSection>

      {copy ? (
        <>
          {/* ───────── The problem — dark editorial ───────── */}
          <ChapterSection variant="dark">
            <div className="mb-14 max-w-3xl">
              <Eyebrow tone="dark">
                {locale === 'hi' ? 'समस्या' : locale === 'kn' ? 'ಸಮಸ್ಯೆ' : 'The problem'}
              </Eyebrow>
              <GradientHeadline
                size="section"
                as="h2"
                tone="dark"
                emphasis={problemEmphasis(locale)}
                className="mt-6"
              >
                {problemTitle(locale)}
              </GradientHeadline>
            </div>

            <ol className="grid gap-8 md:grid-cols-3">
              {copy.problem.map((p, i) => (
                <li
                  key={i}
                  className="rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur"
                >
                  <span className="font-display text-3xl font-semibold tabular-nums text-accent">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="mt-4 text-base leading-relaxed text-white/80">{p}</p>
                </li>
              ))}
            </ol>
          </ChapterSection>

          {/* ───────── What you'll get ───────── */}
          <ChapterSection>
            <div className="mb-14 max-w-3xl">
              <Eyebrow>{youllGetTitle(locale).eyebrow}</Eyebrow>
              <GradientHeadline
                size="section"
                as="h2"
                emphasis={youllGetTitle(locale).emphasis}
                className="mt-6"
              >
                {youllGetTitle(locale).headline}
              </GradientHeadline>
            </div>

            <ul className="grid gap-4 md:grid-cols-2">
              {copy.whatYoullGet.map((b, i) => (
                <li
                  key={i}
                  className="flex items-start gap-3 rounded-2xl border border-border bg-card p-6 shadow-card"
                >
                  <CheckCircle2 className="mt-0.5 size-5 flex-none text-primary" aria-hidden />
                  <p className="text-base leading-relaxed text-ink">{b}</p>
                </li>
              ))}
            </ul>
          </ChapterSection>

          {/* ───────── How it works ───────── */}
          <ChapterSection variant="dark">
            <div className="grid gap-14 lg:grid-cols-[1fr_1.2fr] lg:items-start">
              <div>
                <Eyebrow tone="dark">
                  {locale === 'hi'
                    ? 'कैसे काम करता है'
                    : locale === 'kn'
                      ? 'ಹೇಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆ'
                      : 'How it works'}
                </Eyebrow>
                <GradientHeadline
                  size="section"
                  as="h2"
                  tone="dark"
                  emphasis={howItWorksEmphasis(locale)}
                  className="mt-6"
                >
                  {howItWorksHeadline(locale)}
                </GradientHeadline>
              </div>

              <ol className="space-y-5">
                {copy.howItWorks.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-5 rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur"
                  >
                    <span className="font-display text-3xl font-semibold tabular-nums text-accent">
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <div className="font-display text-lg font-semibold text-white">
                        {s.heading}
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-white/70">{s.body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </ChapterSection>

          {/* ───────── Who it's for ───────── */}
          <ChapterSection>
            <div className="mb-14 max-w-3xl">
              <Eyebrow>
                {locale === 'hi'
                  ? 'किसके लिए'
                  : locale === 'kn'
                    ? 'ಯಾರಿಗಾಗಿ'
                    : 'Who it\'s for'}
              </Eyebrow>
              <GradientHeadline
                size="section"
                as="h2"
                emphasis={whoItsForEmphasis(locale)}
                className="mt-6"
              >
                {whoItsForHeadline(locale)}
              </GradientHeadline>
            </div>

            <ul className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {copy.whoItsFor.map((p, i) => (
                <li
                  key={i}
                  className="rounded-2xl border border-border bg-card p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-floating"
                >
                  <h3 className="font-display text-lg font-semibold text-ink">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-muted">{p.body}</p>
                </li>
              ))}
            </ul>
          </ChapterSection>

          {/* ───────── FAQ ───────── */}
          <ChapterSection>
            <div className="mb-10 max-w-3xl">
              <Eyebrow>
                {locale === 'hi'
                  ? 'सवाल–जवाब'
                  : locale === 'kn'
                    ? 'ಪ್ರಶ್ನೋತ್ತರ'
                    : 'Your questions'}
              </Eyebrow>
            </div>
            <dl className="divide-y divide-border rounded-3xl border border-border bg-card shadow-card">
              {copy.faqs.map((f, i) => (
                <details key={i} className="group px-6 py-5 sm:px-8">
                  <summary className="flex cursor-pointer list-none items-start justify-between gap-6 font-display text-lg font-medium text-ink">
                    <dt>{f.q}</dt>
                    <span className="mt-1 flex-none text-2xl leading-none text-ink-muted transition-transform group-open:rotate-45">
                      +
                    </span>
                  </summary>
                  <dd className="mt-3 max-w-prose text-sm leading-relaxed text-ink-muted">
                    {f.a}
                  </dd>
                </details>
              ))}
            </dl>
          </ChapterSection>
        </>
      ) : (
        <ChapterSection>
          <p className="max-w-prose text-ink-muted">
            {locale === 'hi'
              ? 'यहाँ ज़्यादा जानकारी जल्द ही जोड़ी जाएगी।'
              : locale === 'kn'
                ? 'ಹೆಚ್ಚಿನ ಮಾಹಿತಿ ಶೀಘ್ರದಲ್ಲೇ ಇಲ್ಲಿ ಸೇರಿಸಲಾಗುವುದು.'
                : 'More details coming to this page soon.'}
          </p>
        </ChapterSection>
      )}

      {/* ───────── Trust strip ───────── */}
      <ChapterSection variant="dark">
        <div className="mb-12 max-w-3xl">
          <Eyebrow tone="dark">
            {locale === 'hi'
              ? 'जो हम नहीं करते'
              : locale === 'kn'
                ? 'ನಾವು ಏನು ಮಾಡುವುದಿಲ್ಲ'
                : 'What we don\'t do'}
          </Eyebrow>
        </div>
        <TrustStrip tone="dark" />
      </ChapterSection>

      {/* ───────── Closing CTA ───────── */}
      <ChapterSection variant="primary">
        <div className="flex flex-col items-start gap-8 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {isLive ? t('common.cta.startFree') : t('common.cta.joinWaitlist')}
            </h3>
            <p className="mt-3 max-w-prose text-white/80">
              {copy?.launchNote ?? resolveI18n(mod.taglineI18n, locale)}
            </p>
          </div>
          <Link
            href={isLive ? liveActionHref : `/${locale}`}
            className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-7 py-3.5 text-base font-semibold text-primary shadow-floating transition hover:-translate-y-0.5"
          >
            {isLive ? t('common.cta.startFree') : t('common.cta.backToAll')}
            <ArrowRight className="size-4" aria-hidden />
          </Link>
        </div>
      </ChapterSection>
    </>
  );
}

/* ───────── Headline emphasis words (localised) ───────── */

function pickEmphasis(locale: string): string {
  if (locale === 'hi') return 'सच';
  if (locale === 'kn') return 'ಸತ್ಯ';
  return 'truth';
}
function problemEmphasis(locale: string): string {
  if (locale === 'hi') return 'छिपा';
  if (locale === 'kn') return 'ಮರೆಮಾಡಲಾಗಿದೆ';
  return 'hidden';
}
function problemTitle(locale: string): string {
  if (locale === 'hi') return 'यहाँ क्या छिपा है जो बाज़ार आपको नहीं बताएगा।';
  if (locale === 'kn') return 'ಮಾರುಕಟ್ಟೆ ಹೇಳದ, ಇಲ್ಲಿ ಮರೆಮಾಡಲಾಗಿದೆ.';
  return "Here's what's hidden — and why the market won't tell you.";
}

function youllGetTitle(locale: string): { eyebrow: string; emphasis: string; headline: string } {
  if (locale === 'hi')
    return { eyebrow: 'क्या मिलेगा', emphasis: 'साफ', headline: 'साफ़ जवाब, भाषा जो समझ में आए।' };
  if (locale === 'kn')
    return {
      eyebrow: 'ನಿಮಗೆ ಏನು ಸಿಗುತ್ತದೆ',
      emphasis: 'ಸ್ಪಷ್ಟ',
      headline: 'ಸ್ಪಷ್ಟ ಉತ್ತರಗಳು, ಅರ್ಥಮಾಡಿಕೊಳ್ಳಬಹುದಾದ ಭಾಷೆ.',
    };
  return {
    eyebrow: "What you'll get",
    emphasis: 'clear answers',
    headline: 'Clear answers, in language you actually recognise.',
  };
}

function howItWorksEmphasis(locale: string): string {
  if (locale === 'hi') return 'दो मिनट';
  if (locale === 'kn') return 'ಎರಡು ನಿಮಿಷ';
  return 'two minutes';
}
function howItWorksHeadline(locale: string): string {
  if (locale === 'hi') return 'दो मिनट में — कोई फ़ॉर्म नहीं, कोई एजेंट नहीं।';
  if (locale === 'kn') return 'ಎರಡು ನಿಮಿಷದಲ್ಲಿ — ಫಾರ್ಮ್ ಇಲ್ಲ, ಏಜೆಂಟ್ ಇಲ್ಲ.';
  return 'In two minutes — no forms, no agents, no waiting.';
}

function whoItsForEmphasis(locale: string): string {
  if (locale === 'hi') return 'कोई भी';
  if (locale === 'kn') return 'ಯಾರಾದರೂ';
  return 'anyone';
}
function whoItsForHeadline(locale: string): string {
  if (locale === 'hi') return 'किसी के लिए भी जिसने बारीक अक्षर कभी नहीं पढ़े।';
  if (locale === 'kn') return 'ಬಾರೀಕ ಅಕ್ಷರಗಳನ್ನು ಓದದ ಯಾರಾದರೂ.';
  return "For anyone who's never read the fine print — which is most of us.";
}
