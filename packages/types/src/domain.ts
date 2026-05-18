import { z } from 'zod';
import {
  AuthLevel,
  Cluster,
  DocumentKind,
  InsuranceLine,
  Locale,
  ModuleStatus,
  PricingModel,
  Role,
  CaseStatus,
} from './enums';
import {
  CaseId,
  DocumentId,
  FeatureFlagKey,
  MembershipId,
  PolicyId,
  ProductModuleId,
  SchemeId,
  TenantId,
  UserId,
} from './ids';

/**
 * A map of `Locale -> string`. Used for any user-visible text that must be
 * translated. Not every locale must be present — missing locales fall back
 * via `@suraksha/i18n` resolution rules (preferred → English → source).
 */
export const I18nText = z.record(Locale, z.string());
export type I18nText = z.infer<typeof I18nText>;

export const Tenant = z.object({
  id: TenantId,
  slug: z.string(),
  displayName: z.string(),
  kind: z.enum(['b2c', 'ngo', 'hr', 'csc', 'broker', 'state_gov', 'partner']),
  enabledModules: z.array(ProductModuleId),
  defaultLocale: Locale,
  createdAt: z.string().datetime(),
});
export type Tenant = z.infer<typeof Tenant>;

export const User = z.object({
  id: UserId,
  phone: z.string().nullable(),       // +91 format; nullable if email-only
  email: z.string().email().nullable(),
  displayName: z.string().nullable(),
  preferredLocale: Locale.nullable(),
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof User>;

export const Membership = z.object({
  id: MembershipId,
  tenantId: TenantId,
  userId: UserId,
  role: Role,
  createdAt: z.string().datetime(),
});
export type Membership = z.infer<typeof Membership>;

/**
 * A product module = one "idea" on the landing page.
 * 8 ship Day 1 (claims, mis-selling, senior, claims, scheme-nav, health-score, family-os, msme, vernacular).
 * New modules added by inserting a row. See ADR-0003.
 */
export const ProductModule = z.object({
  id: ProductModuleId,
  cluster: Cluster,
  nameI18n: I18nText,
  taglineI18n: I18nText,
  heroHeadlineI18n: I18nText,
  heroSubheadI18n: I18nText,
  landingRoute: z.string().regex(/^\/[a-z0-9-/]+$/),
  pricingModel: PricingModel,
  authRequired: AuthLevel,
  launchLocales: z.array(Locale),
  status: ModuleStatus,
  intakeFlowId: z.string().nullable(), // FK to intake_flow.id (or null if "coming soon")
  agentDefinitionIds: z.array(z.string()),
  orderIndex: z.number().int(),
  iconSlug: z.string().nullable(),
});
export type ProductModule = z.infer<typeof ProductModule>;

/**
 * Insurance policy held by a user.
 * `lineId` FKs into an `insurance_line` reference table, NOT a hardcoded enum —
 * new lines (crop, pet, cyber) are DB inserts.
 */
export const Policy = z.object({
  id: PolicyId,
  tenantId: TenantId,
  userId: UserId,
  lineId: z.string(), // slug of insurance_line.id; see InsuranceLine enum for Phase-1 values
  insurerName: z.string(),
  policyNumber: z.string(),
  sumAssured: z.number().nullable(),
  premium: z.number().nullable(),
  startDate: z.string().date().nullable(),
  endDate: z.string().date().nullable(),
  nomineeName: z.string().nullable(),
  metadata: z.record(z.unknown()), // insurer-specific fields, waiting periods, exclusions
  createdAt: z.string().datetime(),
});
export type Policy = z.infer<typeof Policy>;

/**
 * Generic case — backs Ideas 1, 3 (unclaimed), 7 (mis-selling), 8.
 * Sub-kinds differ in which agents fire and what documents matter.
 */
export const Case = z.object({
  id: CaseId,
  tenantId: TenantId,
  userId: UserId,
  moduleId: ProductModuleId,
  kind: z.enum(['claim_rejection', 'mis_selling', 'unclaimed_recovery', 'scheme_refusal', 'advisory']),
  status: CaseStatus,
  priority: z.enum(['low', 'normal', 'high', 'urgent']),
  amountClaimedInPaise: z.number().int().nullable(),
  amountRecoveredInPaise: z.number().int().nullable(),
  insurerName: z.string().nullable(),
  policyId: PolicyId.nullable(),
  assignedTo: UserId.nullable(),
  deadlineAt: z.string().datetime().nullable(),
  metadata: z.record(z.unknown()),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type Case = z.infer<typeof Case>;

export const Document = z.object({
  id: DocumentId,
  tenantId: TenantId,
  uploaderUserId: UserId,
  kind: DocumentKind,
  storagePath: z.string(), // Supabase Storage object key
  contentSha256: z.string(),
  mime: z.string(),
  sizeBytes: z.number().int(),
  ocrStatus: z.enum(['pending', 'running', 'done', 'failed']),
  ocrText: z.string().nullable(),
  extracted: z.record(z.unknown()).nullable(),
  caseId: CaseId.nullable(),
  policyId: PolicyId.nullable(),
  createdAt: z.string().datetime(),
});
export type Document = z.infer<typeof Document>;

/**
 * Govt scheme (central or state). Powers Idea 3 and Idea 7.
 * Versioned rows — when a scheme changes, we insert a new version and deprecate the old.
 */
export const Scheme = z.object({
  id: SchemeId,
  slug: z.string(), // e.g. "pm-jay"
  level: z.enum(['central', 'state']),
  stateCode: z.string().nullable(), // null for central
  nameI18n: I18nText,
  summaryI18n: I18nText,
  eligibilityRules: z.record(z.unknown()), // JSON ruleset consumed by SchemeMatcher
  coveragePaise: z.number().int().nullable(),
  lineIds: z.array(z.string()), // insurance lines covered
  applicationChannels: z.array(z.string()), // "csc", "bank", "mera.pmjay.gov.in"
  version: z.number().int(),
  effectiveFrom: z.string().date(),
  deprecatedFrom: z.string().date().nullable(),
});
export type Scheme = z.infer<typeof Scheme>;

/**
 * Feature flag — controls any paid/freemium gate and per-tenant rollout.
 * Evaluated server-side only. See packages/access-control.
 */
export const FeatureFlag = z.object({
  key: FeatureFlagKey,
  description: z.string(),
  enabledForAll: z.boolean(),
  enabledTenants: z.array(TenantId),
  enabledRoles: z.array(Role),
  enabledUserIds: z.array(UserId),
  variants: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  updatedAt: z.string().datetime(),
});
export type FeatureFlag = z.infer<typeof FeatureFlag>;

/**
 * Consent record — DPDP Act requires granular, auditable consent.
 */
export const Consent = z.object({
  userId: UserId,
  purpose: z.string(), // e.g. "document_ocr", "agent_analysis", "affiliate_referral"
  granted: z.boolean(),
  grantedAt: z.string().datetime(),
  expiresAt: z.string().datetime().nullable(),
  sourceIp: z.string().nullable(),
  userAgent: z.string().nullable(),
  policyVersion: z.string(), // version of privacy policy at time of consent
});
export type Consent = z.infer<typeof Consent>;

/**
 * An insurance-term glossary entry — human-reviewed translations. Google Translate
 * is never used for insurance terminology (see CLAUDE.md, section 8).
 */
export const GlossaryEntry = z.object({
  term: z.string(),                       // canonical English term, e.g. "Waiting Period"
  translations: I18nText,                 // locale → translation
  definitionI18n: I18nText,               // optional plain-language definition per locale
  reviewedBy: z.record(Locale, z.string().nullable()),
  reviewedAt: z.record(Locale, z.string().datetime().nullable()),
  category: z.enum(['health', 'life', 'auto', 'scheme', 'general', 'claim', 'regulatory']),
});
export type GlossaryEntry = z.infer<typeof GlossaryEntry>;
