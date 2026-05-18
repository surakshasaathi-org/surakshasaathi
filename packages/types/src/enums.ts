import { z } from 'zod';

/**
 * Locales supported at some phase of the product.
 * Phase 1 MVP launch = en, hi, kn.
 * New locales add here + in `packages/i18n/locales/`; no other code change needed.
 */
export const Locale = z.enum([
  'en', // English
  'hi', // Hindi
  'kn', // Kannada
  'ta', // Tamil        (Phase 1 fast-follow)
  'te', // Telugu       (Phase 1 fast-follow)
  'bn', // Bengali      (Phase 1 fast-follow)
  'mr', // Marathi      (Phase 2)
  'gu', // Gujarati     (Phase 2)
  'ml', // Malayalam    (Phase 2)
  'pa', // Punjabi      (Phase 3)
  'or', // Odia         (Phase 3)
  'as', // Assamese     (Phase 3)
  'ur', // Urdu         (Phase 3, RTL)
]);
export type Locale = z.infer<typeof Locale>;

export const LAUNCH_LOCALES: Locale[] = ['en', 'hi', 'kn'];

/**
 * Product-module cluster. Helps the landing-page group cards.
 */
export const Cluster = z.enum(['claims', 'advisory', 'new_segment']);
export type Cluster = z.infer<typeof Cluster>;

/**
 * Monetization tier for any feature or module. See ADR-0002 and CLAUDE.md.
 * NOT a hardcoded assumption about any one module — each feature declares its own.
 */
export const PricingModel = z.enum([
  'free',         // anonymous or registered, no payment
  'freemium',     // one-time flat fee (e.g. ₹499 audit)
  'subscription', // recurring via Razorpay Subscriptions
  'success_fee',  // % of amount recovered, collected post-outcome
  'affiliate',    // lead-gen referral — no money flows through us
  'b2b',          // per-seat or per-employee SaaS contract
]);
export type PricingModel = z.infer<typeof PricingModel>;

/**
 * Minimum auth level required to use a feature.
 * Enforced in packages/access-control.
 */
export const AuthLevel = z.enum([
  'anonymous',    // no account required
  'registered',   // phone OTP or email
  'paid',         // registered + has a paid entitlement for this feature
  'aadhaar_ekyc', // high-value financial action
  'b2b_admin',    // org admin role in a B2B tenant
]);
export type AuthLevel = z.infer<typeof AuthLevel>;

/**
 * Module lifecycle status. Surfaces on the landing page as "live", "beta", or "coming soon".
 */
export const ModuleStatus = z.enum(['concept', 'skeleton', 'beta', 'live', 'deprecated']);
export type ModuleStatus = z.infer<typeof ModuleStatus>;

/**
 * Roles inside a tenant. Attached via `membership` rows.
 * Admin-portal RBAC reads from here.
 */
export const Role = z.enum([
  'super_admin',     // suraksha staff, all tenants (rare)
  'admin',           // tenant-scoped admin
  'case_manager',    // operates on cases in the admin portal
  'content_editor',  // edits schemes, glossary, agent prompts
  'cx_agent',        // support portal access
  'viewer',          // read-only admin or support access
  'reviewer',        // external reviewer (legal / language) — read + comment
  'member',          // end-user
  'partner_admin',   // B2B org admin (NGO/HR/broker white-label)
]);
export type Role = z.infer<typeof Role>;

/**
 * Case lifecycle for claims / mis-selling / unclaimed recovery.
 * Generic across Ideas 1, 3, 7, 8.
 */
export const CaseStatus = z.enum([
  'draft',                  // user started intake, not submitted
  'intake',                 // submitted, awaiting triage
  'triaged',                // agent + case manager have classified
  'docs_needed',            // user action required
  'drafting',               // letters being drafted
  'awaiting_review',        // human review before regulator submission
  'filed',                  // submitted to insurer / Ombudsman
  'awaiting_insurer',       // waiting on insurer SLA (IRDAI 14-day / 15-day)
  'escalated_ombudsman',    // moved to Ombudsman
  'escalated_consumer_court',
  'resolved_in_favour',
  'resolved_against',
  'withdrawn',
  'abandoned',
]);
export type CaseStatus = z.infer<typeof CaseStatus>;

/**
 * Document categories we OCR / extract.
 */
export const DocumentKind = z.enum([
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
export type DocumentKind = z.infer<typeof DocumentKind>;

/**
 * Insurance product lines. BACKED BY DB — see `packages/db/src/schema/insurance.ts`.
 * This enum exists for Phase 1 ergonomic typing; new lines added by DB insert
 * are still permitted at runtime (the db schema uses a reference table, not an enum).
 *
 * Do NOT treat this list as exhaustive in business logic — always read from DB.
 */
export const InsuranceLine = z.enum([
  'health',
  'life',
  'motor',
  'property',
  'travel',
  'cyber',
  'crop',
  'pet',
  'commercial_general',
  'group_health',
  'marine',
  'key_man',
  'professional_indemnity',
]);
export type InsuranceLine = z.infer<typeof InsuranceLine>;

/**
 * Claude model tier — see ADR-0005.
 */
export const ModelTier = z.enum(['opus', 'sonnet', 'haiku']);
export type ModelTier = z.infer<typeof ModelTier>;

/**
 * Agent execution outcome — stored on every agent_run row.
 */
export const AgentRunOutcome = z.enum(['success', 'low_confidence', 'tool_error', 'timeout', 'refused']);
export type AgentRunOutcome = z.infer<typeof AgentRunOutcome>;
