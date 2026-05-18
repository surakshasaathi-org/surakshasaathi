import { redirect } from 'next/navigation';
import { Container } from '@suraksha/ui';
import { getMyProfile } from '@/server/auth/profile';
import { OnboardingForm } from '@/components/auth/onboarding-form';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}

/**
 * Shown after the first sign-in (or any time profile_completed_at IS NULL).
 * Collects the remaining fields — name is required, phone/DOB/gender are
 * nudged but skippable.
 *
 * Already-complete users get quietly redirected to their next destination,
 * so landing here twice doesn't trap them.
 */
export default async function OnboardingPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const next = sp.next ?? '/my/analyses';

  const profile = await getMyProfile();
  if (!profile) {
    redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/onboarding`)}`);
  }
  if (profile.profileCompletedAt) {
    redirect(`/${locale}${next}`);
  }

  return (
    <section className="bg-gradient-to-b from-primary-subtle/40 via-background to-background py-16">
      <Container className="max-w-lg">
        <div className="mb-6">
          <div className="text-xs font-semibold uppercase tracking-wider text-primary">
            One more step
          </div>
          <h1 className="mt-2 font-display text-3xl font-semibold leading-tight tracking-tight text-ink">
            Tell us a bit about you
          </h1>
          <p className="mt-3 text-sm text-ink-muted">
            We use this to personalise your policy reports and check which government schemes you
            qualify for. Phone and DOB are optional — you can skip and add later.
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
          <OnboardingForm
            locale={locale}
            next={next}
            initial={{
              fullName: profile.fullName,
              phoneE164: profile.phoneE164,
              gender: profile.gender,
              dateOfBirth: profile.dateOfBirth,
              email: profile.email,
            }}
          />
        </div>

        <p className="mt-6 text-xs text-ink-subtle">
          Your data is stored on Indian servers per DPDP Act 2023. We never share your phone or DOB
          with insurers.
        </p>
      </Container>
    </section>
  );
}
