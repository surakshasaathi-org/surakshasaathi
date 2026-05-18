import { defineRouting } from 'next-intl/routing';
import { createSharedPathnamesNavigation } from 'next-intl/navigation';
import { ACTIVE_LOCALES, DEFAULT_LOCALE } from '@suraksha/i18n/config';

export const routing = defineRouting({
  locales: ACTIVE_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'as-needed', // default locale at /, others at /hi, /kn
});

export const { Link, redirect, usePathname, useRouter } = createSharedPathnamesNavigation(routing);
