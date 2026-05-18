import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../schema';

type Db = NodePgDatabase<typeof schema>;

/**
 * Day-1 tenant: the public B2C `surakshasaathi` tenant. Every user signing up
 * via the consumer apps lands here by default. B2B partner tenants are added later.
 */
export async function seedTenants(db: Db, s: typeof schema) {
  await db.insert(s.tenant).values([
    {
      id: 'surakshasaathi',
      slug: 'surakshasaathi',
      displayName: 'SurakshaSaathi',
      kind: 'b2c',
      defaultLocale: 'en',
      enabledModules: [
        'claims-advocacy',
        'policy-health-score',
        'govt-scheme-navigator',
        'family-insurance-os',
        'vernacular-portal',
        'msme-navigator',
        'senior-citizen-portal',
        'life-mis-selling-recovery',
      ],
    },
  ]).onConflictDoNothing();
  console.log('[seed] tenants: 1');
}
