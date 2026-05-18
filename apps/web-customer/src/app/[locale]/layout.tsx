import type { ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { ACTIVE_LOCALES, LOCALE_IS_RTL, type ActiveLocale } from '@suraksha/i18n/config';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { HtmlLocaleSync } from '@/components/html-locale-sync';
import { getCurrentUser } from '@/lib/current-user';

interface LocaleLayoutProps {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}

export function generateStaticParams() {
  return ACTIVE_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: LocaleLayoutProps) {
  const { locale } = await params;
  if (!(ACTIVE_LOCALES as readonly string[]).includes(locale)) {
    notFound();
  }
  const messages = await getMessages();
  const isRtl = LOCALE_IS_RTL[locale as ActiveLocale];
  const user = await getCurrentUser();

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <HtmlLocaleSync locale={locale} dir={isRtl ? 'rtl' : 'ltr'} />
      <SiteHeader locale={locale as ActiveLocale} user={user} />
      <main>{children}</main>
      <SiteFooter />
    </NextIntlClientProvider>
  );
}
