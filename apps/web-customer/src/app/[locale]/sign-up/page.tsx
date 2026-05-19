import Link from 'next/link';
import { SignUpCard } from '@/components/auth/sign-up-card';
import { AuthSplit } from '@/components/marketing/auth-split';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}

export default async function SignUpPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === 'true';

  return (
    <AuthSplit
      locale={locale}
      pitch={{
        eyebrow: 'Your protection, saved',
        headline: "A companion for every chapter — saved to your account, forever.",
        body: "Analyse any policy. Track every renewal. Recover money from mis-sold ULIPs. We keep the receipts so when the insurer pushes back, you have evidence.",
        quote: 'The Ombudsman asked for a specific clause on page 14 of my policy. I found it in 30 seconds because Suraksha had mapped every one.',
        quoteAttribution: '— The Singh family, Lucknow',
      }}
    >
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
          Create your account
        </div>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight text-ink">
          Start with a free policy analysis.
        </h1>
        <p className="mt-4 text-base text-ink-muted">
          60 seconds. No credit card. No phone calls. No spam.
        </p>
      </div>

      <SignUpCard locale={locale} next={sp.next ?? '/my/analyses'} googleEnabled={googleEnabled} />

      <p className="mt-6 text-xs leading-relaxed text-ink-subtle">
        By creating an account you agree to our{' '}
        <Link href={`/${locale}/terms`} className="underline">
          Terms
        </Link>{' '}
        and{' '}
        <Link href={`/${locale}/privacy`} className="underline">
          Privacy Policy
        </Link>
        . Your data stays on Indian servers — export or delete everything any time from Settings.
      </p>
    </AuthSplit>
  );
}
