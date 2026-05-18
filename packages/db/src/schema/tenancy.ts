import { relations } from 'drizzle-orm';
import { pgTable, text, uuid, date, jsonb, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import { createdAt, updatedAt, tenantKindEnum, roleEnum, localeEnum } from './_shared';

/**
 * A tenant = an isolated scope for data, users, and modules.
 * Day 1: a single `surakshasaathi` B2C tenant. Phase 2+ adds NGO/HR/CSC/state_gov/partner.
 * See ADR-0004.
 */
export const tenant = pgTable('tenant', {
  id: text('id').primaryKey(),                   // slug, e.g. "surakshasaathi"
  slug: text('slug').notNull().unique(),
  displayName: text('display_name').notNull(),
  kind: tenantKindEnum('kind').notNull().default('b2c'),
  defaultLocale: localeEnum('default_locale').notNull().default('en'),
  enabledModules: text('enabled_modules').array().notNull().default([]),
  metadata: text('metadata'),                    // JSON text; we don't need structured queries here
  createdAt,
  updatedAt,
});

/**
 * User = Supabase auth.users row. We mirror a minimal projection so we can relate
 * users into our tables by uuid without reaching into the `auth` schema directly.
 */
export const appUser = pgTable(
  'app_user',
  {
    id: uuid('id').primaryKey(),                  // matches auth.users.id
    phone: text('phone'),
    email: text('email'),
    displayName: text('display_name'),
    preferredLocale: localeEnum('preferred_locale'),

    /** Proper profile fields — collected on /onboarding after first sign-in. */
    fullName: text('full_name'),
    phoneE164: text('phone_e164'),
    gender: text('gender'),
    dateOfBirth: date('date_of_birth'),
    /** NULL until the user completes onboarding. Used by middleware to gate
     *  protected routes and auto-redirect incomplete users. */
    profileCompletedAt: timestamp('profile_completed_at', { withTimezone: true }),

    /** Minimal personalisation signals used by the readiness-score module.
     *  City tier is the only current input; expands over time. Defaults to
     *  empty object so the scorer can always dereference without null-check. */
    scoringProfileJson: jsonb('scoring_profile_json')
      .$type<{ cityTier?: 'metro' | 'tier_2' | 'tier_3' }>()
      .notNull()
      .default({}),

    createdAt,
  },
  (t) => ({
    phoneIdx: uniqueIndex('app_user_phone_idx').on(t.phone),
    emailIdx: uniqueIndex('app_user_email_idx').on(t.email),
    phoneE164Idx: uniqueIndex('app_user_phone_e164_idx').on(t.phoneE164),
    incompleteIdx: index('app_user_incomplete_profile_idx').on(t.profileCompletedAt),
  }),
);

/**
 * Membership = user is in tenant with a role.
 * A user can have memberships in multiple tenants. The active tenant comes from
 * the JWT `tenant_id` claim — a context-switch = re-issue JWT with new claim.
 */
export const membership = pgTable(
  'membership',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: text('tenant_id').notNull().references(() => tenant.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').notNull().references(() => appUser.id, { onDelete: 'cascade' }),
    role: roleEnum('role').notNull().default('member'),
    createdAt,
  },
  (t) => ({
    uniq: uniqueIndex('membership_tenant_user_idx').on(t.tenantId, t.userId),
    byTenant: index('membership_tenant_idx').on(t.tenantId),
    byUser: index('membership_user_idx').on(t.userId),
  }),
);

export const tenantRelations = relations(tenant, ({ many }) => ({
  memberships: many(membership),
}));

export const userRelations = relations(appUser, ({ many }) => ({
  memberships: many(membership),
}));

export const membershipRelations = relations(membership, ({ one }) => ({
  tenant: one(tenant, { fields: [membership.tenantId], references: [tenant.id] }),
  user: one(appUser, { fields: [membership.userId], references: [appUser.id] }),
}));
