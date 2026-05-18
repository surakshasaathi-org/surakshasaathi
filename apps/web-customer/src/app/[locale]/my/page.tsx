import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  Calendar,
  FileSearch,
  MessageCircle,
  PlusCircle,
  ShieldCheck,
  Users,
  Landmark,
  Bell,
} from 'lucide-react';
import { Badge, buttonVariants } from '@suraksha/ui';
import { cn } from '@/lib/cn';
import { loadDashboard } from '@/server/dashboard/queries';

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * Signed-in home. The moment of truth: what should this user do NEXT? We
 * compute a lightweight Policy Health Score, surface renewals that are close,
 * pull the 5 worst red flags across all policies, and list recent activity —
 * all in one server render.
 */
export const dynamic = 'force-dynamic';

export default async function MyDashboardPage({ params }: Props) {
  const { locale } = await params;
  const data = await loadDashboard();

  if (!data) {
    return <DashboardEmptyState locale={locale} />;
  }

  const isEmpty =
    data.counts.policies === 0 && data.counts.analyses === 0 && data.counts.familyMembers === 0;
  if (isEmpty) return <DashboardEmptyState locale={locale} />;

  return (
    <div className="space-y-8">
      <header>
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          Dashboard
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Your protection, at a glance
        </h1>
      </header>

      {/* Top row: Health Score + Counts */}
      <section className="grid gap-4 lg:grid-cols-[1.5fr_2fr]">
        {data.healthScore ? (
          <HealthScoreCard score={data.healthScore} />
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card p-6">
            <p className="text-sm text-ink-muted">
              Analyse your first policy to see your protection score.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <CountCard label="Policies" value={data.counts.policies} icon={<ShieldCheck className="size-4" />} href={`/${locale}/my/policies`} />
          <CountCard label="Analyses" value={data.counts.analyses} icon={<FileSearch className="size-4" />} href={`/${locale}/my/analyses`} />
          <CountCard label="Family" value={data.counts.familyMembers} icon={<Users className="size-4" />} href={`/${locale}/my/family`} />
          <CountCard label="Claims" value={data.counts.activeCases} icon={<MessageCircle className="size-4" />} href={`/${locale}/my/claims`} />
          <CountCard label="Schemes" value={data.counts.eligibleSchemes} icon={<Landmark className="size-4" />} href={`/${locale}/my/schemes`} />
        </div>
      </section>

      {/* Row 2: Renewals + Top gaps */}
      <section className="grid gap-6 lg:grid-cols-2">
        <RenewalsPanel renewals={data.renewals} locale={locale} />
        <TopGapsPanel gaps={data.topGaps} locale={locale} />
      </section>

      {/* Row 3: Recent activity */}
      <RecentActivityPanel activity={data.recentActivity} locale={locale} />
    </div>
  );
}

/* ────────── Panels ────────── */

function HealthScoreCard({
  score,
}: {
  score: NonNullable<Awaited<ReturnType<typeof loadDashboard>>>['healthScore'];
}) {
  if (!score) return null;
  const ringColor = {
    success: 'text-success',
    warn: 'text-warn',
    neutral: 'text-primary',
    danger: 'text-danger',
  }[score.tone];

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      <div className="flex items-center gap-5">
        <ScoreRing value={score.value} colorClass={ringColor} />
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
            Protection Health Score
          </h2>
          <p className="mt-1 text-sm text-ink-muted">{score.narrative}</p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Indicator ok={score.components.coverageBreadth > 0} label="Policy on file" />
            <Indicator ok={score.components.hasNominee} label="Nominee set" />
            <Indicator ok={score.components.recentAnalysis} label="Recent analysis" />
            <Indicator ok={score.components.familyLogged} label="Family logged" />
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreRing({ value, colorClass }: { value: number; colorClass: string }) {
  const radius = 36;
  const circ = 2 * Math.PI * radius;
  const offset = circ - (value / 100) * circ;
  return (
    <div className="relative size-24 shrink-0">
      <svg viewBox="0 0 100 100" className="size-full -rotate-90">
        <circle cx="50" cy="50" r={radius} stroke="currentColor" strokeWidth="8" fill="none" className="text-border" />
        <circle
          cx="50"
          cy="50"
          r={radius}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className={cn('transition-[stroke-dashoffset] duration-700', colorClass)}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={cn('font-display text-2xl font-semibold', colorClass)}>{value}</span>
      </div>
    </div>
  );
}

function Indicator({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium',
        ok ? 'bg-success/10 text-success' : 'bg-background text-ink-subtle',
      )}
    >
      <span className={cn('size-1.5 rounded-full', ok ? 'bg-success' : 'bg-ink-subtle')} />
      {label}
    </span>
  );
}

function CountCard({
  label,
  value,
  icon,
  href,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-border bg-card p-4 shadow-card transition hover:-translate-y-0.5 hover:border-primary/40"
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
        {icon}
        {label}
      </div>
      <div className="mt-2 font-display text-2xl font-semibold text-ink">{value}</div>
    </Link>
  );
}

function RenewalsPanel({
  renewals,
  locale,
}: {
  renewals: NonNullable<Awaited<ReturnType<typeof loadDashboard>>>['renewals'];
  locale: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <header className="mb-3 flex items-center gap-2">
        <Calendar className="size-4 text-primary" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Upcoming renewals
        </h2>
      </header>
      {renewals.length === 0 ? (
        <p className="text-sm text-ink-muted">No renewals on the horizon. Add a policy to track its renewal here.</p>
      ) : (
        <ul className="space-y-2">
          {renewals.map((r) => (
            <li
              key={r.policyId}
              className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/60 p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-ink">
                  {r.insurerName}
                  {r.planName ? ` · ${r.planName}` : ''}
                </div>
                <div className="text-xs text-ink-muted">
                  {new Date(r.endDate).toLocaleDateString('en-IN', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </div>
              </div>
              <Badge tone={renewalTone(r.daysUntilRenewal)}>
                {renewalLabel(r.daysUntilRenewal)}
              </Badge>
            </li>
          ))}
        </ul>
      )}
      <Link
        href={`/${locale}/my/policies`}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        View all policies
        <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}

function TopGapsPanel({
  gaps,
  locale,
}: {
  gaps: NonNullable<Awaited<ReturnType<typeof loadDashboard>>>['topGaps'];
  locale: string;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <header className="mb-3 flex items-center gap-2">
        <AlertTriangle className="size-4 text-warn" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Top coverage gaps
        </h2>
      </header>
      {gaps.length === 0 ? (
        <p className="text-sm text-ink-muted">
          No critical gaps right now. Upload a policy to get a fresh red-flag scan.
        </p>
      ) : (
        <ul className="space-y-2">
          {gaps.map((g, i) => (
            <li
              key={i}
              className="rounded-lg border-l-4 border-border/60 bg-background/60 p-3 pl-3"
              style={{
                borderLeftColor:
                  g.severity === 'high'
                    ? 'hsl(0 68% 48%)'
                    : g.severity === 'medium'
                      ? 'hsl(38 92% 50%)'
                      : 'hsl(25 20% 88%)',
              }}
            >
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/${locale}/policy-health-score/analysis/${g.analysisId}`}
                  className="text-sm font-medium text-ink hover:underline"
                >
                  {g.title}
                </Link>
                <Badge tone={g.severity === 'high' ? 'danger' : g.severity === 'medium' ? 'warn' : 'neutral'}>
                  {g.severity}
                </Badge>
              </div>
              <p className="mt-1 text-xs text-ink-muted">{g.action}</p>
              {g.insurerName && (
                <p className="mt-1 text-[11px] uppercase tracking-wider text-ink-subtle">
                  {g.insurerName}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function RecentActivityPanel({
  activity,
  locale,
}: {
  activity: NonNullable<Awaited<ReturnType<typeof loadDashboard>>>['recentActivity'];
  locale: string;
}) {
  if (activity.length === 0) return null;
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <header className="mb-3 flex items-center gap-2">
        <Bell className="size-4 text-primary" />
        <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Recent activity
        </h2>
      </header>
      <ul className="space-y-2">
        {activity.map((a, i) => (
          <li key={i} className="flex items-start justify-between gap-3 border-b border-border/40 pb-2 last:border-0">
            <div className="min-w-0 flex-1">
              <div className="text-sm text-ink">{a.subject}</div>
              {a.detail && <div className="truncate text-xs text-ink-muted">{a.detail}</div>}
            </div>
            <time className="shrink-0 text-xs text-ink-subtle">
              {relativeTime(a.occurredAt)}
            </time>
          </li>
        ))}
      </ul>
      <Link
        href={`/${locale}/my/activity`}
        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        See full history
        <ArrowRight className="size-3" />
      </Link>
    </div>
  );
}

function DashboardEmptyState({ locale }: { locale: string }) {
  return (
    <div>
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
        Welcome to Suraksha Saathi
      </h1>
      <p className="mt-2 max-w-prose text-ink-muted">
        Get the most out of your account in two quick steps.
      </p>
      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Link
          href={`/${locale}/my/family`}
          className="group rounded-2xl border border-border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary/40"
        >
          <Users className="size-6 text-primary" />
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">1. Add your family</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Enter everyone once — we'll tailor every future analysis for them.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
            Start <ArrowRight className="size-4 transition group-hover:translate-x-1" />
          </span>
        </Link>
        <Link
          href={`/${locale}/policy-health-score/analyse`}
          className={cn(
            'group rounded-2xl border border-border bg-card p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary/40',
          )}
        >
          <PlusCircle className="size-6 text-primary" />
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">2. Analyse a policy</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Upload any health policy PDF. We'll read every clause and give you a plain-language map.
          </p>
          <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary">
            Upload <ArrowRight className="size-4 transition group-hover:translate-x-1" />
          </span>
        </Link>
      </div>
    </div>
  );
}

/* ────────── Helpers ────────── */

function renewalTone(days: number): 'danger' | 'warn' | 'success' | 'neutral' {
  if (days < 0) return 'danger';
  if (days <= 14) return 'danger';
  if (days <= 45) return 'warn';
  if (days <= 180) return 'success';
  return 'neutral';
}
function renewalLabel(days: number): string {
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'today';
  if (days === 1) return 'tomorrow';
  if (days < 60) return `in ${days}d`;
  return `in ${Math.round(days / 30)}mo`;
}

function relativeTime(iso: string): string {
  const delta = Date.now() - new Date(iso).getTime();
  const sec = Math.round(delta / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}
