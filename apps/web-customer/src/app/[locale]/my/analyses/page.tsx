import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Clock, FileSearch, ShieldCheck, AlertTriangle, Archive } from 'lucide-react';
import { Badge, buttonVariants } from '@suraksha/ui';
import { getCurrentUser } from '@/lib/current-user';
import { listMyAnalyses } from '@/server/auth/claim';
import { listMyPolicies } from '@/server/policies/actions';
import { cn } from '@/lib/cn';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ policy?: string; archive?: string }>;
}

const STATUS_TONE: Record<string, 'success' | 'primary' | 'danger' | 'neutral' | 'warn'> = {
  ready: 'success',
  failed: 'danger',
  queued: 'neutral',
  ocr_running: 'primary',
  intake_running: 'primary',
  extracting: 'primary',
  analysing: 'primary',
  translating: 'primary',
  reviewing: 'primary',
};

const DEFAULT_ARCHIVE_DAYS = 180;

export default async function MyAnalysesPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) {
    redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/my/analyses`)}`);
  }

  const policyFilter = sp.policy ?? null;
  const includeArchive = sp.archive === '1';

  const [analyses, policies] = await Promise.all([
    listMyAnalyses(user.id, {
      policyId: policyFilter,
      archivedSinceDays: includeArchive ? undefined : DEFAULT_ARCHIVE_DAYS,
    }),
    listMyPolicies(),
  ]);

  const activePolicy = policies.find((p) => p.id === policyFilter) ?? null;
  const policiesById = new Map(policies.map((p) => [p.id, p]));

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <FileSearch className="size-3.5" />
            Your analyses
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Every policy you've ever uploaded
          </h1>
          <p className="mt-2 max-w-prose text-ink-muted">
            No 7-day expiry for signed-in analyses. Filter by policy to compare year-over-year,
            or open the{' '}
            <Link href={`/${locale}/my/policies`} className="text-primary hover:underline">
              Policies view
            </Link>{' '}
            for a canonical list.
          </p>
        </div>
        <Link
          href={`/${locale}/policy-health-score/analyse`}
          className={buttonVariants({ variant: 'primary', size: 'md' })}
        >
          Analyse a new policy
        </Link>
      </header>

      {/* Filter chips + archive toggle */}
      {policies.length > 0 && (
        <div className="mb-5 flex flex-wrap items-center gap-2">
          <FilterChip
            href={`/${locale}/my/analyses${includeArchive ? '?archive=1' : ''}`}
            active={!policyFilter}
            label="All policies"
          />
          {policies.map((p) => (
            <FilterChip
              key={p.id}
              href={`/${locale}/my/analyses?policy=${p.id}${includeArchive ? '&archive=1' : ''}`}
              active={policyFilter === p.id}
              label={shortPolicyLabel(p.insurerName, p.planName)}
            />
          ))}
          <div className="ml-auto">
            <Link
              href={`/${locale}/my/analyses${policyFilter ? `?policy=${policyFilter}` : ''}${
                includeArchive ? '' : policyFilter ? '&archive=1' : '?archive=1'
              }`}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs transition',
                includeArchive
                  ? 'border-primary/40 bg-primary/10 text-primary'
                  : 'border-border text-ink-muted hover:border-primary/40 hover:text-ink',
              )}
            >
              <Archive className="size-3.5" />
              {includeArchive ? 'Showing archived' : `Hide older than ${DEFAULT_ARCHIVE_DAYS}d`}
            </Link>
          </div>
        </div>
      )}

      {activePolicy && (
        <div className="mb-5 rounded-xl border border-primary/30 bg-primary/5 p-4 text-sm">
          <div className="flex items-center gap-2 text-ink">
            <ShieldCheck className="size-4 text-primary" />
            <span className="font-medium">
              {activePolicy.insurerName}
              {activePolicy.planName ? ` · ${activePolicy.planName}` : ''}
            </span>
            <Badge tone="primary">policy no. {activePolicy.policyNumber}</Badge>
          </div>
          <p className="mt-1 text-xs text-ink-muted">
            Showing {analyses.length} {analyses.length === 1 ? 'analysis' : 'analyses'} for this
            policy. Uploads of the same policy number will keep appearing here across years.
          </p>
        </div>
      )}

      {analyses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <FileSearch className="mx-auto size-10 text-ink-subtle" aria-hidden />
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">
            {policyFilter
              ? 'No analyses for this policy yet'
              : includeArchive
                ? 'Nothing in your archive yet'
                : 'No analyses in the last 180 days'}
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            {includeArchive
              ? "Once you run a policy analysis, it stays here forever — no expiry for signed-in users."
              : "Try toggling 'Show archived' above, or upload a new policy."}
          </p>
          <div className="mt-5">
            <Link
              href={`/${locale}/policy-health-score/analyse`}
              className={buttonVariants({ variant: 'primary', size: 'md' })}
            >
              Upload my first policy
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-4">
          {analyses.map((a) => {
            const report = a.reportJson as
              | {
                  basic_facts?: { insurer_name?: string; plan_name?: string };
                  extractor?: { basic_facts?: { insurer_name?: string; plan_name?: string } };
                  quick_summary?: string;
                  coverage?: { quick_summary?: string };
                }
              | null;
            const status = a.status as keyof typeof STATUS_TONE;
            // Prefer v2 extractor/coverage fields; fall back to v1 for old rows.
            const insurer =
              report?.extractor?.basic_facts?.insurer_name ??
              report?.basic_facts?.insurer_name ??
              null;
            const plan =
              report?.extractor?.basic_facts?.plan_name ??
              report?.basic_facts?.plan_name ??
              null;
            const summary = report?.coverage?.quick_summary ?? report?.quick_summary ?? null;
            const linkedPolicy = a.policyId ? policiesById.get(a.policyId) : null;

            return (
              <li
                key={a.id}
                className="rounded-2xl border border-border bg-card p-5 shadow-card transition hover:border-primary/40 hover:shadow-floating"
              >
                <Link
                  href={`/${locale}/policy-health-score/analysis/${a.id}`}
                  className="block"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-display text-base font-semibold text-ink">
                          {insurer ?? 'Analysis'}
                          {plan ? ` · ${plan}` : ''}
                        </h3>
                        <Badge tone={STATUS_TONE[status] ?? 'neutral'}>{status}</Badge>
                        {linkedPolicy && !policyFilter && (
                          <Badge tone="primary">
                            <ShieldCheck className="mr-1 size-3" />
                            linked
                          </Badge>
                        )}
                      </div>
                      {summary ? (
                        <p className="mt-2 max-w-prose text-sm text-ink-muted">
                          {summary.slice(0, 220)}
                          {summary.length > 220 ? '…' : ''}
                        </p>
                      ) : a.errorMessage ? (
                        <p className="mt-2 flex items-start gap-1.5 text-sm text-danger">
                          <AlertTriangle className="mt-0.5 size-4 flex-none" aria-hidden />
                          <span>{a.errorMessage}</span>
                        </p>
                      ) : null}
                    </div>
                    <div className="flex flex-col items-end gap-1 text-xs text-ink-subtle">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3.5" />
                        {new Date(a.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                      {a.readinessScore != null ? (
                        <span className="inline-flex items-center gap-1 text-ink">
                          <ShieldCheck className="size-3.5 text-primary" aria-hidden />
                          {a.readinessScore}/100
                        </span>
                      ) : null}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function FilterChip({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs font-medium transition',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-border text-ink-muted hover:border-primary/40 hover:text-ink',
      )}
    >
      {label}
    </Link>
  );
}

function shortPolicyLabel(insurer: string, plan: string | null): string {
  const shortIns = insurer.length > 18 ? insurer.slice(0, 18) + '…' : insurer;
  const shortPlan = plan && plan.length > 16 ? plan.slice(0, 16) + '…' : plan;
  return shortPlan ? `${shortIns} · ${shortPlan}` : shortIns;
}
