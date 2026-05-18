'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Trash2,
  ArrowRight,
  Calendar,
  ShieldCheck,
  AlertCircle,
  FileSearch,
  FileText,
} from 'lucide-react';
import { Badge, buttonVariants } from '@suraksha/ui';
import { cn } from '@/lib/cn';
import { deletePolicy, type PolicyRow } from '@/server/policies/actions';

interface Props {
  policy: PolicyRow;
  locale: string;
}

/**
 * One card per owned policy — shows at-a-glance: insurer, plan, sum assured,
 * renewal date (with countdown), latest analysis link + total analysis count.
 */
export function PolicyCard({ policy, locale }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const renewalState = computeRenewalState(policy.endDate);

  function onDelete() {
    if (
      !window.confirm(
        `Delete "${policy.insurerName}${policy.planName ? ' · ' + policy.planName : ''}"?\n\n` +
          `Your analyses for this policy stay in your history. This only removes the policy from your dashboard.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      setError(null);
      const res = await deletePolicy(policy.id);
      if (!res.ok) {
        setError(res.message ?? 'Delete failed');
        return;
      }
      router.refresh();
    });
  }

  return (
    <li className="rounded-2xl border border-border bg-card p-5 shadow-card transition hover:shadow-floating">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <Link
              href={`/${locale}/my/policies/${policy.id}`}
              className="font-display text-lg font-semibold text-ink transition hover:text-primary"
            >
              {policy.insurerName}
              {policy.planName ? (
                <span className="text-ink-muted"> · {policy.planName}</span>
              ) : null}
            </Link>
            {renewalState && (
              <Badge tone={renewalState.tone}>
                <Calendar className="mr-1 size-3" />
                {renewalState.label}
              </Badge>
            )}
          </div>

          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
            <Field label="Policy no." value={policy.policyNumber} />
            <Field label="Sum insured" value={formatRupees(policy.sumAssuredPaise)} />
            <Field label="Premium" value={formatRupees(policy.premiumPaise)} />
            <Field label="Plan type" value={humanize(policy.planType)} />
            <Field label="Period" value={formatPeriod(policy.startDate, policy.endDate)} />
            <Field label="Nominee" value={policy.nomineeName} />
          </div>
        </div>

        <button
          type="button"
          onClick={onDelete}
          disabled={pending}
          aria-label="Delete policy"
          className="shrink-0 rounded-md border border-border p-2 text-ink-muted transition hover:border-danger/50 hover:text-danger disabled:opacity-50"
        >
          <Trash2 className="size-4" />
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 flex-none" />
          <span>{error}</span>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
        <div className="inline-flex items-center gap-2 text-xs text-ink-muted">
          <FileSearch className="size-3.5" />
          {policy.analysisCount === 0
            ? 'No analyses yet'
            : `${policy.analysisCount} ${policy.analysisCount === 1 ? 'analysis' : 'analyses'}`}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/${locale}/my/policies/${policy.id}`}
            className={cn(
              buttonVariants({ variant: 'primary', size: 'sm' }),
              'inline-flex items-center gap-1.5',
            )}
          >
            <FileText className="size-3.5" />
            View details
          </Link>
          {policy.latestAnalysisId && (
            <Link
              href={`/${locale}/policy-health-score/analysis/${policy.latestAnalysisId}`}
              className={cn(
                buttonVariants({ variant: 'outline', size: 'sm' }),
                'inline-flex items-center gap-1.5',
              )}
            >
              <FileSearch className="size-3.5" />
              View analysis
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="min-w-0">
      <div className="text-xs uppercase tracking-wider text-ink-subtle">{label}</div>
      <div className={cn('mt-0.5 truncate', value ? 'text-ink' : 'text-ink-subtle')}>
        {value ?? '—'}
      </div>
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
  return `${formatShortDate(start)} → ${formatShortDate(end)}`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
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
