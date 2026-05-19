'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Check,
  Download,
  Languages,
  ShieldCheck,
  Trash2,
  User,
  Phone,
  Calendar,
  Users as UsersIcon,
} from 'lucide-react';
import { Button } from '@suraksha/ui';
import { cn } from '@/lib/cn';
import { completeProfile, type Profile } from '@/server/auth/profile';
import {
  deleteMyAccountAndRedirect,
  exportMyData,
  updatePreferredLocale,
} from '@/server/auth/account';
import type { ConsentState } from '@/server/auth/consent-config';
import { ConsentToggles } from './consent-toggles';

interface ConsentPurposeDef {
  id: string;
  label: string;
  description: string;
  required: boolean;
}

interface Props {
  profile: Profile;
  currentLocale: string;
  consents?: ConsentState[];
  consentPurposes?: ConsentPurposeDef[];
}

const LOCALE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'हिन्दी' },
  { value: 'kn', label: 'ಕನ್ನಡ' },
];

const GENDER_OPTIONS = [
  { value: '', label: '—' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

export function SettingsSections({
  profile,
  currentLocale,
  consents,
  consentPurposes,
}: Props) {
  return (
    <div className="space-y-8">
      <ProfileSection profile={profile} />
      <LanguageSection currentLocale={currentLocale} />
      {consents && consentPurposes && (
        <ConsentSection consents={consents} purposes={consentPurposes} />
      )}
      <ExportSection />
      <DangerSection />
    </div>
  );
}

/* ────────── Consents ────────── */

function ConsentSection({
  consents,
  purposes,
}: {
  consents: ConsentState[];
  purposes: ConsentPurposeDef[];
}) {
  return (
    <SectionCard
      title="Privacy & consents"
      subtitle="Granular control over how your data is used. Toggle any purpose off any time — we append an audit entry on every change."
      icon={<ShieldCheck className="size-4 text-primary" />}
    >
      <ConsentToggles purposes={purposes} initialStates={consents} />
    </SectionCard>
  );
}

/* ────────── Profile ────────── */

function ProfileSection({ profile }: { profile: Profile }) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.fullName ?? '');
  const [phone, setPhone] = useState(profile.phoneE164?.replace(/^\+91/, '') ?? '');
  const [gender, setGender] = useState(profile.gender ?? '');
  const [dob, setDob] = useState(profile.dateOfBirth ?? '');
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<null | 'ok' | { message: string }>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      setStatus(null);
      const res = await completeProfile({
        fullName,
        phoneE164: phone.trim() || null,
        gender: gender || null,
        dateOfBirth: dob || null,
      });
      if (!res.ok) {
        setStatus({ message: res.message });
        return;
      }
      setStatus('ok');
      router.refresh();
    });
  }

  return (
    <SectionCard title="Profile" subtitle="Your account holder details.">
      <form onSubmit={onSubmit} className="space-y-4">
        <Field icon={<User className="size-4" />} label="Full name">
          <input
            type="text"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field icon={<Phone className="size-4" />} label="Mobile">
            <div className="flex gap-2">
              <span className="inline-flex h-10 items-center rounded-md border border-input bg-background px-3 text-sm text-ink-muted">
                +91
              </span>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
                placeholder="10-digit number"
              />
            </div>
          </Field>

          <Field icon={<Calendar className="size-4" />} label="Date of birth">
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </Field>
        </div>

        <Field icon={<UsersIcon className="size-4" />} label="Gender">
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          >
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={pending}>
            {pending ? 'Saving…' : 'Save profile'}
          </Button>
          {status === 'ok' && (
            <span className="inline-flex items-center gap-1 text-xs text-success">
              <Check className="size-3.5" /> Saved
            </span>
          )}
          {status && status !== 'ok' && (
            <span className="inline-flex items-center gap-1 text-xs text-danger">
              <AlertCircle className="size-3.5" /> {status.message}
            </span>
          )}
        </div>
      </form>
    </SectionCard>
  );
}

/* ────────── Language ────────── */

