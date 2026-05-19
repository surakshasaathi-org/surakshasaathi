'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Mail, Lock, Eye, EyeOff, User } from 'lucide-react';
import { Button } from '@suraksha/ui';
import { signUpWithPassword } from '@/server/auth/actions';
import { completeProfile } from '@/server/auth/profile';
import { supabaseBrowser } from '@/lib/supabase-browser';

interface Props {
  locale: string;
  next: string;
  googleEnabled: boolean;
}

/**
 * Two-step signup:
 *   Step 1 — full name, email, password. Calls signUpWithPassword().
 *             If email confirmation is required (Supabase default), we show
 *             an "inbox" state; the confirm link lands the user on
 *             /auth/callback which pushes them to /onboarding where the
 *             rest of the profile (phone/DOB/gender) is collected.
 *             If no confirm is required, we call completeProfile() inline
 *             to save the name and redirect.
 *   (Google)  — skips directly to /onboarding via the callback.
 */
export function SignUpCard({ locale, next, googleEnabled }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [_pending, startTransition] = useTransition();

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    // Hard guard against double-submit: React 19 + dev-mode sometimes replays
    // handlers, and a single stray click/Enter while an earlier request is
    // still in-flight would otherwise cause Supabase to reject the second try
    // with "User already registered".
    if (status === 'submitting' || status === 'sent') return;
    if (fullName.trim().length < 2) {
      setStatus('error');
      setMessage('Please enter your full name.');
      return;
    }
    setStatus('submitting');
    setMessage(null);

    startTransition(async () => {
      // Redirect after confirm goes to /onboarding so the user can finish
      // phone/DOB/gender. If no confirm needed, we complete profile inline.
      const redirectNext = `/${locale}/onboarding?next=${encodeURIComponent(next)}`;
      const result = await signUpWithPassword(email, password, redirectNext);
      if (!result.ok) {
        setStatus('error');
        setMessage(result.message);
        return;
      }
      if (result.needsEmailConfirm) {
        setStatus('sent');
        setMessage(
          "Check your inbox for a confirmation link. We'll ask for your phone and DOB right after.",
        );
        return;
      }
      // Session already active (confirm-disabled setup) — store the name.
      const prof = await completeProfile({ fullName });
      if (!prof.ok) {
        setStatus('error');
        setMessage(prof.message);
        return;
      }
      router.push(`/${locale}/onboarding?next=${encodeURIComponent(next)}`);
      router.refresh();
    });
  }

  async function onGoogleClick() {
    const client = supabaseBrowser();
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // After OAuth, land in onboarding so we can collect the missing bits.
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(
          `/${locale}/onboarding?next=${encodeURIComponent(next)}`,
        )}`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) {
      setStatus('error');
      setMessage(error.message);
    }
  }

  if (status === 'sent') {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success-subtle/60 px-4 py-3 text-sm">
          <Check className="mt-0.5 size-4 flex-none text-success" />
          <div>
            <div className="font-medium text-ink">{message}</div>
            {process.env.NEXT_PUBLIC_APP_ENV === 'local' && (
              <div className="mt-1 text-xs text-ink-muted">
                Dev:{' '}
                <a href="http://127.0.0.1:54324" target="_blank" rel="noopener" className="underline">
                  Mailpit
                </a>{' '}
                to open it.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
      {googleEnabled && (
        <>
          <button
            type="button"
            onClick={onGoogleClick}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-4 py-2.5 text-sm font-medium text-ink transition hover:bg-primary-subtle/50"
          >
            <GoogleG /> Continue with Google
          </button>
          <div className="relative my-6 flex items-center">
            <div className="grow border-t border-border" />
            <span className="px-3 text-xs uppercase tracking-wide text-ink-subtle">or</span>
            <div className="grow border-t border-border" />
          </div>
        </>
      )}

      <form onSubmit={onSubmit} className="space-y-3">
        <label className="block">
          <span className="text-sm font-medium text-ink">Full name</span>
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
          <span className="text-sm font-medium text-ink">Email</span>
          <div className="relative mt-1">
            <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="you@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-card px-3 py-2 pl-9 text-sm outline-none focus:border-primary"
            />
          </div>
        </label>

        <label className="block">
          <span className="text-sm font-medium text-ink">Password</span>
          <div className="relative mt-1">
            <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="new-password"
              minLength={8}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-card px-3 py-2 pl-9 pr-10 text-sm outline-none focus:border-primary"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-ink-muted hover:text-ink"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
          <p className="mt-1 text-xs text-ink-subtle">
            Minimum 8 characters. We never email you marketing — only account stuff.
          </p>
        </label>

        <Button type="submit" className="w-full" size="lg" disabled={status === 'submitting'}>
          {status === 'submitting' ? 'Creating account…' : 'Create account'}
        </Button>

        {status === 'error' && message && (
          <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger">
            <AlertCircle className="mt-0.5 size-4 flex-none" />
            <span>{message}</span>
          </div>
        )}

        <p className="pt-1 text-xs text-ink-subtle">
          Already have an account?{' '}
          <a
            href={`/${locale}/sign-in?next=${encodeURIComponent(next)}`}
            className="text-primary hover:underline"
          >
            Sign in
          </a>
        </p>
      </form>
    </div>
  );
}

function GoogleG() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.8h5.36c-.24 1.5-1.72 4.4-5.36 4.4-3.24 0-5.88-2.68-5.88-6s2.64-6 5.88-6c1.84 0 3.08.78 3.78 1.46l2.58-2.48C16.86 3.86 14.72 3 12 3 6.86 3 2.7 7.16 2.7 12.3S6.86 21.6 12 21.6c6.92 0 9.48-4.86 9.48-9.36 0-.62-.06-1.08-.16-1.56H12z"
      />
    </svg>
  );
}
