'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { LogOut, User, FileText } from 'lucide-react';
import { buttonVariants } from '@suraksha/ui';
import { signOutAction } from '@/server/auth/actions';
import { cn } from '@/lib/cn';

interface Props {
  locale: string;
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  labels: {
    signIn: string;
    myAnalyses: string;
    signOut: string;
  };
}

/**
 * Header user menu. Shows a Sign-in link when anonymous, an avatar + dropdown
 * when signed in. Dropdown links to `/my/analyses` and a sign-out form action.
 */
export function UserMenu({ locale, user, labels }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Link
          href={`/${locale}/sign-in`}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          {labels.signIn}
        </Link>
        <Link
          href={`/${locale}/sign-up`}
          className={buttonVariants({ variant: 'primary', size: 'sm' })}
        >
          {locale === 'hi' ? 'खाता बनाएँ' : locale === 'kn' ? 'ಖಾತೆ ರಚಿಸಿ' : 'Sign up'}
        </Link>
      </div>
    );
  }

  const initial = (user.displayName ?? user.email ?? '?').charAt(0).toUpperCase();

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full border border-border bg-card px-1 py-1 pr-3 transition hover:border-primary/40 hover:bg-primary-subtle/30"
      >
        {user.avatarUrl ? (
          <Image
            src={user.avatarUrl}
            alt=""
            width={28}
            height={28}
            className="size-7 rounded-full"
          />
        ) : (
          <span className="flex size-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {initial}
          </span>
        )}
        <span className="max-w-[120px] truncate text-sm text-ink">
          {user.displayName ?? user.email}
        </span>
      </button>

      {open ? (
        <div
          role="menu"
          className={cn(
            'absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-border bg-card shadow-floating',
          )}
        >
          <div className="border-b border-border p-3 text-xs text-ink-subtle">
            Signed in as
            <div className="mt-0.5 truncate text-sm text-ink">{user.email ?? '—'}</div>
          </div>
          <Link
            href={`/${locale}/my/analyses`}
            role="menuitem"
            className="flex items-center gap-2 px-3 py-2 text-sm text-ink hover:bg-primary-subtle/40"
            onClick={() => setOpen(false)}
          >
            <FileText className="size-4 text-ink-muted" aria-hidden />
            {labels.myAnalyses}
          </Link>
          <form action={signOutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-sm text-ink hover:bg-primary-subtle/40"
            >
              <LogOut className="size-4 text-ink-muted" aria-hidden />
              {labels.signOut}
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
