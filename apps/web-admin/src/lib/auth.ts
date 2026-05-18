import 'server-only';
import { redirect } from 'next/navigation';
import { and, eq } from 'drizzle-orm';
import { serviceDb, schema } from '@suraksha/db';
import type { Role } from '@suraksha/types';

/**
 * Admin-portal auth + RBAC.
 *
 * Three paths:
 *   1. Supabase not configured → auto-grant super_admin so every page renders
 *      in local dev without a running Supabase instance.
 *   2. ADMIN_BOOTSTRAP_EMAIL matches the signed-in user → upsert a super_admin
 *      membership + grant. Lets ops sign in with a real account and land in
 *      the portal without hand-running SQL. Works in any environment; unset
 *      in prod once human admins have been granted via the admin portal.
 *   3. Otherwise → look up the user's membership row on the default tenant
 *      and gate on its role. Missing row defaults to 'member' in prod
 *      (always denied for admin routes); in local dev we auto-grant
 *      super_admin so the portal is usable with any brand-new account.
 */

export interface AdminSession {
  userId: string;
  tenantId: string;
  role: Role;
  displayName: string | null;
  email: string | null;
}

const SUPABASE_CONFIGURED = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
const LOCAL_ENV =
  process.env.NEXT_PUBLIC_APP_ENV === 'local' || process.env.NODE_ENV === 'development';
const DEFAULT_TENANT = 'surakshasaathi';

export async function requireAdminSession(allowed: Role[]): Promise<AdminSession> {
  // Path 1: no Supabase configured → stubbed session.
  if (!SUPABASE_CONFIGURED) {
    return {
      userId: 'dev-super-admin',
      tenantId: DEFAULT_TENANT,
      role: 'super_admin',
      displayName: 'Dev Super-admin',
      email: 'dev@localhost',
    };
  }

  const { supabaseServer } = await import('./supabase-server');
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getUser();
  if (!data.user) {
    redirect('/sign-in');
  }
  const user = data.user;
  const email = user.email?.trim().toLowerCase() ?? null;
  const displayName =
    (user.user_metadata?.displayName as string | undefined) ??
    (user.user_metadata?.full_name as string | undefined) ??
    null;

  // Path 2: admin bootstrap email.
  const bootstrapEmail = process.env.ADMIN_BOOTSTRAP_EMAIL?.trim().toLowerCase();
  if (bootstrapEmail && email && email === bootstrapEmail) {
    await ensureSuperAdminMembership(user.id, email);
    if (!allowed.includes('super_admin')) redirect('/403');
    return {
      userId: user.id,
      tenantId: DEFAULT_TENANT,
      role: 'super_admin',
      displayName,
      email: user.email ?? null,
    };
  }

  // Path 3: real membership lookup.
  const role = await readRoleFromMembership(user.id);
  const effectiveRole: Role = role ?? (LOCAL_ENV ? 'super_admin' : 'member');

  if (!allowed.includes(effectiveRole)) {
    redirect('/403');
  }
  return {
    userId: user.id,
    tenantId: DEFAULT_TENANT,
    role: effectiveRole,
    displayName,
    email: user.email ?? null,
  };
}

async function readRoleFromMembership(userId: string): Promise<Role | null> {
  try {
    const db = serviceDb();
    const [row] = await db
      .select({ role: schema.membership.role })
      .from(schema.membership)
      .where(
        and(
          eq(schema.membership.tenantId, DEFAULT_TENANT),
          eq(schema.membership.userId, userId),
        ),
      )
      .limit(1);
    return (row?.role as Role) ?? null;
  } catch (err) {
    console.warn('[admin/auth] membership read failed', (err as Error).message);
    return null;
  }
}

async function ensureSuperAdminMembership(userId: string, email: string): Promise<void> {
  try {
    const db = serviceDb();
    // Belt-and-braces against the auth.users → app_user sync trigger racing.
    await db
      .insert(schema.appUser)
      .values({ id: userId, email })
      .onConflictDoNothing({ target: schema.appUser.id });

    const existing = await db
      .select({ id: schema.membership.id, role: schema.membership.role })
      .from(schema.membership)
      .where(
        and(
          eq(schema.membership.tenantId, DEFAULT_TENANT),
          eq(schema.membership.userId, userId),
        ),
      )
      .limit(1);

    if (existing.length === 0) {
      await db.insert(schema.membership).values({
        tenantId: DEFAULT_TENANT,
        userId,
        role: 'super_admin',
      });
    } else if (existing[0]!.role !== 'super_admin') {
      await db
        .update(schema.membership)
        .set({ role: 'super_admin' })
        .where(eq(schema.membership.id, existing[0]!.id));
    }
  } catch (err) {
    console.warn('[admin/auth] bootstrap admin promotion failed (non-fatal)', (err as Error).message);
  }
}
