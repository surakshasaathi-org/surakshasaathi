'use server';
import { randomUUID } from 'node:crypto';
import { and, desc, eq, ilike, or } from 'drizzle-orm';
import { revalidatePath } from 'next/cache';
import { serviceDb, schema } from '@suraksha/db';
import type { Role } from '@suraksha/types';

/**
 * User + role management for admin ops.
 *
 *   - listUsers(filter?)                   — paginated user list with their
 *                                            current default-tenant role
 *   - setUserRole(userId, role)            — upsert membership, write audit_log
 *   - removeUserRole(userId)               — delete the membership row
 *                                            (falls back to the implicit
 *                                            'member' behaviour on next signin)
 *
 * Guarding a user from being a super_admin is simple: only other super_admins
 * can set that role (enforced in requireAdminSession at the caller).
 */

const DEFAULT_TENANT = 'surakshasaathi';

export interface UserRow {
  id: string;
  email: string | null;
  fullName: string | null;
  phoneE164: string | null;
  createdAt: string;
  profileCompletedAt: string | null;
  role: Role | null;
  roleSince: string | null;
}

export async function listUsers(filter?: string, limit = 100): Promise<UserRow[]> {
  const db = serviceDb();
  const where = filter
    ? or(
        ilike(schema.appUser.email, `%${filter}%`),
        ilike(schema.appUser.fullName, `%${filter}%`),
        ilike(schema.appUser.phoneE164, `%${filter}%`),
      )
    : undefined;

  const users = await db
    .select()
    .from(schema.appUser)
    .where(where)
    .orderBy(desc(schema.appUser.createdAt))
    .limit(limit);

  if (users.length === 0) return [];

  const memberships = await db
    .select()
    .from(schema.membership)
    .where(eq(schema.membership.tenantId, DEFAULT_TENANT));

  const byUser = new Map(memberships.map((m) => [m.userId, m]));

  return users.map((u) => {
    const m = byUser.get(u.id);
    return {
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      phoneE164: u.phoneE164,
      createdAt: u.createdAt.toISOString(),
      profileCompletedAt: u.profileCompletedAt?.toISOString() ?? null,
      role: (m?.role as Role) ?? null,
      roleSince: m?.createdAt.toISOString() ?? null,
    };
  });
}

export interface RoleChangeResult {
  ok: boolean;
  message?: string;
}

/**
 * Upsert the membership row. Writes an audit_log entry capturing who made
 * the change, old role → new role. Idempotent on no-op.
 */
export async function setUserRole(
  userId: string,
  newRole: Role,
  actorUserId: string,
  actorEmail: string,
): Promise<RoleChangeResult> {
  const db = serviceDb();
  try {
    const [existing] = await db
      .select({ id: schema.membership.id, role: schema.membership.role })
      .from(schema.membership)
      .where(
        and(
          eq(schema.membership.tenantId, DEFAULT_TENANT),
          eq(schema.membership.userId, userId),
        ),
      )
      .limit(1);

    const oldRole = (existing?.role as Role | undefined) ?? null;
    if (oldRole === newRole) {
      return { ok: true, message: 'No change.' };
    }

    if (existing) {
      await db
        .update(schema.membership)
        .set({ role: newRole })
        .where(eq(schema.membership.id, existing.id));
    } else {
      await db.insert(schema.membership).values({
        tenantId: DEFAULT_TENANT,
        userId,
        role: newRole,
      });
    }

    // Audit trail — never block the role change if audit write fails.
    try {
      await db.insert(schema.auditLog).values({
        id: randomUUID(),
        tenantId: DEFAULT_TENANT,
        actorUserId,
        actorKind: 'admin',
        action: 'membership.role_changed',
        subjectType: 'app_user',
        subjectId: userId,
        payload: { old_role: oldRole, new_role: newRole, actor_email: actorEmail },
      });
    } catch (err) {
      console.warn('[admin/users] audit write failed (non-fatal)', (err as Error).message);
    }

    revalidatePath('/users', 'page');
    return { ok: true };
  } catch (err) {
    return { ok: false, message: (err as Error).message.slice(0, 240) };
  }
}

export async function removeUserRole(
  userId: string,
  actorUserId: string,
  actorEmail: string,
): Promise<RoleChangeResult> {
  const db = serviceDb();
  try {
    const res = await db
      .delete(schema.membership)
      .where(
        and(
          eq(schema.membership.tenantId, DEFAULT_TENANT),
          eq(schema.membership.userId, userId),
        ),
      )
      .returning({ id: schema.membership.id });
    if (res.length === 0) {
      return { ok: true, message: 'No membership to remove.' };
    }
    try {
      await db.insert(schema.auditLog).values({
        id: randomUUID(),
        tenantId: DEFAULT_TENANT,
        actorUserId,
        actorKind: 'admin',
        action: 'membership.revoked',
        subjectType: 'app_user',
        subjectId: userId,
        payload: { actor_email: actorEmail },
      });
    } catch {
      /* non-fatal */
    }
    revalidatePath('/users', 'page');
    return { ok: true };
  } catch (err) {
    return { ok: false, message: (err as Error).message.slice(0, 240) };
  }
}
