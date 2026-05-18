import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Briefcase, FileText, AlertTriangle, Clock } from 'lucide-react';
import { Badge } from '@suraksha/ui';
import { getCaseWithTimeline } from '@/server/claims/actions';
import { CaseEventAdd } from '@/components/my/case-event-add';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

export const dynamic = 'force-dynamic';

export default async function CaseDetailPage({ params }: Props) {
  const { locale, id } = await params;
  const detail = await getCaseWithTimeline(id);
  if (!detail) notFound();
  const { case: c, events } = detail;

  return (
    <div>
      <Link
        href={`/${locale}/my/claims`}
        className="mb-4 inline-flex items-center gap-1 text-sm text-ink-muted hover:text-ink"
      >
        <ArrowLeft className="size-4" />
        All cases
      </Link>

      <header className="mb-6">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Briefcase className="size-3.5" />
          {humanize(c.kind)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {c.insurerName ?? 'Case'}
          </h1>
          <Badge tone={statusTone(c.status)}>{humanize(c.status)}</Badge>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
          <Field label="Opened">
            {new Date(c.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            })}
          </Field>
          <Field label="Priority">{humanize(c.priority)}</Field>
          <Field label="Amount claimed">
            {c.amountClaimedPaise ? formatRupees(c.amountClaimedPaise) : '—'}
          </Field>
          <Field label="Amount recovered">
            {c.amountRecoveredPaise ? formatRupees(c.amountRecoveredPaise) : '—'}
          </Field>
        </dl>

        {c.deadlineAt && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-warn/40 bg-warn-subtle/50 px-3 py-1.5 text-xs text-ink">
            <Clock className="size-3.5 text-warn" />
            Deadline: {new Date(c.deadlineAt).toLocaleString('en-IN')}
          </div>
        )}
      </header>

      {/* Timeline */}
      <section className="mb-8">
        <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
          Timeline
        </h2>
        {events.length === 0 ? (
          <p className="text-sm text-ink-muted">No events yet.</p>
        ) : (
          <ol className="relative space-y-0 border-l border-border pl-6">
            {events.map((e) => (
              <li key={e.id} className="relative pb-5">
                <span className="absolute -left-[1.7rem] top-1 flex size-6 items-center justify-center rounded-full bg-card shadow-card ring-1 ring-border">
                  {iconFor(e.type)}
                </span>
                <div className="text-sm font-medium text-ink">
                  {e.userVisible?.[locale] ?? e.userVisible?.en ?? humanize(e.type)}
                </div>
                <div className="mt-0.5 text-[11px] uppercase tracking-wider text-ink-subtle">
                  {humanize(e.actorKind)} · {new Date(e.createdAt).toLocaleString('en-IN')}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <CaseEventAdd caseId={c.id} currentStatus={c.status} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wider text-ink-subtle">{label}</dt>
      <dd className="mt-0.5 text-ink">{children}</dd>
    </div>
  );
}

function iconFor(type: string): React.ReactNode {
  if (type === 'document_uploaded') return <FileText className="size-3.5 text-primary" />;
  if (type.includes('reject') || type === 'ombudsman_filed')
    return <AlertTriangle className="size-3.5 text-warn" />;
  return <Briefcase className="size-3.5 text-primary" />;
}

function statusTone(status: string): 'success' | 'danger' | 'warn' | 'neutral' | 'primary' {
  if (status === 'resolved_in_favour') return 'success';
  if (status === 'resolved_against') return 'danger';
  if (status === 'abandoned' || status === 'withdrawn') return 'neutral';
  if (status.startsWith('escalated_')) return 'warn';
  return 'primary';
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
