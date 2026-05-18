import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@suraksha/db/schema';
import { and, eq, or, isNull, gt } from 'drizzle-orm';
import type { TenantId, UserId } from '@suraksha/types';

type Db = NodePgDatabase<typeof schema>;

/**
 * Load a user's active entitlements. An entitlement scope is a free-form string like:
 *   - "module:claims-advocacy"           — user can access the Claims-Advocacy module
 *   - "feature:ombudsman-draft"          — user can use the ombudsman-draft feature
 *   - "plan:family-os-premium"           — user is on the Family-OS premium plan
 *   - "aadhaar_ekyc:verified"            — user has completed Aadhaar e-KYC
 */
export async function loadEntitlementScopes(
  db: Db,
  s: typeof schema,
  args: { tenantId: TenantId; userId: UserId },
): Promise<Set<string>> {
  const now = new Date();
  const rows = await db
    .select({ scope: s.entitlement.scope })
    .from(s.entitlement)
    .where(
      and(
        eq(s.entitlement.tenantId, args.tenantId as unknown as string),
        eq(s.entitlement.userId, args.userId as unknown as string),
        eq(s.entitlement.active, true),
        or(isNull(s.entitlement.expiresAt), gt(s.entitlement.expiresAt, now)),
      ),
    );
  return new Set(rows.map((r) => r.scope));
}
