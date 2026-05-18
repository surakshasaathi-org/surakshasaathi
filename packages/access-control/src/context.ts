import type { Role, Locale, TenantId, UserId } from '@suraksha/types';

/**
 * The request context every guard operates on. Built from the JWT + a DB look-up of
 * active entitlements and feature flags.
 *
 * Built by the BFF layer (Next.js middleware, a route handler, or a Server Action
 * wrapper) and passed to every guard.
 */
export type Caller =
  | { kind: 'anonymous'; tenantId: TenantId; locale: Locale }
  | {
      kind: 'authenticated';
      userId: UserId;
      tenantId: TenantId;
      role: Role;
      locale: Locale;
      /** Active entitlement scopes, e.g. "module:claims-advocacy", "feature:ombudsman-draft" */
      entitlementScopes: ReadonlySet<string>;
      /** Feature flag keys currently enabled for this caller. */
      enabledFlags: ReadonlySet<string>;
      email?: string;
      phone?: string;
    };

export function isAuthed(
  c: Caller,
): c is Extract<Caller, { kind: 'authenticated' }> {
  return c.kind === 'authenticated';
}

export function anonymousCaller(tenantId: TenantId, locale: Locale): Caller {
  return { kind: 'anonymous', tenantId, locale };
}
