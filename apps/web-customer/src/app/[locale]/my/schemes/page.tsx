import Link from 'next/link';
import { Landmark, CheckCircle2, HelpCircle, XCircle } from 'lucide-react';
import { Badge } from '@suraksha/ui';
import { listMySchemes, type SchemeRow } from '@/server/schemes/actions';
import { SchemeRowActions } from '@/components/my/scheme-row-actions';
import { RefreshMatchesButton } from '@/components/my/refresh-matches-button';

interface Props {
  params: Promise<{ locale: string }>;
}

export const dynamic = 'force-dynamic';

export default async function SchemesPage({ params }: Props) {
  const { locale } = await params;
  const schemes = await listMySchemes();

  const grouped = {
    eligible: schemes.filter((s) => s.matchStatus === 'eligible'),
    possibly: schemes.filter((s) => s.matchStatus === 'possibly_eligible'),
    notEligible: schemes.filter((s) => s.matchStatus === 'not_eligible'),
    unmatched: schemes.filter((s) => s.matchStatus === 'unmatched'),
  };
  const noneMatched = grouped.eligible.length === 0 && grouped.possibly.length === 0;

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Landmark className="size-3.5" />
            Government schemes
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Schemes you could be using
          </h1>
          <p className="mt-2 max-w-prose text-ink-muted">
            Every Indian family pays taxes that fund PM-JAY, state health missions, and the Senior
            Citizen Savings Scheme. We check whether your household qualifies and track your
            enrollment so you actually use what you've already paid for.
          </p>
        </div>
        <RefreshMatchesButton />
      </header>

      {noneMatched && (
        <div className="mb-6 rounded-xl border border-dashed border-border bg-card p-6 text-sm text-ink-muted">
          No matches yet. Tap <strong className="font-semibold text-ink">Refresh matches</strong> above —
          we'll score every active scheme against your profile + family. Add DOBs on the{' '}
          <Link href={`/${locale}/my/family`} className="text-primary underline">
            Family page
          </Link>{' '}
          for sharper age-based matches.
        </div>
      )}

      {grouped.eligible.length > 0 && (
        <Group title="Eligible" icon={<CheckCircle2 className="size-4 text-success" />} tone="success">
          <SchemeList rows={grouped.eligible} />
        </Group>
      )}

      {grouped.possibly.length > 0 && (
        <Group
          title="Possibly eligible"
          icon={<HelpCircle className="size-4 text-warn" />}
          tone="warn"
          subtitle="Needs more info to confirm. Add family DOBs + city to sharpen the match."
        >
          <SchemeList rows={grouped.possibly} />
        </Group>
      )}

      {grouped.notEligible.length > 0 && (
        <Group
          title="Not eligible (today)"
          icon={<XCircle className="size-4 text-ink-subtle" />}
          tone="neutral"
          subtitle="Re-check if your household changes — age, income, or a new family member may shift this."
        >
          <SchemeList rows={grouped.notEligible} />
        </Group>
      )}

      {grouped.unmatched.length > 0 && (
        <Group
          title="Not yet matched"
          icon={<Landmark className="size-4 text-ink-subtle" />}
          tone="neutral"
          subtitle="Schemes we haven't scored against your profile yet. Refresh above to match."
        >
          <SchemeList rows={grouped.unmatched} />
        </Group>
      )}
    </div>
  );
}

function Group({
  title,
  subtitle,
  icon,
  tone,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  tone: 'success' | 'warn' | 'neutral';
  children: React.ReactNode;
}) {
  return (
    <section className="mb-8">
      <header className="mb-3 flex items-start gap-2">
        {icon}
        <div>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-xs text-ink-subtle">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function SchemeList({ rows }: { rows: SchemeRow[] }) {
  return (
    <ul className="space-y-3">
      {rows.map((s) => (
        <li
          key={s.schemeId}
          className="flex flex-wrap items-start justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-card"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-semibold text-ink">{s.name}</h3>
              <Badge tone={s.level === 'central' ? 'primary' : 'warn'}>
                {s.level === 'state' ? `State · ${s.stateCode ?? '—'}` : 'Central'}
              </Badge>
              {s.coveragePaise && (
                <Badge tone="neutral">Coverage: {formatRupees(s.coveragePaise)}</Badge>
              )}
            </div>
            {s.summary && <p className="mt-1 text-sm text-ink-muted">{s.summary}</p>}
            {s.matchReason && (
              <p className="mt-2 text-xs italic text-ink-subtle">{s.matchReason}</p>
            )}
            {s.applicationChannels.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] uppercase tracking-wider text-ink-subtle">
                Apply via:
                {s.applicationChannels.map((c) => (
                  <span key={c} className="rounded-full bg-background px-2 py-0.5">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="shrink-0">
            <SchemeRowActions schemeId={s.schemeId} currentStatus={s.enrollmentStatus} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function formatRupees(paise: number): string {
  const rupees = Math.round(paise / 100);
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(2)} Cr`;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(2)} L`;
  return `₹${rupees.toLocaleString('en-IN')}`;
}
