import { getRequestConfig } from 'next-intl/server';
import { ACTIVE_LOCALES, DEFAULT_LOCALE, type ActiveLocale } from '@suraksha/i18n/config';
import { getMessages } from '@suraksha/i18n';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = (await requestLocale) ?? DEFAULT_LOCALE;
  const locale: ActiveLocale = (ACTIVE_LOCALES as readonly string[]).includes(requested)
    ? (requested as ActiveLocale)
    : DEFAULT_LOCALE;

  return {
    locale,
    messages: getMessages(locale) as Record<string, Record<string, unknown>>,
  };
});
