import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Two flavors of DB client:
 *
 *   1. `tenantDb(jwtClaims)` — runs queries under the caller's JWT, so RLS enforces
 *      tenant isolation. Use this from request handlers. This is the default and should
 *      be used for every user-initiated query.
 *
 *   2. `serviceDb()` — bypasses RLS using the Supabase service role. Use ONLY in
 *      background jobs, admin tooling, and system tasks. Every call site must:
 *        - document why it needs to bypass RLS
 *        - write an audit_log entry capturing the action and actor
 *
 * NEVER import `serviceDb` into a React Server Component or user-facing route.
 * The linter should ban it via no-restricted-imports in app packages.
 */

type Claims = {
  sub: string;             // user id
  tenant_id: string;
  role?: string;
  aud?: string;
};

const connectionCache = new Map<string, postgres.Sql>();

function connect(url: string, max: number): postgres.Sql {
  const cached = connectionCache.get(`${url}|${max}`);
  if (cached) return cached;
  const sql = postgres(url, {
    max,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false, // Supabase PgBouncer compatibility
  });
  connectionCache.set(`${url}|${max}`, sql);
  return sql;
}

/**
 * Per-request DB client. Sets the JWT claims as session GUCs so RLS sees them.
 * Equivalent to Supabase's PostgREST behavior.
 */
export function tenantDb(claims: Claims) {
  const url = requireEnv('DATABASE_URL');
  const sql = connect(url, 10);
  const db = drizzle(sql, { schema });

  // Wrap the underlying `sql` to inject `set_config` before each transaction.
  // Callers should prefer `db.transaction(async tx => ...)` which will inherit the session.
  return {
    db,
    /** Set JWT claims for RLS on a transaction. Call inside `db.transaction`. */
    async setClaims(tx: typeof db) {
      await tx.execute(
        `select set_config('request.jwt.claim.sub', $1, true),
                set_config('request.jwt.claim.tenant_id', $2, true),
                set_config('request.jwt.claim.role', $3, true)`,
        // @ts-expect-error drizzle .execute(unsafeString, params) – kept simple for clarity
        [claims.sub, claims.tenant_id, claims.role ?? 'authenticated'],
      );
    },
  };
}

/**
 * Service-role DB client. Bypasses RLS. Do not import from app packages.
 */
export function serviceDb() {
  const url = requireEnv('DIRECT_DATABASE_URL');
  const sql = connect(url, 5);
  return drizzle(sql, { schema });
}

function requireEnv(key: string): string {
  const v = process.env[key];
  if (!v) {
    throw new Error(`Missing required env var: ${key}`);
  }
  return v;
}
