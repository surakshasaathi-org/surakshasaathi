import { errors, type AuthLevel, type Role } from '@suraksha/types';
import type { Caller } from './context';

/**
 * Composable guards. Each either returns the Caller (narrowed) or throws an AppError.
 *
 * Usage in a Server Action / route handler:
 *
 *     const caller = await buildCaller(req);
 *     requireAuth(caller, 'registered');
 *     requireFeature(caller, 'module.claims-advocacy.intake_open');
 *     requireTier(caller, 'module:claims-advocacy', 'success_fee'); // or whatever
 */

export function requireAuth<A extends AuthLevel>(
  caller: Caller,
  level: A,
): asserts caller is Extract<Caller, { kind: 'authenticated' }> | Extract<Caller, { kind: 'anonymous' }> {
  if (level === 'anonymous') return;
  if (caller.kind !== 'authenticated') {
    throw errors.notAuthenticated();
  }
  if (level === 'registered') return;
  if (level === 'paid') {
    // caller-specific entitlement check is the caller's responsibility via requireTier/requireEntitlement.
    return;
  }
  if (level === 'aadhaar_ekyc') {
    if (!caller.entitlementScopes.has('aadhaar_ekyc:verified')) {
      throw errors.notAuthorized('This action requires Aadhaar e-KYC.');
    }
    return;
  }
  if (level === 'b2b_admin') {
    if (caller.role !== 'partner_admin' && caller.role !== 'admin' && caller.role !== 'super_admin') {
      throw errors.notAuthorized('This is a B2B admin action.');
    }
    return;
  }
}

export function requireRole(caller: Caller, roles: readonly Role[]): void {
  if (caller.kind !== 'authenticated') throw errors.notAuthenticated();
  if (!roles.includes(caller.role)) {
    throw errors.notAuthorized();
  }
}

export function requireFeature(caller: Caller, flagKey: string): void {
  const enabled = caller.kind === 'authenticated' ? caller.enabledFlags : undefined;
  if (!enabled || !enabled.has(flagKey)) {
    throw errors.featureDisabled(flagKey);
  }
}

export function requireEntitlement(caller: Caller, scope: string): void {
  if (caller.kind !== 'authenticated') throw errors.notAuthenticated();
  if (!caller.entitlementScopes.has(scope)) {
    throw errors.tierRequired(scope);
  }
}

export function requireModuleEnabled(caller: Caller, moduleId: string): void {
  // module gate = feature flag "module.<id>.intake_open" (seeded in DB) + module status != deprecated
  requireFeature(caller, `module.${moduleId}.intake_open`);
}

/**
 * Utility — drop-in for a Next.js Server Action that needs auth. Returns a narrowed
 * Caller that's guaranteed to be `authenticated` for the subsequent scope.
 */
export function ensureAuthed(caller: Caller): Extract<Caller, { kind: 'authenticated' }> {
  if (caller.kind !== 'authenticated') throw errors.notAuthenticated();
  return caller;
}
