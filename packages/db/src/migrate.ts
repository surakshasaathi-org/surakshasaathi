/**
 * Run Drizzle migrations against DIRECT_DATABASE_URL.
 * Invoked via `pnpm --filter @suraksha/db migrate`.
 *
 * Order of execution:
 *   1. Drizzle-generated SQL from `migrations/` (schema)
 *   2. Hand-written SQL migrations matching `0001_*.sql` etc. (RLS, triggers)
 *
 * The drizzle-kit migrate runner handles ordering by filename, so our hand-written
 * 0001_rls_policies.sql runs after drizzle's 0000_initial.sql.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function main() {
  const url = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DIRECT_DATABASE_URL or DATABASE_URL must be set');
  }

  const sql = postgres(url, { max: 1, prepare: false });
  const db = drizzle(sql);

  console.log('[migrate] running migrations');
  await migrate(db, { migrationsFolder: './migrations' });
  console.log('[migrate] done');

  await sql.end();
}

main().catch((err) => {
  console.error('[migrate] failed', err);
  process.exit(1);
});
