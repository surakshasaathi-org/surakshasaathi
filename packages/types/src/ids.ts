import { z } from 'zod';

// Branded ID types. At runtime they're strings — at compile time they're
// distinct enough that you can't pass a PolicyId where a CaseId is expected.

const brand = <B extends string>() =>
  z.string().uuid().brand<B>();

export const TenantId = z.string().min(1).brand<'TenantId'>();
export type TenantId = z.infer<typeof TenantId>;

export const UserId = brand<'UserId'>();
export type UserId = z.infer<typeof UserId>;

export const MembershipId = brand<'MembershipId'>();
export type MembershipId = z.infer<typeof MembershipId>;

export const PolicyId = brand<'PolicyId'>();
export type PolicyId = z.infer<typeof PolicyId>;

export const CaseId = brand<'CaseId'>();
export type CaseId = z.infer<typeof CaseId>;

export const DocumentId = brand<'DocumentId'>();
export type DocumentId = z.infer<typeof DocumentId>;

export const SchemeId = brand<'SchemeId'>();
export type SchemeId = z.infer<typeof SchemeId>;

export const ProductModuleId = z.string().min(1).brand<'ProductModuleId'>();
export type ProductModuleId = z.infer<typeof ProductModuleId>;

export const AgentDefinitionId = z.string().min(1).brand<'AgentDefinitionId'>();
export type AgentDefinitionId = z.infer<typeof AgentDefinitionId>;

export const AgentRunId = brand<'AgentRunId'>();
export type AgentRunId = z.infer<typeof AgentRunId>;

export const PaymentId = brand<'PaymentId'>();
export type PaymentId = z.infer<typeof PaymentId>;

export const SubscriptionId = brand<'SubscriptionId'>();
export type SubscriptionId = z.infer<typeof SubscriptionId>;

export const FeatureFlagKey = z.string().min(1).brand<'FeatureFlagKey'>();
export type FeatureFlagKey = z.infer<typeof FeatureFlagKey>;
