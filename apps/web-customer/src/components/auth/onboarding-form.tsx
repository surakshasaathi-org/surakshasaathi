'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, User, Phone, Calendar, Users as UsersIcon } from 'lucide-react';
import { Button } from '@suraksha/ui';
import { completeProfile } from '@/server/auth/profile';

interface Props {
  locale: string;
  next: string;
  initial: {
    fullName: string | null;
    phoneE164: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    email: string | null;
  };
}

const GENDER_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

/**
 * Collects the remaining profile fields after sign-up / OAuth. Name is
 * required (pre-filled if password-signup already saved it). Phone / DOB /
 * gender are optional but nudged — they power scheme eligibility and claim-
 * filing later.
 */
export function OnboardingForm({ locale, next, initial }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(initial.fullName ?? '');
  const [phone, setPhone] = useState(initial.phoneE164?.replace(/^\+91/, '') ?? '');
  const [gender, setGender] = useState(initial.gender ?? '');
  const [dob, setDob] = useState(initial.dateOfBirth ?? '');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: FormEvent, skipExtras = false) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const payload = skipExtras
        ? { fullName }
        : {
            fullName,
            phoneE164: phone.trim() || null,
            gender: gender || null,
            dateOfBirth: dob || null,
          };
      const result = await completeProfile(payload);
      if (!result.ok) {
        setError(result.message);
        return;
      }
      router.push(`/${locale}${next}`);
      router.refresh();
    });
  }

  return (
    <form onSubmit={(e) => submit(e, false)} className="space-y-5">
      {initial.email && (
        <div className="rounded-lg bg-background/60 px-3 py-2 text-xs text-ink-subtle">
          Signed in as <span className="font-medium text-ink">{initial.email}</span>
        </div>
      )}

      <label className="block">
        <span className="text-sm font-medium text-ink">
          Full name <span className="text-danger">*</span>
        </span>
        <div className="relative mt-1">
          <User className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
          <input
            type="text"
            required
            autoComplete="name"
            placeholder="Your name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="h-11 w-full rounded-md border border-input bg-card px-3 py-2 pl-9 text-sm outline-none focus:border-primary"
          />
        </div>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-ink">Mobile number</span>
        <div className="relative mt-1 flex gap-2">
          <span className="inline-flex h-11 items-center rounded-md border border-input bg-background px-3 text-sm text-ink-muted">
            +91
          </span>
          <div className="relative flex-1">
            <Phone className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="10-digit mobile"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
              className="h-11 w-full rounded-md border border-input bg-card px-3 py-2 pl-9 text-sm outline-none focus:border-primary"
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-ink-subtle">
          Optional. We'll use it to send claim updates — never marketing.
        </p>
      </label>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-ink">Date of birth</span>
          <div className="relative mt-1">
            <Calendar className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="date"
              value={dob}
              onChange={(e) => setDob(e.target.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="h-11 w-full rounded-md border border-input bg-card px-3 py-2 pl-9 text-sm outline-none focus:border-primary"
            />
          </div>
          <p className="mt-1 text-xs text-ink-subtle">Age-based govt scheme matching.</p>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">Gender</span>
          <div className="relative mt-1">
            <UsersIcon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-card px-3 py-2 pl-9 text-sm outline-none focus:border-primary"
            >
              <option value="">Select…</option>
              {GENDER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
        </label>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 flex-none" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button type="submit" size="lg" disabled={pending}>
          {pending ? 'Saving…' : 'Continue'}
        </Button>
        <button
          type="button"
          onClick={(e) => submit(e as unknown as FormEvent, true)}
          disabled={pending}
          className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
        >
          Skip extras — save just my name
        </button>
      </div>
    </form>
  );
}
