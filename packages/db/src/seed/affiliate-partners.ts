import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../schema';

type Db = NodePgDatabase<typeof schema>;

/**
 * Empty seed by default — affiliate partnerships are signed one by one.
 * Seeding a couple of placeholders so the admin portal has example rows on Day 1.
 */
export async function seedAffiliatePartners(db: Db, s: typeof schema) {
  const rows = [
    {
      slug: 'placeholder-insurer',
      displayName: 'Placeholder Insurer',
      destinationUrlTemplate: 'https://example.com/?ref=surakshasaathi&module={module}',
      commissionModel: 'rev_share',
      enabled: false,
      lineIds: ['health', 'life'],
      metadata: { contract_signed: false, notes: 'Admin: replace before production' },
    },
  ];
  await db.insert(s.affiliatePartner).values(rows).onConflictDoNothing();
  console.log('[seed] affiliate partners (placeholders): 1');
}
