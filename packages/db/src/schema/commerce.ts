import { pgTable, text, uuid, integer, jsonb, boolean, timestamp, index, uniqueIndex } from 'drizzle-orm/pg-core';
import {
  authLevelEnum,
  createdAt,
  paymentStatusEnum,
  pricingModelEnum,
  roleEnum,
  subscriptionStatusEnum,
  tenantIdCol,
  updatedAt,
} from './_shared';

/**
 * Feature flags. Eval order: enabledForAll → enabledTenants → enabledRoles → enabledUserIds.
 * A missing key means feature is disabled. All evaluation happens server-side.
 */
export const featureFlag = pgTable(
  'feature_flag',
  {
    key: text('key').primaryKey(),
    description: text('description').notNull(),
    enabledForAll: boolean('enabled_for_all').notNull().default(false),
    enabledTenants: text('enabled_tenants').array().notNull().default([]),
    enabledRoles: roleEnum('enabled_roles').array().notNull().default([]),
    enabledUserIds: uuid('enabled_user_ids').array().notNull().default([]),
    variants: jsonb('variants').$type<Record<string, unknown>>(),
    updatedAt,
  },
);

/**
 * Entitlement = a user-scoped grant of access to a tier, feature, or module.
 * Examples:
 *   - a "family_plan_annual_2026" subscription entitles user to the Family OS premium tier
 *   - a paid audit entitles user to one-time "policy_audit" freemium flow
 *
 * access-control evaluates entitlements server-side on every gated request.
 */
export const entitlement = pgTable(
  'entitlement',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    userId: uuid('user_id').notNull(),
    scope: text('scope').notNull(),                // "module:claims-advocacy", "feature:ombudsman-draft"
    tier: pricingModelEnum('tier').notNull(),
    auth: authLevelEnum('auth').notNull(),
    active: boolean('active').notNull().default(true),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    sourcePaymentId: uuid('source_payment_id'),
    sourceSubscriptionId: uuid('source_subscription_id'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt,
  },
  (t) => ({
    byUser: index('entitlement_user_idx').on(t.userId, t.active, t.scope),
    byTenant: index('entitlement_tenant_idx').on(t.tenantId),
  }),
);

/**
 * Subscription = Razorpay Subscription. We store the id, plan, and lifecycle.
 * Actual source of truth is Razorpay; we reconcile via webhook.
 */
export const subscription = pgTable(
  'subscription',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    userId: uuid('user_id').notNull(),
    planSlug: text('plan_slug').notNull(),        // e.g. "family-os-annual", "senior-plan"
    razorpaySubscriptionId: text('razorpay_subscription_id').notNull().unique(),
    razorpayPlanId: text('razorpay_plan_id').notNull(),
    status: subscriptionStatusEnum('status').notNull().default('created'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => ({
    byUser: index('subscription_user_idx').on(t.userId),
  }),
);

/**
 * One-time and success-fee payments, plus escrow holds.
 * Reconciled from Razorpay webhooks. `status` tracks the full lifecycle including escrow.
 */
export const payment = pgTable(
  'payment',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    userId: uuid('user_id').notNull(),
    razorpayOrderId: text('razorpay_order_id'),
    razorpayPaymentId: text('razorpay_payment_id'),
    amountPaise: integer('amount_paise').notNull(),
    currency: text('currency').notNull().default('INR'),
    status: paymentStatusEnum('status').notNull().default('created'),
    scope: text('scope').notNull(),                // "freemium:policy-audit", "success-fee:case/<uuid>"
    caseId: uuid('case_id'),
    subscriptionId: uuid('subscription_id'),
    paidAt: timestamp('paid_at', { withTimezone: true }),
    refundedAt: timestamp('refunded_at', { withTimezone: true }),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt,
    updatedAt,
  },
  (t) => ({
    byUser: index('payment_user_idx').on(t.userId),
    byCase: index('payment_case_idx').on(t.caseId),
    byOrder: uniqueIndex('payment_razorpay_order_idx').on(t.razorpayOrderId),
  }),
);

/**
 * Affiliate partners and their live offers. Click-tracking lives in `affiliate_click`.
 */
export const affiliatePartner = pgTable('affiliate_partner', {
  slug: text('slug').primaryKey(),
  displayName: text('display_name').notNull(),
  destinationUrlTemplate: text('destination_url_template').notNull(),
  commissionModel: text('commission_model').notNull(),     // "cpc", "cpa", "rev_share"
  enabled: boolean('enabled').notNull().default(true),
  lineIds: text('line_ids').array().notNull().default([]),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  createdAt,
});

export const affiliateClick = pgTable(
  'affiliate_click',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: tenantIdCol(),
    userId: uuid('user_id'),                       // nullable — anonymous affiliate clicks allowed
    partnerSlug: text('partner_slug').notNull().references(() => affiliatePartner.slug),
    sourceModuleId: text('source_module_id'),
    sourceUrl: text('source_url'),
    destinationUrl: text('destination_url').notNull(),
    clickedAt: timestamp('clicked_at', { withTimezone: true }).notNull().defaultNow(),
    convertedAt: timestamp('converted_at', { withTimezone: true }),
    conversionValuePaise: integer('conversion_value_paise'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  },
  (t) => ({
    byPartner: index('affiliate_click_partner_idx').on(t.partnerSlug, t.clickedAt),
  }),
);
