#!/usr/bin/env tsx
/**
 * Language completeness checker.
 * Ensures every active locale has a translation for every key that English does.
 * Run in CI via `pnpm -w i18n:check`. Blocks deployment if anything's missing.
 */
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ACTIVE_LOCALES, DEFAULT_LOCALE } from '../src/config';

type Nested = string | { [k: string]: Nested };

function flatten(obj: Nested, prefix = ''): string[] {
  if (typeof obj === 'string') return [prefix];
  if (Array.isArray(obj)) return obj.flatMap((v, i) => flatten(v, `${prefix}[${i}]`));
  return Object.entries(obj).flatMap(([k, v]) =>
    flatten(v, prefix ? `${prefix}.${k}` : k),
  );
}

async function loadNamespace(locale: string, ns: string): Promise<Nested> {
  const path = join(__dirname, '..', 'locales', locale, `${ns}.json`);
  const raw = await readFile(path, 'utf8');
  return JSON.parse(raw);
}

async function main() {
  const base = DEFAULT_LOCALE;
  const enDir = join(__dirname, '..', 'locales', base);
  const files = (await readdir(enDir)).filter((f) => f.endsWith('.json'));
  const namespaces = files.map((f) => f.replace('.json', ''));

  let fail = 0;

  for (const ns of namespaces) {
    const baseKeys = new Set(flatten(await loadNamespace(base, ns)));
    for (const locale of ACTIVE_LOCALES) {
      if (locale === base) continue;
      let keys: Set<string>;
      try {
        keys = new Set(flatten(await loadNamespace(locale, ns)));
      } catch {
        console.error(`❌ missing file locales/${locale}/${ns}.json`);
        fail++;
        continue;
      }
      const missing = [...baseKeys].filter((k) => !keys.has(k));
      const extra = [...keys].filter((k) => !baseKeys.has(k));
      if (missing.length) {
        console.error(`❌ ${locale}/${ns}: ${missing.length} missing keys`);
        missing.slice(0, 10).forEach((k) => console.error(`     ${k}`));
        fail++;
      }
      if (extra.length) {
        console.warn(`⚠  ${locale}/${ns}: ${extra.length} extra keys (not in base)`);
        extra.slice(0, 10).forEach((k) => console.warn(`     ${k}`));
      }
    }
  }

  if (fail > 0) {
    console.error(`\n❌ ${fail} locale/namespace failures. Blocking deploy.`);
    process.exit(1);
  }
  console.log('✓ all active locales complete across all namespaces');
}

main();
