import Link from 'next/link';
import { ShieldCheck, Plus, ArrowLeftRight } from 'lucide-react';
import { buttonVariants } from '@suraksha/ui';
import { listMyPolicies } from '@/server/policies/actions';
import { PolicyCard } from '@/components/my/policy-card';

interface Props {
  params: Promise<{ locale: string }>;
}

/**
 * Canonical "My Policies" — one row per owned policy, auto-populated from
 * the analysis pipeline whenever the extractor identifies a clean insurer +
 * policy_number. Re-uploads of the same policy next year link back here.
 */
export const dynamic = 'force-dynamic';

export default async function PoliciesPage({ params }: Props) {
  const { locale } = await params;
  const policies = await listMyPolicies();

  return (
    <div>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <ShieldCheck className="size-3.5" />
            Your policies
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            What you own, across years
          </h1>
          <p className="mt-2 max-w-prose text-ink-muted">
            One row per policy. When you upload next year's renewal, it links here automatically —
            so you can see sum-assured changes, premium creep, and coverage shifts year-over-year.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {policies.length >= 2 && (
            <Link
              href={`/${locale}/my/policies/compare`}
              className={buttonVariants({ variant: 'outline', size: 'md' })}
            >
              <ArrowLeftRight className="mr-1.5 size-4" />
              Compare
            </Link>
          )}
          <Link
            href={`/${locale}/policy-health-score/analyse`}
            className={buttonVariants({ variant: 'primary', size: 'md' })}
          >
            <Plus className="mr-1.5 size-4" />
            Add a policy
          </Link>
        </div>
      </header>

      {policies.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <ShieldCheck className="mx-auto size-10 text-ink-subtle" />
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">
            No policies linked yet
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Upload any health policy PDF and we'll auto-populate this list with the insurer, plan,
            sum assured, and renewal date.
          </p>
          <div className="mt-5">
            <Link
              href={`/${locale}/policy-health-score/analyse`}
              className={buttonVariants({ variant: 'primary', size: 'md' })}
            >
              <Plus className="mr-1.5 size-4" />
              Upload my first policy
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-4">
          {policies.map((p) => (
            <PolicyCard key={p.id} policy={p} locale={locale} />
          ))}
        </ul>
      )}
    </div>
  );
}
