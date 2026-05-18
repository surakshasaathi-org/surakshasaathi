'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Menu, X } from 'lucide-react';
import { Container, LocaleToggle } from '@suraksha/ui';
import { ACTIVE_LOCALES, LOCALE_NATIVE_NAME, type ActiveLocale } from '@suraksha/i18n/config';
import { UserMenu } from './auth/user-menu';

interface Props {
  locale: ActiveLocale;
  user: {
    id: string;
    email: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
}

/**
 * Sticky top nav. Logged-out shows marketing links + Sign in + Get started.
 * Logged-in collapses to Dashboard + avatar dropdown. Mobile uses a slide-down
 * sheet rather than the previous "everything visible" cram.
 */
export function SiteHeader({ locale, user }: Props) {
  const t = useTranslations('common');
  const pathname = usePathname();
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Lock body scroll when mobile sheet is open.
  useEffect(() => {
    if (mobileOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [mobileOpen]);

  // Close mobile sheet on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  function switchLocale(next: string) {
    const segments = pathname.split('/').filter(Boolean);
    if ((ACTIVE_LOCALES as readonly string[]).includes(segments[0] ?? '')) {
      segments.shift();
    }
    const rest = segments.length ? '/' + segments.join('/') : '';
    const target = next === 'en' ? rest || '/' : `/${next}${rest}`;
    startTransition(() => router.push(target));
  }

  const isLoggedIn = user !== null;
  const analyseHref = `/${locale}/policy-health-score/analyse`;

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link href={`/${locale}`} className="flex items-center gap-2.5">
          <BrandMark />
          <span className="font-display text-lg font-semibold tracking-tight text-ink">
            Suraksha Saathi
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-7 text-sm md:flex">
          {!isLoggedIn ? (
            <>
              <Link href={`/${locale}#why`} className="text-ink-muted transition hover:text-ink">
                Why
              </Link>
              <Link href={`/${locale}#how`} className="text-ink-muted transition hover:text-ink">
                How
              </Link>
              <Link href={`/${locale}#pricing`} className="text-ink-muted transition hover:text-ink">
                Pricing
              </Link>
              <Link
                href={`/${locale}#coming-soon`}
                className="text-ink-muted transition hover:text-ink"
              >
                What's coming
              </Link>
            </>
          ) : (
            <>
              <Link href={`/${locale}/my`} className="text-ink-muted transition hover:text-ink">
                Dashboard
              </Link>
              <Link
                href={`/${locale}/my/analyses`}
                className="text-ink-muted transition hover:text-ink"
              >
                My analyses
              </Link>
              <Link
                href={`/${locale}/my/policies`}
                className="text-ink-muted transition hover:text-ink"
              >
                Policies
              </Link>
            </>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <LocaleToggle
            options={ACTIVE_LOCALES.map((code) => ({ code, label: LOCALE_NATIVE_NAME[code] }))}
            current={locale}
            onSelect={switchLocale}
          />
          {!isLoggedIn ? (
            <>
              <Link
                href={`/${locale}/sign-in`}
                className="hidden text-sm font-medium text-ink-muted transition hover:text-ink md:inline-block"
              >
                {t('nav.login')}
              </Link>
              <Link
                href={analyseHref}
                className="hidden rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:bg-primary/90 md:inline-flex"
              >
                Get started →
              </Link>
            </>
          ) : (
            <UserMenu
              locale={locale}
              user={user}
              labels={{
                signIn: t('nav.login'),
                myAnalyses:
                  locale === 'hi'
                    ? 'मेरी पॉलिसी जाँचें'
                    : locale === 'kn'
                      ? 'ನನ್ನ ಪಾಲಿಸಿ ವಿಶ್ಲೇಷಣೆಗಳು'
                      : 'My analyses',
                signOut: locale === 'hi' ? 'साइन आउट' : locale === 'kn' ? 'ಸೈನ್ ಔಟ್' : 'Sign out',
              }}
            />
          )}
          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex size-10 items-center justify-center rounded-md text-ink-muted hover:bg-surface-hover md:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </Container>

      {/* Mobile sheet */}
      {mobileOpen && (
        <div className="fixed inset-x-0 top-16 z-30 h-[calc(100vh-4rem)] overflow-y-auto bg-background/98 backdrop-blur md:hidden">
          <Container className="flex flex-col gap-1 py-4 text-base">
            {!isLoggedIn ? (
              <>
                <SheetLink href={`/${locale}#why`}>Why this matters</SheetLink>
                <SheetLink href={`/${locale}#how`}>How it works</SheetLink>
                <SheetLink href={`/${locale}#pricing`}>Pricing</SheetLink>
                <SheetLink href={`/${locale}#coming-soon`}>What's coming</SheetLink>
                <div className="my-3 h-px bg-border/60" />
                <SheetLink href={`/${locale}/sign-in`} muted>
                  Sign in
                </SheetLink>
                <Link
                  href={analyseHref}
                  className="mt-3 inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-base font-semibold text-primary-foreground"
                >
                  Get started →
                </Link>
              </>
            ) : (
              <>
                <SheetLink href={`/${locale}/my`}>Dashboard</SheetLink>
                <SheetLink href={`/${locale}/my/analyses`}>My analyses</SheetLink>
                <SheetLink href={`/${locale}/my/policies`}>Policies</SheetLink>
                <SheetLink href={`/${locale}/my/family`}>Family</SheetLink>
                <SheetLink href={`/${locale}/my/settings`}>Settings</SheetLink>
                <div className="my-3 h-px bg-border/60" />
                <Link
                  href={analyseHref}
                  className="mt-3 inline-flex items-center justify-center rounded-full bg-primary px-5 py-3 text-base font-semibold text-primary-foreground"
                >
                  Analyse a policy →
                </Link>
              </>
            )}
          </Container>
        </div>
      )}
    </header>
  );
}

function SheetLink({
  href,
  children,
  muted,
}: {
  href: string;
  children: React.ReactNode;
  muted?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`block rounded-md px-2 py-3 transition hover:bg-surface-hover ${
        muted ? 'text-ink-muted' : 'text-ink'
      }`}
    >
      {children}
    </Link>
  );
}

/**
 * Brand mark — small mint-on-navy hex with the primary glow. Replaces the
 * old solid terracotta square; carries the new palette identity.
 */
function BrandMark() {
  return (
    <div className="relative size-8 shrink-0">
      <div className="absolute inset-0 rounded-lg bg-primary shadow-glow" />
      <div className="absolute inset-[3px] rounded-md bg-background" />
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display text-xs font-bold text-primary">SS</span>
      </div>
    </div>
  );
}
