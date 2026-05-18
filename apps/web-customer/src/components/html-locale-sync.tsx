'use client';

import { useEffect } from 'react';

/**
 * The root layout sets `<html lang="en">` because Next.js 15 requires the
 * html tag at the absolute root. This client component runs once per locale
 * layout mount to update `document.documentElement.lang` and `dir` so the
 * attributes match the actual route locale. Purely cosmetic for SEO and
 * accessibility; no visual change.
 */
export function HtmlLocaleSync({ locale, dir }: { locale: string; dir: 'ltr' | 'rtl' }) {
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);
  return null;
}
