export type DrizzleDb = { insert: (...args: unknown[]) => unknown } & Record<string, unknown>;

/** Upsert helper — Drizzle doesn't love generic conflict targets, so we use raw execute. */
export function i18n(map: Record<string, string>) {
  return map;
}
