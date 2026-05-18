import { pgTable, text, uuid, timestamp, index, customType } from 'drizzle-orm/pg-core';
import { createdAt, tenantIdCol } from './_shared';
import { appUser } from './tenancy';
import { policyAnalysis } from './analyses';

// Drizzle doesn't ship an `inet` helper; model it as text in JS and let
// Postgres cast on insert. The SQL side keeps the real inet type + index.
const inetCol = customType<{ data: string }>({
  dataType: () => 'inet',
});

/**
 * One row per upload attempt (anonymous or authed). Read by safety/rate-limit
 * to cap per-IP anonymous sprays; ops read via the admin portal's abuse view.
 */
export const uploadEvent = pgTable(
  'upload_event',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    userId: uuid('user_id').references(() => appUser.id, { onDelete: 'set null' }),
    analysisId: uuid('analysis_id').references(() => policyAnalysis.id, { onDelete: 'cascade' }),
    ip: inetCol('ip'),
    userAgent: text('user_agent'),
    createdAt,
  },
  (t) => ({
    byIp: index('upload_event_ip_idx').on(t.ip, t.createdAt),
    byUser: index('upload_event_user_idx').on(t.userId, t.createdAt),
  }),
);
