import { redirect } from 'next/navigation';
import { Settings } from 'lucide-react';
import { getMyProfile } from '@/server/auth/profile';
import { listMyConsents } from '@/server/auth/consent';
import { CONSENT_PURPOSES } from '@/server/auth/consent-config';
import { SettingsSections } from '@/components/my/settings-sections';

interface Props {
  params: Promise<{ locale: string }>;
}

export const dynamic = 'force-dynamic';

export default async function SettingsPage({ params }: Props) {
  const { locale } = await params;
  const [profile, consents] = await Promise.all([getMyProfile(), listMyConsents()]);
  if (!profile) {
    redirect(`/${locale}/sign-in?next=${encodeURIComponent(`/${locale}/my/settings`)}`);
  }

  return (
    <div>
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Settings className="size-3.5" />
          Settings
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Account &amp; privacy
        </h1>
        <p className="mt-2 max-w-prose text-ink-muted">
          Update your profile, change language, toggle granular DPDP consents, export your data
          (right-to-access), or delete your account.
        </p>
      </header>

      <SettingsSections
        profile={profile}
        currentLocale={locale}
        consents={consents}
        consentPurposes={CONSENT_PURPOSES.map((p) => ({
          id: p.id,
          label: p.label,
          description: p.description,
          required: p.required,
        }))}
      />
    </div>
  );
}
