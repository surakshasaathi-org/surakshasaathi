import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@suraksha/db/schema';
import { eq } from 'drizzle-orm';
import type { Role, TenantId, UserId } from '@suraksha/types';

type Db = NodePgDatabase<typeof schema>;

/**
 * Evaluate feature flags for a caller. Called during Caller construction — result is
 * cached in `caller.enabledFlags` for the duration of the request.
 *
 * Evaluation order (first match wins):
 *   1. enabledForAll → on
 *   2. enabledTenants contains tenantId → on
 *   3. enabledRoles contains role → on
 *   4. enabledUserIds contains userId → on
 *   5. otherwise → off
 */
export async function evaluateFlags(
  db: Db,
  s: typeof schema,
  args: {
    tenantId: TenantId;
    userId: UserId | null;
    role: Role | null;
  },
): Promise<Set<string>> {
  const rows = await db.select().from(s.featureFlag);
  const enabled = new Set<string>();
  for (const f of rows) {
    if (f.enabledForAll) {
      enabled.add(f.key);
      continue;
    }
    if (f.enabledTenants.includes(args.tenantId as unknown as string)) {
      enabled.add(f.key);
      continue;
    }
    if (args.role && f.enabledRoles.includes(args.role)) {
      enabled.add(f.key);
      continue;
    }
    if (args.userId && f.enabledUserIds.includes(args.userId as unknown as string)) {
      enabled.add(f.key);
      continue;
    }
  }
  return enabled;
}

/** Narrow helper for a single flag (useful in tests). */
export function isFlagOn(flags: ReadonlySet<string>, key: string): boolean {
  return flags.has(key);
}

// Re-export eq for convenience in consuming code (keeps drizzle-orm a single dep edge).
export { eq };
