import type { Locale } from '@suraksha/types';

/**
 * Locales enabled at MVP. Must match seed/locales.ts `enabled=true`.
 * Update BOTH when phasing in a new language.
 */
export const ACTIVE_LOCALES = ['en', 'hi', 'kn'] as const satisfies readonly Locale[];
export type ActiveLocale = (typeof ACTIVE_LOCALES)[number];

export const DEFAULT_LOCALE: ActiveLocale = 'en';

/**
 * Namespaces loaded by default on every page. Feature-specific namespaces
 * can be lazily required via `getTranslations(namespace)`.
 */
export const DEFAULT_NAMESPACES = ['common', 'hero', 'footer', 'auth', 'pricing'] as const;
export type Namespace = (typeof DEFAULT_NAMESPACES)[number];

/**
 * Human-readable names (also seeded in DB — kept here for offline contexts like emails).
 */
export const LOCALE_NATIVE_NAME: Record<ActiveLocale, string> = {
  en: 'English',
  hi: 'हिन्दी',
  kn: 'ಕನ್ನಡ',
};

export const LOCALE_IS_RTL: Partial<Record<Locale, boolean>> = {
  ur: true,
};
