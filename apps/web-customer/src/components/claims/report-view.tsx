import Link from 'next/link';
import { AlertTriangle, CheckCircle2, Circle, Clock, Share2, Trash2, FileDown, ArrowRight } from 'lucide-react';
import { Badge, Button, buttonVariants } from '@suraksha/ui';
import type { AnalysisReport, RedFlag } from '@/server/analyse/demo-report';
import { cn } from '@/lib/cn';

interface Props {
  report: AnalysisReport;
  analysisId: string;
  locale: string;
  createdAt: string;
  expiresAt: string;
  costPaise: number;
  strings: ReportLocaleStrings;
}

export interface ReportLocaleStrings {
  readinessScore: string;
  readinessOutOf: string;
  dimensions: {
    coverage_adequacy: string;
    exclusions_and_gaps: string;
    waiting_period_clearance: string;
    nominee_accuracy: string;
    documentation_completeness: string;
  };
  sectionTitles: {
    quick: string;
    basics: string;
    covered: string;
    excluded: string;
    waiting: string;
    limits: string;
    copay: string;
    flags: string;
    readiness: string;
    actions: string;
  };
  labels: {
    yes: string;
    no: string;
    withConditions: string;
    share: string;
    download: string;
    deleteNow: string;
    expiresIn: string;
    days: string;
    surprising: string;
    nextMoment: string;
    severityHigh: string;
    severityMed: string;
    severityLow: string;
    urgencyToday: string;
    urgencyMonth: string;
    urgencyOptional: string;
    confidence: string;
    source: string;
    insurer: string;
    plan: string;
    policyNumber: string;
    sumAssured: string;
    premium: string;
    period: string;
    members: string;
    nominee: string;
    network: string;
    relation: {
      self: string;
      spouse: string;
      child: string;
      father: string;
      mother: string;
    };
  };
  disclaimer: string;
}

