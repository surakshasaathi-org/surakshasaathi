import Link from 'next/link';
import { AlertTriangle, ArrowLeftRight, CheckCircle2, XCircle } from 'lucide-react';
import { Badge } from '@suraksha/ui';
import { compareTwoPolicies } from '@/server/policies/compare';
import { listMyPolicies } from '@/server/policies/actions';
import { cn } from '@/lib/cn';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ a?: string; b?: string }>;
}

export const dynamic = 'force-dynamic';

/**
 * Side-by-side policy comparison. Reuses the stored extractor output from
 * each policy's latest v2 analysis; no new agent calls. Legacy v1 rows don't
 * render here — the UI asks the user to re-run an analysis.
 */
export default async function ComparePage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const policies = await listMyPolicies();

  if (!sp.a || !sp.b) {
    return <PickerView policies={policies} locale={locale} aId={sp.a ?? null} bId={sp.b ?? null} />;
  }

  const diff = await compareTwoPolicies(sp.a, sp.b);
  if (!diff) {
    return (
      <div className="rounded-2xl border border-danger/30 bg-danger-subtle p-6 text-sm text-danger">
        We couldn't load these two policies for you — either one isn't yours, or both are missing.
        <Link
          href={`/${locale}/my/policies`}
          className="ml-2 font-medium underline"
        >
          Back to policies
        </Link>
      </div>
    );
  }

  return (
    <div>
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <ArrowLeftRight className="size-3.5" />
          Compare policies
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          {diff.a.insurerName}
          {diff.a.planName ? ` · ${diff.a.planName}` : ''} &nbsp;
          <span className="text-ink-subtle">vs</span> &nbsp;
          {diff.b.insurerName}
          {diff.b.planName ? ` · ${diff.b.planName}` : ''}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Based on each policy's latest analysis. Legacy rows (v1 shape) won't fully render —
          re-analyse a policy to get its extractor data into comparable form.
        </p>
      </header>

      {/* Headline numbers */}
      <section className="mb-6 grid gap-4 rounded-2xl border border-border bg-card p-5 shadow-card sm:grid-cols-3">
        <NumberComparison
          label="Sum insured"
          a={formatRupees(diff.a.sumAssuredPaise)}
          b={formatRupees(diff.b.sumAssuredPaise)}
          delta={diff.delta.sumAssuredPaise}
          invertTone
        />
        <NumberComparison
          label="Annual premium"
          a={formatRupees(diff.a.premiumPaise)}
          b={formatRupees(diff.b.premiumPaise)}
          delta={diff.delta.premiumPaise}
          deltaSuffix={
            diff.delta.premiumPercent != null
              ? ` (${diff.delta.premiumPercent > 0 ? '+' : ''}${diff.delta.premiumPercent}%)`
              : ''
          }
        />
        <NumberComparison
          label="Period"
          a={formatPeriod(diff.a.startDate, diff.a.endDate)}
          b={formatPeriod(diff.b.startDate, diff.b.endDate)}
          delta={null}
        />
      </section>

      {/* Exclusions */}
      <DiffSection
        title="Exclusions"
        subtitle="Clauses present in one policy but not the other. Fewer exclusions is generally better."
      >
        <TwoColumnList
          leftLabel="Only in A"
          leftItems={diff.delta.exclusionOnlyInA}
          rightLabel="Only in B"
          rightItems={diff.delta.exclusionOnlyInB}
          tone="danger"
          icon={<XCircle className="size-3.5" />}
        />
      </DiffSection>

      {/* Coverage */}
      <DiffSection
        title="Coverage sections"
        subtitle="Headlines of what each policy explicitly covers. More specificity = clearer claim."
      >
        <TwoColumnList
          leftLabel="Only in A"
          leftItems={diff.delta.coverageOnlyInA}
          rightLabel="Only in B"
          rightItems={diff.delta.coverageOnlyInB}
          tone="success"
          icon={<CheckCircle2 className="size-3.5" />}
        />
      </DiffSection>

      {/* Waiting periods */}
      <DiffSection
        title="Waiting periods"
        subtitle="Conditions that don't kick in immediately. Shorter is better — especially for specific pre-existing conditions."
      >
        {diff.delta.waitingPeriodDifferences.length === 0 ? (
          <p className="text-sm text-ink-muted">
            No material differences detected — either both policies have the same waiting periods,
            or neither extractor captured them.
          </p>
        ) : (
          <ul className="space-y-2">
            {diff.delta.waitingPeriodDifferences.map((w) => (
              <li
                key={w.condition}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-lg border border-border bg-background/50 p-3 text-sm"
              >
                <span className="capitalize text-ink">{w.condition}</span>
                <span className={cn('text-right', betterWait(w.daysA, w.daysB))}>
                  A: {w.daysA != null ? `${w.daysA}d` : '—'}
                </span>
                <span className={cn('text-right', betterWait(w.daysB, w.daysA))}>
                  B: {w.daysB != null ? `${w.daysB}d` : '—'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </DiffSection>

      <div className="mt-10 flex flex-wrap gap-3 text-sm">
        {diff.a.latestAnalysisId && (
          <Link
            href={`/${locale}/policy-health-score/analysis/${diff.a.latestAnalysisId}`}
            className="text-primary hover:underline"
          >
            Open A's analysis →
          </Link>
        )}
        {diff.b.latestAnalysisId && (
          <Link
            href={`/${locale}/policy-health-score/analysis/${diff.b.latestAnalysisId}`}
            className="text-primary hover:underline"
          >
            Open B's analysis →
          </Link>
        )}
        <Link
          href={`/${locale}/my/policies`}
          className="ml-auto text-ink-muted hover:text-ink"
        >
          ← All policies
        </Link>
      </div>
    </div>
  );
}

function PickerView({
  policies,
  locale,
  aId,
  bId,
}: {
  policies: Awaited<ReturnType<typeof listMyPolicies>>;
  locale: string;
  aId: string | null;
  bId: string | null;
}) {
  if (policies.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
        <ArrowLeftRight className="mx-auto size-10 text-ink-subtle" />
        <h2 className="mt-3 font-display text-lg font-semibold text-ink">
          Compare needs two policies
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          You have {policies.length} policy on file. Upload another and we can compare them
          year-over-year or against a different insurer.
        </p>
      </div>
    );
  }
  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Compare two policies
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          Pick Policy A and Policy B — we'll line up sum assured, premium, exclusions, coverage
          sections, and waiting periods.
        </p>
      </header>
      <form method="get" className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Policy A
          </span>
          <select
            name="a"
            defaultValue={aId ?? ''}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="" disabled>
              Select…
            </option>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.insurerName}
                {p.planName ? ` · ${p.planName}` : ''} (#{p.policyNumber})
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Policy B
          </span>
          <select
            name="b"
            defaultValue={bId ?? ''}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          >
            <option value="" disabled>
              Select…
            </option>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>
                {p.insurerName}
                {p.planName ? ` · ${p.planName}` : ''} (#{p.policyNumber})
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          Compare
        </button>
      </form>
    </div>
  );
}

function NumberComparison({
  label,
  a,
  b,
  delta,
  deltaSuffix,
  invertTone,
}: {
  label: string;
  a: string | null;
  b: string | null;
  delta: number | null;
  deltaSuffix?: string;
  invertTone?: boolean;
}) {
  let tone: 'success' | 'danger' | 'neutral' = 'neutral';
  if (delta != null && delta !== 0) {
    const positive = delta > 0;
    // For premium: positive = more expensive = bad. For sum assured: positive = better.
    const good = invertTone ? positive : !positive;
    tone = good ? 'success' : 'danger';
  }
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">{label}</div>
      <div className="mt-1 grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-md bg-background/60 p-2">
          <div className="text-[10px] uppercase text-ink-subtle">A</div>
          <div className="font-medium text-ink">{a ?? '—'}</div>
        </div>
        <div className="rounded-md bg-background/60 p-2">
          <div className="text-[10px] uppercase text-ink-subtle">B</div>
          <div className="font-medium text-ink">{b ?? '—'}</div>
        </div>
      </div>
      {delta != null && delta !== 0 && (
        <div
          className={cn(
            'mt-2 text-xs',
            tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-ink-muted',
          )}
        >
          Δ {delta > 0 ? '+' : ''}
          {formatRupeesRaw(delta)}
          {deltaSuffix ?? ''}
        </div>
      )}
    </div>
  );
}

function DiffSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-6 rounded-2xl border border-border bg-card p-5 shadow-card">
      <header className="mb-3">
        <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
        {subtitle && <p className="mt-1 text-xs text-ink-muted">{subtitle}</p>}
      </header>
      {children}
    </section>
  );
}

function TwoColumnList({
  leftLabel,
  leftItems,
  rightLabel,
  rightItems,
  tone,
  icon,
}: {
  leftLabel: string;
  leftItems: string[];
  rightLabel: string;
  rightItems: string[];
  tone: 'success' | 'danger';
  icon: React.ReactNode;
}) {
  const empty = leftItems.length === 0 && rightItems.length === 0;
  if (empty) {
    return (
      <p className="text-sm text-ink-muted">
        No material differences detected between the two policies.
      </p>
    );
  }
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Column label={leftLabel} items={leftItems} tone={tone} icon={icon} />
      <Column label={rightLabel} items={rightItems} tone={tone} icon={icon} />
    </div>
  );
}

function Column({
  label,
  items,
  tone,
  icon,
}: {
  label: string;
  items: string[];
  tone: 'success' | 'danger';
  icon: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
        {icon}
        {label} ({items.length})
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-ink-muted">—</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2">
              <Badge tone={tone}>
                <AlertTriangle className="size-3" />
              </Badge>
              <span className="text-ink capitalize-first">{truncate(it, 200)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function betterWait(own: number | null, other: number | null): string {
  if (own == null || other == null) return 'text-ink';
  return own < other ? 'text-success' : own > other ? 'text-danger' : 'text-ink';
}

function formatRupees(rupees: number | null): string | null {
  if (rupees == null) return null;
  const r = rupees > 500_000_000 ? Math.round(rupees / 100) : Math.round(rupees);
  if (r >= 10_000_000) return `₹${(r / 10_000_000).toFixed(2)} Cr`;
  if (r >= 100_000) return `₹${(r / 100_000).toFixed(2)} L`;
  return `₹${r.toLocaleString('en-IN')}`;
}
function formatRupeesRaw(paise: number): string {
  return formatRupees(Math.abs(paise)) ?? '—';
}
function formatPeriod(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  const fmt = (s: string) =>
    new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fmt(start)} → ${fmt(end)}`;
}
function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}
