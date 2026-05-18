import { pgTable, text, uuid, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { createdAt, updatedAt, tenantIdCol } from './_shared';
import { appUser } from './tenancy';
import { scheme } from './catalog';

/**
 * Per-user scheme match + enrollment state. One row per (user_id, scheme_id).
 * match_status mirrors the scheme-matcher agent output. enrollment_status is
 * user-editable and tracks the real-world progress of actually getting on to
 * the scheme (walking to a CSC, uploading documents, renewal annually).
 */
export const userScheme = pgTable(
  'user_scheme',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    userId: uuid('user_id')
      .notNull()
      .references(() => appUser.id, { onDelete: 'cascade' }),
    schemeId: text('scheme_id')
      .notNull()
      .references(() => scheme.id, { onDelete: 'cascade' }),
    /** 'eligible' | 'possibly_eligible' | 'not_eligible' */
    matchStatus: text('match_status').notNull(),
    matchReason: text('match_reason'),
    /** 'not_started' | 'in_progress' | 'enrolled' | 'renewed' | 'lapsed' */
    enrollmentStatus: text('enrollment_status').notNull().default('not_started'),
    enrollmentNotes: text('enrollment_notes'),
    lastMatchedAt: timestamp('last_matched_at', { withTimezone: true }).notNull().defaultNow(),
    lastReviewedAt: timestamp('last_reviewed_at', { withTimezone: true }),
    createdAt,
    updatedAt,
  },
  (t) => ({
    uniqPair: uniqueIndex('user_scheme_user_scheme_idx').on(t.userId, t.schemeId),
    byStatus: index('user_scheme_status_idx').on(t.userId, t.enrollmentStatus),
  }),
);
