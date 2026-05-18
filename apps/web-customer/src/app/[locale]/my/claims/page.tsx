import Link from 'next/link';
import { Briefcase, ArrowRight, Clock } from 'lucide-react';
import { Badge } from '@suraksha/ui';
import { cn } from '@/lib/cn';
import { listMyCases, type CaseRow } from '@/server/claims/actions';
import { NewCaseForm } from '@/components/my/new-case-form';

interface Props {
  params: Promise<{ locale: string }>;
}

export const dynamic = 'force-dynamic';

export default async function ClaimsPage({ params }: Props) {
  const { locale } = await params;
  const { active, closed } = await listMyCases();
  const total = active.length + closed.length;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Briefcase className="size-3.5" />
            Claims &amp; cases
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Your active work, tracked
          </h1>
          <p className="mt-2 max-w-prose text-ink-muted">
            Every hospitalisation claim, mis-sold policy recovery, unclaimed amount, or scheme-
            refusal case you're working with us on. Each case has a timeline so ops and AI events
            are visible to you in real time.
          </p>
        </div>
      </header>

      <div className="mb-6">
        <NewCaseForm locale={locale} />
      </div>

      {total === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Briefcase className="mx-auto size-10 text-ink-subtle" />
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">No cases yet</h2>
          <p className="mt-1 text-sm text-ink-muted">
            Cases are how we help you recover money from insurers — claim rejections,
            mis-sold ULIPs, unclaimed sum assured. Open one above to start.
          </p>
        </div>
      ) : (
        <>
          {active.length > 0 && (
            <section className="mb-8">
              <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
                Active ({active.length})
              </h2>
              <ul className="space-y-3">
                {active.map((c) => (
                  <CaseRowCard key={c.id} row={c} locale={locale} />
                ))}
              </ul>
            </section>
          )}
          {closed.length > 0 && (
            <section>
              <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
                Closed ({closed.length})
              </h2>
              <ul className="space-y-3">
                {closed.map((c) => (
                  <CaseRowCard key={c.id} row={c} locale={locale} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function CaseRowCard({ row, locale }: { row: CaseRow; locale: string }) {
  return (
    <li className="rounded-2xl border border-border bg-card p-5 shadow-card transition hover:border-primary/40">
      <Link href={`/${locale}/my/claims/${row.id}`} className="block">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-semibold text-ink">
                {humanize(row.kind)}
                {row.insurerName ? <span className="text-ink-muted"> · {row.insurerName}</span> : null}
              </h3>
              <Badge tone={statusTone(row.status)}>{humanize(row.status)}</Badge>
              {row.priority !== 'normal' && <Badge tone="warn">{humanize(row.priority)}</Badge>}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-ink-muted">
              <span className={cn('inline-flex items-center gap-1', overdueClass(row.deadlineAt))}>
                <Clock className="size-3.5" />
                {row.deadlineAt
                  ? `Deadline ${new Date(row.deadlineAt).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}`
                  : 'No deadline set'}
              </span>
              <span>{row.eventCount} {row.eventCount === 1 ? 'event' : 'events'}</span>
              {row.amountClaimedPaise && (
                <span>Claimed: {formatRupees(row.amountClaimedPaise)}</span>
              )}
              {row.amountRecoveredPaise != null && row.amountRecoveredPaise > 0 && (
                <span className="text-success">
                  Recovered: {formatRupees(row.amountRecoveredPaise)}
                </span>
              )}
            </div>
          </div>
          <ArrowRight className="size-4 text-ink-subtle" />
        </div>
      </Link>
    </li>
  );
}

function statusTone(status: string): 'success' | 'danger' | 'warn' | 'neutral' | 'primary' {
  if (status === 'resolved_in_favour') return 'success';
  if (status === 'resolved_against') return 'danger';
  if (status === 'abandoned' || status === 'withdrawn') return 'neutral';
  if (status.startsWith('escalated_')) return 'warn';
  return 'primary';
}

function overdueClass(deadline: string | null): string {
  if (!deadline) return '';
  const delta = new Date(deadline).getTime() - Date.now();
  if (delta < 0) return 'text-danger';
  if (delta < 7 * 24 * 3600 * 1000) return 'text-warn';
  return '';
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatRupees(paise: number): string {
  const rupees = Math.round(paise / 100);
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(2)} Cr`;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(2)} L`;
  return `₹${rupees.toLocaleString('en-IN')}`;
}
