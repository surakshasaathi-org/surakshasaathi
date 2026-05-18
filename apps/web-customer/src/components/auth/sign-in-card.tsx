'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Check, Mail, Lock, Eye, EyeOff } from 'lucide-react';
import { Button } from '@suraksha/ui';
import { sendEmailMagicLink, signInWithPassword } from '@/server/auth/actions';
import { supabaseBrowser } from '@/lib/supabase-browser';
import { cn } from '@/lib/cn';

interface Props {
  locale: string;
  next: string;
  googleEnabled: boolean;
  error: string | null;
  labels: {
    emailLabel: string;
    emailPlaceholder: string;
    send: string;
    sending: string;
    googleButton: string;
    or: string;
  };
}

type Mode = 'password' | 'magic_link';

export function SignInCard({ locale, next, googleEnabled, error, labels }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('password');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [message, setMessage] = useState<string | null>(
    error ? `Sign-in failed: ${decodeURIComponent(error)}` : null,
  );
  const [pending, startTransition] = useTransition();

  function handlePasswordSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      setStatus('sending');
      setMessage(null);
      const result = await signInWithPassword(email, password, next);
      if (result.ok) {
        router.push(`/${locale}${result.nextPath}`);
        router.refresh();
      } else {
        setStatus('error');
        setMessage(result.message);
      }
    });
  }

  function handleMagicLinkSubmit(e: FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      setStatus('sending');
      setMessage(null);
      const result = await sendEmailMagicLink(email, next);
      if (result.ok) {
        setStatus('sent');
        setMessage(result.message);
      } else {
        setStatus('error');
        setMessage(result.message);
      }
    });
  }

  async function onGoogleClick() {
    const client = supabaseBrowser();
    const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
    const { error } = await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
    if (error) {
      setStatus('error');
      setMessage(error.message);
    }
  }

  // Magic-link sent → show inbox hint, hide form.
  if (status === 'sent') {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="flex items-start gap-3 rounded-lg border border-success/30 bg-success-subtle/60 px-4 py-3 text-sm">
          <Check className="mt-0.5 size-4 flex-none text-success" aria-hidden />
          <div>
            <div className="font-medium text-ink">{message}</div>
            <div className="mt-1 text-xs text-ink-muted">
              Dev: open{' '}
              <a
                href="http://127.0.0.1:54324"
                target="_blank"
                rel="noopener"
                className="underline"
              >
                Mailpit
              </a>{' '}
              to click the link.
            </div>
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
            <GoogleG />
            {labels.googleButton}
          </button>
          <div className="relative my-6 flex items-center">
            <div className="grow border-t border-border" />
            <span className="px-3 text-xs uppercase tracking-wide text-ink-subtle">
              {labels.or}
            </span>
            <div className="grow border-t border-border" />
          </div>
        </>
      )}

      <ModeTabs mode={mode} setMode={setMode} />

      {mode === 'password' ? (
        <form onSubmit={handlePasswordSubmit} className="mt-4 space-y-3">
          <EmailField email={email} setEmail={setEmail} label={labels.emailLabel} placeholder={labels.emailPlaceholder} />
          <label className="block">
            <span className="text-sm font-medium text-ink">Password</span>
            <div className="relative mt-1">
              <Lock className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                autoComplete="current-password"
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
          </label>
          <Button type="submit" className="w-full" size="lg" disabled={pending}>
            {pending ? 'Signing in…' : 'Sign in'}
          </Button>
          <div className="flex items-center justify-between pt-1 text-xs">
            <a href={`/${locale}/sign-up?next=${encodeURIComponent(next)}`} className="text-primary hover:underline">
              Create account
            </a>
            <button
              type="button"
              onClick={() => setMode('magic_link')}
              className="text-ink-subtle hover:text-ink"
            >
              Forgot? Email me a link instead
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={handleMagicLinkSubmit} className="mt-4 space-y-3">
          <EmailField email={email} setEmail={setEmail} label={labels.emailLabel} placeholder={labels.emailPlaceholder} />
          <Button type="submit" className="w-full" size="lg" disabled={pending}>
            {pending ? labels.sending : labels.send}
          </Button>
          <div className="pt-1 text-xs">
            <button
              type="button"
              onClick={() => setMode('password')}
              className="text-ink-subtle hover:text-ink"
            >
              ← Back to password sign-in
            </button>
          </div>
        </form>
      )}

      {status === 'error' && message && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 flex-none" aria-hidden />
          <span>{message}</span>
        </div>
      )}
    </div>
  );
}

function ModeTabs({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-background p-1 text-xs">
      <TabButton active={mode === 'password'} onClick={() => setMode('password')}>
        Password
      </TabButton>
      <TabButton active={mode === 'magic_link'} onClick={() => setMode('magic_link')}>
        Email link
      </TabButton>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md px-3 py-1.5 font-medium transition',
        active ? 'bg-card text-ink shadow-card' : 'text-ink-muted hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function EmailField({
  email,
  setEmail,
  label,
  placeholder,
}: {
  email: string;
  setEmail: (v: string) => void;
  label: string;
  placeholder: string;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-ink">{label}</span>
      <div className="relative mt-1">
        <Mail className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-muted" aria-hidden />
        <input
          type="email"
          required
          autoComplete="email"
          placeholder={placeholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="h-11 w-full rounded-md border border-input bg-card px-3 py-2 pl-9 text-sm outline-none focus:border-primary"
        />
      </div>
    </label>
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