function LanguageSection({ currentLocale }: { currentLocale: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState<string | null>(null);

  function onChange(next: string) {
    if (pending) return;
    startTransition(async () => {
      const res = await updatePreferredLocale(next);
      if (!res.ok) return;
      setSaved(next);
      // Navigate to the same page under the new locale so the UI reflects it.
      const currentPath = window.location.pathname.replace(/^\/(en|hi|kn)/, `/${next}`);
      router.push(currentPath);
      router.refresh();
    });
  }

  return (
    <SectionCard
      title="Language"
      subtitle="We'll use this for your reports, emails, and chat replies."
      icon={<Languages className="size-4 text-primary" />}
    >
      <div className="flex flex-wrap gap-2">
        {LOCALE_OPTIONS.map((o) => {
          const active = (saved ?? currentLocale) === o.value;
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              disabled={pending}
              className={cn(
                'rounded-full border px-4 py-2 text-sm transition',
                active
                  ? 'border-primary bg-primary/10 font-medium text-primary'
                  : 'border-border text-ink-muted hover:border-primary/40 hover:text-ink',
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </SectionCard>
  );
}

/* ────────── Export ────────── */

function ExportSection() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onExport() {
    startTransition(async () => {
      setError(null);
      const res = await exportMyData();
      if (!res.ok) {
        setError(res.message);
        return;
      }
      const blob = new Blob([JSON.stringify(res.data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `surakshasaathi-export-${res.generatedAt.slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  return (
    <SectionCard
      title="Export your data"
      subtitle="Download everything we hold on you as a JSON file, any time."
      icon={<Download className="size-4 text-primary" />}
    >
      <Button type="button" variant="outline" onClick={onExport} disabled={pending}>
        <Download className="mr-1.5 size-4" />
        {pending ? 'Preparing…' : 'Download my data'}
      </Button>
      {error && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-danger">
          <AlertCircle className="size-3.5" /> {error}
        </p>
      )}
    </SectionCard>
  );
}

/* ────────── Delete ────────── */

function DangerSection() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onDelete() {
    startTransition(async () => {
      setError(null);
      try {
        await deleteMyAccountAndRedirect(confirmation);
      } catch (e) {
        setError((e as Error).message);
      }
    });
  }

  return (
    <SectionCard
      title="Delete account"
      subtitle="Permanently removes your profile, family, policies, analyses, and chat history. This cannot be undone."
      tone="danger"
      icon={<Trash2 className="size-4 text-danger" />}
    >
      {!showConfirm ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowConfirm(true)}
          className="border-danger/40 text-danger hover:bg-danger/5"
        >
          <Trash2 className="mr-1.5 size-4" />
          Delete my account
        </Button>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-ink-muted">
            Type <code className="rounded bg-background px-1.5 py-0.5 text-ink">delete my account</code> to confirm.
          </p>
          <input
            type="text"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            className="h-10 w-full max-w-xs rounded-md border border-danger/40 bg-background px-3 text-sm outline-none focus:border-danger"
            autoComplete="off"
          />
          <div className="flex items-center gap-2">
            <Button
              type="button"
              onClick={onDelete}
              disabled={pending || confirmation.trim().toLowerCase() !== 'delete my account'}
              className="bg-danger text-white hover:bg-danger/90"
            >
              {pending ? 'Deleting…' : 'Permanently delete'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setShowConfirm(false);
                setConfirmation('');
                setError(null);
              }}
              className="text-sm text-ink-muted hover:text-ink"
              disabled={pending}
            >
              Cancel
            </button>
          </div>
          {error && (
            <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger">
              <AlertCircle className="mt-0.5 size-4 flex-none" />
              <span>{error}</span>
            </div>
          )}
        </div>
      )}
    </SectionCard>
  );
}

/* ────────── Primitives ────────── */

function SectionCard({
  title,
  subtitle,
  children,
  tone,
  icon,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  tone?: 'danger';
  icon?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        'rounded-2xl border bg-card p-6 shadow-card',
        tone === 'danger' ? 'border-danger/30' : 'border-border',
      )}
    >
      <header className="mb-4 flex items-start gap-3">
        {icon && <div className="mt-0.5">{icon}</div>}
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-1 max-w-prose text-sm text-ink-muted">{subtitle}</p>}
        </div>
      </header>
      {children}
    </section>
  );
}

function Field({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
        {icon}
        {label}
      </span>
      {children}
    </label>
  );
}
