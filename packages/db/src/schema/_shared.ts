import { sql } from 'drizzle-orm';
import { pgEnum, text, timestamp } from 'drizzle-orm/pg-core';

export const createdAt = timestamp('created_at', { withTimezone: true })
  .notNull()
  .default(sql`now()`);

export const updatedAt = timestamp('updated_at', { withTimezone: true })
  .notNull()
  .default(sql`now()`);

/** Stable slug column used for reference tables (insurance_line, product_module, etc). */
export const slugCol = () => text('id').primaryKey();

/** Tenant scope column — every business row carries this. RLS uses it for isolation. */
export const tenantIdCol = () => text('tenant_id').notNull();

/** ===== Enums that are genuinely closed sets ===== */

export const tenantKindEnum = pgEnum('tenant_kind', [
  'b2c',
  'ngo',
  'hr',
  'csc',
  'broker',
  'state_gov',
  'partner',
]);

export const roleEnum = pgEnum('role', [
  'super_admin',
  'admin',
  'case_manager',
  'content_editor',
  'cx_agent',
  'viewer',
  'reviewer',
  'member',
  'partner_admin',
]);

export const localeEnum = pgEnum('locale', [
  'en', 'hi', 'kn', 'ta', 'te', 'bn', 'mr', 'gu', 'ml', 'pa', 'or', 'as', 'ur',
]);

export const clusterEnum = pgEnum('cluster', ['claims', 'advisory', 'new_segment']);

export const pricingModelEnum = pgEnum('pricing_model', [
  'free',
  'freemium',
  'subscription',
  'success_fee',
  'affiliate',
  'b2b',
]);

export const authLevelEnum = pgEnum('auth_level', [
  'anonymous',
  'registered',
  'paid',
  'aadhaar_ekyc',
  'b2b_admin',
]);

export const moduleStatusEnum = pgEnum('module_status', [
  'concept',
  'skeleton',
  'beta',
  'live',
  'deprecated',
]);

export const caseStatusEnum = pgEnum('case_status', [
  'draft',
  'intake',
  'triaged',
  'docs_needed',
  'drafting',
  'awaiting_review',
  'filed',
  'awaiting_insurer',
  'escalated_ombudsman',
  'escalated_consumer_court',
  'resolved_in_favour',
  'resolved_against',
  'withdrawn',
  'abandoned',
]);

export const caseKindEnum = pgEnum('case_kind', [
  'claim_rejection',
  'mis_selling',
  'unclaimed_recovery',
  'scheme_refusal',
  'advisory',
]);

export const priorityEnum = pgEnum('priority', ['low', 'normal', 'high', 'urgent']);

export const documentKindEnum = pgEnum('document_kind', [
  'policy_document',
  'rejection_letter',
  'hospital_bill',
  'discharge_summary',
  'bank_statement',
  'proposal_form',
  'kyc_document',
  'ombudsman_filing',
  'grievance_letter',
  'scheme_card',
  'death_certificate',
  'nominee_document',
  'other',
]);

export const ocrStatusEnum = pgEnum('ocr_status', ['pending', 'running', 'done', 'failed']);

export const modelTierEnum = pgEnum('model_tier', ['opus', 'sonnet', 'haiku']);

export const agentOutcomeEnum = pgEnum('agent_run_outcome', [
  'success',
  'low_confidence',
  'tool_error',
  'timeout',
  'refused',
]);

export const paymentStatusEnum = pgEnum('payment_status', [
  'created',
  'authorized',
  'captured',
  'refunded',
  'failed',
  'cancelled',
  'held_in_escrow',
  'released_from_escrow',
]);

export const subscriptionStatusEnum = pgEnum('subscription_status', [
  'created',
  'authenticated',
  'active',
  'paused',
  'halted',
  'cancelled',
  'completed',
  'expired',
]);

export const schemeLevelEnum = pgEnum('scheme_level', ['central', 'state']);
