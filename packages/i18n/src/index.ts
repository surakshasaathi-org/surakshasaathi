export * from './config';
export * from './glossary';
export * from './messages';

/**
 * Resolve a DB-sourced I18nText (e.g. ProductModule.nameI18n) to the best
 * available string for the caller's locale. Falls back: requested → English
 * → first available → fallback argument.
 */
export function resolveI18n(
  map: Record<string, string> | null | undefined,
  locale: string,
  fallback = '',
): string {
  if (!map) return fallback;
  if (map[locale]) return map[locale];
  if (map.en) return map.en;
  const first = Object.values(map)[0];
  return first ?? fallback;
}
