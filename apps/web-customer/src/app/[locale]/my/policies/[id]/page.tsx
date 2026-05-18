import Link from 'next/link';
import { notFound } from 'next/navigation';
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  FileSearch,
  FileText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Badge, buttonVariants } from '@suraksha/ui';
import { cn } from '@/lib/cn';
import { getPolicyDetail } from '@/server/policies/detail';
import { PolicyDetailView } from '@/components/my/policy-detail-view';
import { ReadinessCard, RiskList } from '@/components/my/readiness-card';
import { CityTierPrompt } from '@/components/my/city-tier-prompt';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function PolicyDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const detail = await getPolicyDetail(id);
  if (!detail) notFound();
  const { policy, latestAnalysis, enriched, conditionSummary, analysisCount, score, scoringProfile } = detail;
  const renewal = computeRenewalState(policy.endDate);

  return (
    <div>
      <Link
        href={`/${locale}/my/policies`}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        All policies
      </Link>

      {/* ── Header ── */}
      <header className="mb-8 rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
              <ShieldCheck className="size-3.5" />
              Your policy
            </div>
            <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
              {policy.insurerName}
              {policy.planName ? (
                <span className="block font-display text-xl text-ink-muted sm:text-2xl">
                  {policy.planName}
                </span>
              ) : null}
            </h1>

            <dl className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs uppercase tracking-wider text-ink-subtle">
              <MetaItem label="Policy" value={policy.policyNumber} mono />
              <MetaItem label="Sum insured" value={formatRupees(policy.sumAssuredPaise) ?? '—'} />
              <MetaItem label="Premium" value={formatRupees(policy.premiumPaise) ?? '—'} />
              <MetaItem label="Type" value={humanize(policy.planType) ?? '—'} />
              <MetaItem
                label="Period"
                value={formatPeriod(policy.startDate, policy.endDate) ?? '—'}
              />
              {policy.nomineeName && <MetaItem label="Nominee" value={policy.nomineeName} />}
              {policy.networkHospitalCount != null && (
                <MetaItem
                  label="Network hospitals"
                  value={policy.networkHospitalCount.toLocaleString('en-IN')}
                />
              )}
            </dl>
          </div>

          {renewal && (
            <Badge tone={renewal.tone}>
              <Calendar className="mr-1 size-3" />
              {renewal.label}
            </Badge>
          )}
        </div>

        {/* Prominent action row — two clear CTAs, not tiny text links */}
        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border/60 pt-5">
          {latestAnalysis && (
            <Link
              href={`/${locale}/policy-health-score/analysis/${latestAnalysis.id}`}
              className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'inline-flex items-center gap-1.5')}
            >
              <FileSearch className="size-4" />
              View latest AI analysis
              <ArrowRight className="size-4" />
            </Link>
          )}
          <Link
            href={`/${locale}/policy-health-score/analyse`}
            className={cn(buttonVariants({ variant: 'outline', size: 'md' }), 'inline-flex items-center gap-1.5')}
          >
            <Sparkles className="size-4" />
            Re-analyse this policy
          </Link>
          {analysisCount > 1 && (
            <Link
              href={`/${locale}/my/analyses?policy=${policy.id}`}
              className="ml-auto text-sm text-ink-muted hover:text-ink"
            >
              See all {analysisCount} analyses →
            </Link>
          )}
        </div>
      </header>

      {/* ── Readiness score card (admin-only during calibration) ── */}
      {score && (
        <div className="mb-6">
          <ReadinessCard score={score} />
        </div>
      )}

      {/* ── City-tier prompt — only shown to admins seeing the score, and only when profile empty ── */}
      {score && scoringProfile.cityTier == null && (
        <div className="mb-6">
          <CityTierPrompt />
        </div>
      )}

      {/* ── Top gaps to review (risk list) ── */}
      {score && (
        <div className="mb-8">
          <RiskList components={score.components} />
        </div>
      )}

      {/* ── No extractor fallback ── */}
      {!enriched && (
        <div className="mb-8 rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <FileText className="mx-auto size-10 text-ink-subtle" />
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">
            No detailed analysis yet
          </h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            This policy doesn't have a v2 extractor output linked. Re-upload it to see every clause
            mapped out below.
          </p>
          <Link
            href={`/${locale}/policy-health-score/analyse`}
            className={cn(buttonVariants({ variant: 'primary', size: 'md' }), 'mt-5')}
          >
            Re-analyse this policy
          </Link>
        </div>
      )}

      {/* ── Tabbed detail view ── */}
      {enriched && (
        <PolicyDetailView
          extractor={enriched}
          conditionSummary={conditionSummary}
          policyMeta={{
            sumAssuredPaise: policy.sumAssuredPaise,
            premiumPaise: policy.premiumPaise,
          }}
        />
      )}
    </div>
  );
}

function MetaItem({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="text-ink-subtle">{label}</span>
      <span className={cn('text-ink normal-case tracking-normal', mono && 'font-mono text-xs')}>
        {value}
      </span>
    </div>
  );
}

function formatRupees(rupees: number | null): string | null {
  if (rupees == null || rupees === 0) return null;
  const r = rupees > 500_000_000 ? Math.round(rupees / 100) : Math.round(rupees);
  if (r >= 10_000_000) return `₹${(r / 10_000_000).toFixed(2)} Cr`;
  if (r >= 100_000) return `₹${(r / 100_000).toFixed(2)} L`;
  return `₹${r.toLocaleString('en-IN')}`;
}

function formatPeriod(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const fmt = (iso: string) =>
    new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fmt(start)} → ${fmt(end)}`;
}

function humanize(s: string | null): string | null {
  if (!s) return null;
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function computeRenewalState(
  endDate: string | null,
): { tone: 'danger' | 'warn' | 'success' | 'neutral'; label: string } | null {
  if (!endDate) return null;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return null;
  const days = Math.ceil((end.getTime() - Date.now()) / (24 * 3600 * 1000));
  if (days < 0) return { tone: 'danger', label: `Expired ${Math.abs(days)}d ago` };
  if (days <= 14) return { tone: 'danger', label: `Renews in ${days}d` };
  if (days <= 45) return { tone: 'warn', label: `Renews in ${days}d` };
  if (days <= 365) return { tone: 'success', label: `Renews in ${days}d` };
  return { tone: 'neutral', label: `Renews in ${Math.round(days / 30)}mo` };
}
