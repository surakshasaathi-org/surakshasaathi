import type { ActiveLocale } from './config';

import enCommon from '../locales/en/common.json';
import enHero from '../locales/en/hero.json';
import enFooter from '../locales/en/footer.json';
import enAuth from '../locales/en/auth.json';
import enPricing from '../locales/en/pricing.json';

import hiCommon from '../locales/hi/common.json';
import hiHero from '../locales/hi/hero.json';
import hiFooter from '../locales/hi/footer.json';
import hiAuth from '../locales/hi/auth.json';
import hiPricing from '../locales/hi/pricing.json';

import knCommon from '../locales/kn/common.json';
import knHero from '../locales/kn/hero.json';
import knFooter from '../locales/kn/footer.json';
import knAuth from '../locales/kn/auth.json';
import knPricing from '../locales/kn/pricing.json';

/**
 * All namespaces bundled per active locale. Static imports so Next.js /
 * webpack can tree-shake and resolve without wildcard export paths.
 *
 * When a new namespace lands, add:
 *   1. `packages/i18n/locales/<locale>/<ns>.json` (for each active locale)
 *   2. A static import + a key on each locale's object below
 *   3. Any new top-level keys used by consumers
 */
export const MESSAGES: Record<ActiveLocale, Record<string, unknown>> = {
  en: {
    common: enCommon,
    hero: enHero,
    footer: enFooter,
    auth: enAuth,
    pricing: enPricing,
  },
  hi: {
    common: hiCommon,
    hero: hiHero,
    footer: hiFooter,
    auth: hiAuth,
    pricing: hiPricing,
  },
  kn: {
    common: knCommon,
    hero: knHero,
    footer: knFooter,
    auth: knAuth,
    pricing: knPricing,
  },
};

export function getMessages(locale: ActiveLocale): Record<string, unknown> {
  return MESSAGES[locale];
}
