'use client';

import { useState, type FormEvent } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@suraksha/ui';

/**
 * Waitlist email-capture form. Persists entries to localStorage (keyed by
 * module slug) so the same browser doesn't double-submit. When the real
 * backend lands, this swaps to a Server Action that inserts into a
 * `waitlist` table — UI contract stays the same.
 */
export interface WaitlistFormProps {
  moduleSlug: string;
  moduleName: string;
}

export function WaitlistForm({ moduleSlug, moduleName }: WaitlistFormProps) {
  // Namespace-scoped translator — keys live under `common.waitlist.*` in the
  // message bundles, so we scope here instead of prefixing every lookup.
  const t = useTranslations('common.waitlist');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'submitting' | 'done' | 'duplicate' | 'error'>('idle');

  const storageKey = `ss-waitlist:${moduleSlug}`;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setStatus('error');
      return;
    }
    setStatus('submitting');

    try {
      const existing = localStorage.getItem(storageKey);
      if (existing && existing === email.trim().toLowerCase()) {
        setStatus('duplicate');
        return;
      }

      // Placeholder — in prod, POST to /api/waitlist with module + email.
      await new Promise((r) => setTimeout(r, 400));

      localStorage.setItem(storageKey, email.trim().toLowerCase());
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'done') {
    return (
      <div className="rounded-md border border-success/30 bg-success-subtle px-4 py-3 text-sm text-success">
        {t('success')}
      </div>
    );
  }

  if (status === 'duplicate') {
    return (
      <div className="rounded-md border border-border bg-card px-4 py-3 text-sm text-ink-muted">
        {t('alreadyOnList')}
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-md flex-col gap-2 sm:flex-row">
      <label className="sr-only" htmlFor={`waitlist-email-${moduleSlug}`}>
        {moduleName} email
      </label>
      <input
        id={`waitlist-email-${moduleSlug}`}
        type="email"
        inputMode="email"
        autoComplete="email"
        required
        placeholder={t('emailPlaceholder')}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-11 flex-1 rounded-md border border-input bg-card px-3 text-sm outline-none ring-offset-2 focus-visible:ring-2"
      />
      <Button type="submit" size="md" disabled={status === 'submitting'}>
        {status === 'submitting' ? '…' : t('submit')}
      </Button>
    </form>
  );
}

export function WaitlistPrivacyNote() {
  const t = useTranslations('common.waitlist');
  return <p className="mt-2 text-xs text-ink-subtle">{t('privacyNote')}</p>;
}