export function ReportView({
  report,
  analysisId,
  locale,
  createdAt,
  expiresAt,
  costPaise,
  strings,
}: Props) {
  const daysLeft = Math.max(0, Math.ceil(
    (new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  ));

  return (
    <>
      {/* Header + action bar */}
      <section className="bg-gradient-to-b from-primary-subtle/50 via-background to-background pt-10 pb-6">
        <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-primary">
                {strings.sectionTitles.basics}
              </div>
              <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
                {report.basic_facts.insurer_name} · {report.basic_facts.plan_name}
              </h1>
              <div className="mt-2 text-sm text-ink-muted">
                {strings.labels.policyNumber}: {report.basic_facts.policy_number}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" disabled>
                <FileDown className="mr-1.5 size-4" />
                {strings.labels.download}
              </Button>
              <ShareButton label={strings.labels.share} locale={locale} analysisId={analysisId} />
            </div>
          </div>

          {/* Readiness hero */}
          <div className="mt-8 grid gap-6 rounded-lg border border-border bg-card p-6 shadow-card md:grid-cols-[240px_1fr]">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                {strings.readinessScore}
              </div>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="font-display text-5xl font-semibold text-primary">
                  {report.readiness_score}
                </span>
                <span className="text-sm text-ink-muted">{strings.readinessOutOf}</span>
              </div>
              <ScoreBar value={report.readiness_score} />
            </div>
            <div className="space-y-3">
              <p className="text-sm text-ink">{report.readiness_narrative}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {Object.entries(report.readiness_components).map(([k, v]) => (
                  <Dimension
                    key={k}
                    label={strings.dimensions[k as keyof typeof strings.dimensions]}
                    value={v}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-ink-subtle">
            <span className="inline-flex items-center gap-1">
              <Clock className="size-3.5" aria-hidden />
              {strings.labels.expiresIn} {daysLeft} {strings.labels.days}
            </span>
            <span>·</span>
            <span>
              {strings.labels.confidence} {Math.round(report.confidence_overall * 100)}%
            </span>
          </div>
        </div>
      </section>

      <div className="mx-auto w-full max-w-4xl px-4 sm:px-6">
        {/* 1 — Quick summary */}
        <Section title={strings.sectionTitles.quick} step={1}>
          <p className="text-base leading-relaxed text-ink">{report.quick_summary}</p>
        </Section>

        {/* 2 — Basic facts */}
        <Section title={strings.sectionTitles.basics} step={2}>
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <dl className="divide-y divide-border text-sm">
              <Row label={strings.labels.insurer} value={report.basic_facts.insurer_name} />
              <Row label={strings.labels.plan} value={report.basic_facts.plan_name} />
              <Row label={strings.labels.policyNumber} value={report.basic_facts.policy_number} />
              <Row
                label={strings.labels.sumAssured}
                value={`₹${(report.basic_facts.sum_insured_rupees / 100_000).toFixed(0)}L`}
              />
              <Row
                label={strings.labels.premium}
                value={`₹${report.basic_facts.premium_rupees.toLocaleString('en-IN')}/yr`}
              />
              <Row
                label={strings.labels.period}
                value={`${report.basic_facts.period_start} → ${report.basic_facts.period_end}`}
              />
              <Row
                label={strings.labels.members}
                value={
                  <ul className="space-y-1">
                    {report.basic_facts.members.map((m, i) => (
                      <li key={i} className="text-sm">
                        {strings.labels.relation[m.relation as keyof typeof strings.labels.relation] ??
                          m.relation}{' '}
                        · {m.age}
                        {m.pre_existing.length > 0 ? (
                          <span className="text-ink-subtle"> · {m.pre_existing.join(', ')}</span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                }
              />
              <Row
                label={strings.labels.nominee}
                value={
                  report.basic_facts.nominee_name
                    ? `${report.basic_facts.nominee_name} (${report.basic_facts.nominee_relation ?? '—'})`
                    : '—'
                }
              />
              <Row
                label={strings.labels.network}
                value={`${report.basic_facts.network_hospital_count?.toLocaleString('en-IN') ?? '—'} hospitals`}
              />
            </dl>
          </div>
        </Section>

        {/* 3 — Covered */}
        <Section title={strings.sectionTitles.covered} step={3}>
          <ul className="space-y-2">
            {report.covered.map((c, i) => (
              <li key={i} className="rounded-lg border border-border bg-card p-4 shadow-card">
                <div className="flex items-start gap-3">
                  {c.status === 'covered' ? (
                    <CheckCircle2 className="mt-0.5 size-5 flex-none text-success" aria-hidden />
                  ) : c.status === 'covered_with_conditions' ? (
                    <AlertTriangle className="mt-0.5 size-5 flex-none text-warn" aria-hidden />
                  ) : (
                    <Circle className="mt-0.5 size-5 flex-none text-danger" aria-hidden />
                  )}
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{c.name}</span>
                      {c.status === 'covered_with_conditions' ? (
                        <Badge tone="warn">{strings.labels.withConditions}</Badge>
                      ) : null}
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">{c.note}</p>
                    <Citation page={c.citation.page} section={c.citation.section_label} quote={c.citation.quoted_text} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        {/* 4 — Excluded */}
        <Section title={strings.sectionTitles.excluded} step={4}>
          <ul className="space-y-2">
            {report.excluded.map((e, i) => (
              <li
                key={i}
                className={cn(
                  'rounded-lg border p-4',
                  e.is_surprising
                    ? 'border-warn/30 bg-warn-subtle/40'
                    : 'border-border bg-card',
                )}
              >
                <div className="flex items-start gap-3">
                  <Circle className={cn('mt-0.5 size-5 flex-none', e.is_surprising ? 'text-warn' : 'text-ink-muted')} aria-hidden />
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">{e.text}</span>
                      {e.is_surprising ? <Badge tone="warn">{strings.labels.surprising}</Badge> : null}
                    </div>
                    <p className="mt-1 text-sm text-ink-muted">{e.plain_language}</p>
                    <Citation page={e.citation.page} section={e.citation.section_label} quote={e.citation.quoted_text} />
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        {/* 5 — Waiting periods */}
        <Section title={strings.sectionTitles.waiting} step={5}>
          <ul className="space-y-2">
            {report.waiting_periods.map((w, i) => (
              <li key={i} className="rounded-lg border border-border bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="font-medium text-ink">{w.condition}</div>
                  <div className="text-sm font-medium text-primary">
                    {w.wait_days === 0
                      ? 'Day 1'
                      : w.wait_days < 365
                        ? `${w.wait_days} days`
                        : `${Math.round(w.wait_days / 365)} yr${w.wait_days >= 730 ? 's' : ''}`}
                  </div>
                </div>
                {w.notes ? <p className="mt-1 text-sm text-ink-muted">{w.notes}</p> : null}
                <Citation page={w.citation.page} section={w.citation.section_label} quote={w.citation.quoted_text} />
              </li>
            ))}
          </ul>
        </Section>

        {/* 6 — Sub-limits */}
        <Section title={strings.sectionTitles.limits} step={6}>
          <ul className="space-y-2">
            {report.sub_limits.map((s, i) => (
              <li key={i} className="rounded-lg border border-border bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <div className="font-medium text-ink">{s.name}</div>
                  <div className="text-sm font-medium text-primary">{s.cap_text}</div>
                </div>
                <p className="mt-1 text-sm text-ink-muted">{s.consequence}</p>
                <Citation page={s.citation.page} section={s.citation.section_label} quote={s.citation.quoted_text} />
              </li>
            ))}
          </ul>
        </Section>

        {/* 7 — Co-pay */}
        <Section title={strings.sectionTitles.copay} step={7}>
          <div className="rounded-lg border border-border bg-card p-4 shadow-card">
            <p className="text-sm text-ink">{report.copay.explanation}</p>
          </div>
        </Section>

        {/* 8 — Red flags */}
        <Section title={strings.sectionTitles.flags} step={8}>
          <ul className="space-y-3">
            {report.red_flags.map((f, i) => (
              <RedFlagCard
                key={i}
                flag={f}
                severityLabel={
                  f.severity === 'high'
                    ? strings.labels.severityHigh
                    : f.severity === 'medium'
                      ? strings.labels.severityMed
                      : strings.labels.severityLow
                }
              />
            ))}
          </ul>
        </Section>

        {/* 9 — Readiness (narrative already shown in header hero) */}
        <Section title={strings.sectionTitles.readiness} step={9}>
          <div className="rounded-lg border border-border bg-card p-4 shadow-card">
            <p className="text-sm text-ink">{report.readiness_narrative}</p>
          </div>
        </Section>

        {/* 10 — What to do now */}
        <Section title={strings.sectionTitles.actions} step={10}>
          <ul className="space-y-3">
            {report.what_to_do_now.map((a, i) => {
              const urgencyLabel =
                a.urgency === 'do_today'
                  ? strings.labels.urgencyToday
                  : a.urgency === 'do_this_month'
                    ? strings.labels.urgencyMonth
                    : strings.labels.urgencyOptional;
              const urgencyTone =
                a.urgency === 'do_today' ? 'danger' : a.urgency === 'do_this_month' ? 'warn' : 'neutral';
              return (
                <li key={i} className="rounded-lg border border-border bg-card p-5 shadow-card">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <h4 className="font-display text-base font-semibold text-ink">{a.title}</h4>
                    <Badge tone={urgencyTone}>{urgencyLabel}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-ink-muted">{a.why}</p>
                  <p className="mt-2 text-sm text-ink">{a.how}</p>
                </li>
              );
            })}
          </ul>
        </Section>

        {/* Disclaimer */}
        <section className="mt-12 rounded-md border border-border bg-ink/5 p-4">
          <p className="text-xs text-ink-muted">{report.disclaimer}</p>
        </section>

        {/* Next moment CTA */}
        <section className="my-16 rounded-lg border border-primary/30 bg-primary-subtle p-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            {strings.labels.nextMoment}
          </div>
          <h3 className="mt-2 font-display text-xl font-semibold text-ink">
            {locale === 'hi'
              ? 'अगली बार दावा करते समय क्या होगा — पहले ही जाँच लें'
              : locale === 'kn'
                ? 'ಮುಂದಿನ ಕ್ಲೈಮ್‌ಗೆ ಏನಾಗುತ್ತದೆ — ಮೊದಲೇ ಪರಿಶೀಲಿಸಿ'
                : "See what will happen when you actually claim — before it does"}
          </h3>
          <div className="mt-4">
            <Link
              href={`/${locale}/claims-advocacy`}
              className={buttonVariants({ variant: 'primary', size: 'md' })}
            >
              {locale === 'hi'
                ? 'कवरेज जाँचें'
                : locale === 'kn'
                  ? 'ಕವರೇಜ್ ಪರಿಶೀಲಿಸಿ'
                  : 'Check a coverage scenario'}
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}

/* ───────── Small components ───────── */

function Section({
  title,
  step,
  children,
}: {
  title: string;
  step: number;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10 sm:mt-14">
      <div className="mb-4 flex items-baseline gap-3">
        <span className="font-display text-sm font-semibold text-ink-subtle">{String(step).padStart(2, '0')}</span>
        <h2 className="font-display text-xl font-semibold tracking-tight text-ink sm:text-2xl">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-4 px-4 py-3 sm:grid-cols-[200px_1fr]">
      <dt className="text-xs text-ink-subtle">{label}</dt>
      <dd className="text-sm text-ink">{value}</dd>
    </div>
  );
}

function Citation(_: { page: number; section: string; quote: string }) {
  // Hidden in the customer-facing legacy v1 report — same rationale as v2.
  return null;
}

function ScoreBar({ value }: { value: number }) {
  return (
    <div className="mt-3 flex gap-0.5" aria-hidden>
      {[...Array(10)].map((_, i) => {
        const filled = (i + 1) * 10 <= value;
        return (
          <span
            key={i}
            className={cn(
              'h-2 flex-1 rounded-sm',
              filled ? 'bg-primary' : 'bg-primary-subtle',
            )}
          />
        );
      })}
    </div>
  );
}

function Dimension({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background p-3">
      <div className="text-[11px] uppercase tracking-wide text-ink-subtle">{label}</div>
      <div className="mt-1 font-display text-lg font-semibold text-ink">{value}</div>
    </div>
  );
}

function RedFlagCard({ flag, severityLabel }: { flag: RedFlag; severityLabel: string }) {
  const borderColor =
    flag.severity === 'high'
      ? 'border-danger/40'
      : flag.severity === 'medium'
        ? 'border-warn/40'
        : 'border-border';
  const bgColor =
    flag.severity === 'high'
      ? 'bg-danger-subtle/40'
      : flag.severity === 'medium'
        ? 'bg-warn-subtle/40'
        : 'bg-card';
  const iconColor =
    flag.severity === 'high' ? 'text-danger' : flag.severity === 'medium' ? 'text-warn' : 'text-ink-muted';
  const badgeTone = flag.severity === 'high' ? 'danger' : flag.severity === 'medium' ? 'warn' : 'neutral';

  return (
    <li className={cn('rounded-lg border p-5', borderColor, bgColor)}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={cn('mt-0.5 size-5 flex-none', iconColor)} aria-hidden />
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="font-display text-base font-semibold text-ink">{flag.title}</h4>
            <Badge tone={badgeTone}>{severityLabel}</Badge>
          </div>
          <p className="mt-2 text-sm text-ink">{flag.why_it_matters}</p>
          <div className="mt-3 rounded-md border border-border bg-background p-3 text-sm text-ink-muted">
            <span className="italic">&ldquo;{flag.evidence}&rdquo;</span>
          </div>
          {flag.action ? (
            <p className="mt-3 text-sm text-ink">
              <span className="font-semibold text-ink">→ </span>
              {flag.action}
            </p>
          ) : null}
          <Citation page={flag.citation.page} section={flag.citation.section_label} quote={flag.citation.quoted_text} />
        </div>
      </div>
    </li>
  );
}

function ShareButton({
  label,
  locale,
  analysisId,
}: {
  label: string;
  locale: string;
  analysisId: string;
}) {
  // Server component — can't use window directly, but we can produce a pre-filled
  // WhatsApp link with the (relative) URL; the share target resolves it client-side.
  const shareText =
    locale === 'hi'
      ? `मैंने अपनी स्वास्थ्य पॉलिसी Suraksha Saathi से जाँची। देखें: `
      : locale === 'kn'
        ? `ನಾನು Suraksha Saathi ನಲ್ಲಿ ನನ್ನ ಆರೋಗ್ಯ ಪಾಲಿಸಿಯನ್ನು ಪರಿಶೀಲಿಸಿದೆ. ನೋಡಿ: `
        : `I analysed my health policy with Suraksha Saathi. Take a look: `;
  const base = 'https://wa.me/?text=';
  const path = `/${locale}/policy-health-score/analysis/${analysisId}`;
  const url = `${base}${encodeURIComponent(shareText + '__PLACE_URL_HERE__')}`;
  // We replace client-side via a small inline script pattern — but for Server
  // Component simplicity we expose a working relative share that uses a meta
  // redirect if JS is disabled. The ShareButtonClient does the absolute URL.
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener"
      className={buttonVariants({ variant: 'outline', size: 'sm' })}
      data-share-path={path}
    >
      <Share2 className="mr-1.5 size-4" aria-hidden />
      {label}
    </a>
  );
}
