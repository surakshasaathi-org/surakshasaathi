import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../schema';

type Db = NodePgDatabase<typeof schema>;

export async function seedFeatureFlags(db: Db, s: typeof schema) {
  const rows = [
    {
      key: 'module.claims-advocacy.intake_open',
      description: 'Claims-Advocacy intake flow is open to new submissions.',
      enabledForAll: true,
      enabledTenants: [],
      enabledRoles: [],
      enabledUserIds: [],
    },
    {
      key: 'module.govt-scheme-navigator.eligibility_free',
      description: 'Govt scheme eligibility check is free and anonymous. Always on — do not disable.',
      enabledForAll: true,
      enabledTenants: [],
      enabledRoles: [],
      enabledUserIds: [],
    },
    {
      key: 'module.life-mis-selling-recovery.intake_open',
      description: 'Life mis-selling intake is open.',
      enabledForAll: false,
      enabledTenants: ['surakshasaathi'],
      enabledRoles: ['super_admin', 'admin'],
      enabledUserIds: [],
    },
    {
      key: 'module.senior-citizen-portal.subscription_sales_open',
      description: 'Senior Citizen Portal paid subscriptions open.',
      enabledForAll: false,
      enabledTenants: [],
      enabledRoles: ['super_admin', 'admin'],
      enabledUserIds: [],
    },
    {
      key: 'payment.escrow.release_manual',
      description: 'Success-fee escrow releases require manual admin trigger (safer than auto).',
      enabledForAll: true,
      enabledTenants: [],
      enabledRoles: [],
      enabledUserIds: [],
    },
    {
      key: 'agent.auto_escalation.ombudsman',
      description: 'Auto-submit Ombudsman filings. KEEP OFF until ReviewAgent + human-reviewer pipeline proven.',
      enabledForAll: false,
      enabledTenants: [],
      enabledRoles: [],
      enabledUserIds: [],
    },
    {
      key: 'whatsapp.inbound',
      description: 'Accept inbound WhatsApp messages via WATI.',
      enabledForAll: true,
      enabledTenants: [],
      enabledRoles: [],
      enabledUserIds: [],
    },
    {
      key: 'landing.showcase_all_modules',
      description: 'Show every product module on the landing page, even skeleton ones (Day-1 breadth-first). Disable to show only `live` or `beta`.',
      enabledForAll: true,
      enabledTenants: [],
      enabledRoles: [],
      enabledUserIds: [],
    },
  ];
  await db.insert(s.featureFlag).values(rows).onConflictDoNothing();
  console.log(`[seed] feature flags: ${rows.length}`);
}
