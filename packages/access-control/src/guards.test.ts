import { describe, expect, it } from 'vitest';
import { anonymousCaller } from './context';
import {
  ensureAuthed,
  requireAuth,
  requireEntitlement,
  requireFeature,
  requireRole,
} from './guards';

const anon = anonymousCaller('surakshasaathi' as never, 'en' as never);

const authed = {
  kind: 'authenticated' as const,
  userId: 'u1' as never,
  tenantId: 'surakshasaathi' as never,
  role: 'member' as const,
  locale: 'en' as never,
  entitlementScopes: new Set<string>(),
  enabledFlags: new Set<string>(),
};

describe('guards', () => {
  it('anonymous level lets anyone in', () => {
    expect(() => requireAuth(anon, 'anonymous')).not.toThrow();
  });

  it('registered level rejects anon, allows authed', () => {
    // AppError.message is 'no session'; userFacing copy is 'Please sign in…'.
    // Match on the internal message so a refactor of the user-facing string
    // doesn't silently break the guard's behaviour.
    expect(() => requireAuth(anon, 'registered')).toThrow('no session');
    expect(() => requireAuth(authed, 'registered')).not.toThrow();
  });

  it('aadhaar_ekyc level requires the verified entitlement', () => {
    expect(() => requireAuth(authed, 'aadhaar_ekyc')).toThrow();
    const verified = { ...authed, entitlementScopes: new Set(['aadhaar_ekyc:verified']) };
    expect(() => requireAuth(verified, 'aadhaar_ekyc')).not.toThrow();
  });

  it('requireRole rejects anon', () => {
    expect(() => requireRole(anon, ['admin'])).toThrow();
  });

  it('requireFeature rejects when flag not in caller.enabledFlags', () => {
    expect(() => requireFeature(authed, 'x.y')).toThrow();
    const on = { ...authed, enabledFlags: new Set(['x.y']) };
    expect(() => requireFeature(on, 'x.y')).not.toThrow();
  });

  it('requireEntitlement rejects when scope not held', () => {
    expect(() => requireEntitlement(authed, 'module:claims-advocacy')).toThrow();
    const ok = { ...authed, entitlementScopes: new Set(['module:claims-advocacy']) };
    expect(() => requireEntitlement(ok, 'module:claims-advocacy')).not.toThrow();
  });

  it('ensureAuthed narrows anon to throw', () => {
    expect(() => ensureAuthed(anon)).toThrow();
  });
});
