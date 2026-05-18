import { Users } from 'lucide-react';
import { AdminShell } from '@/components/admin-shell';
import { requireAdminSession } from '@/lib/auth';
import { listUsers } from '@/server/users/actions';
import { UserRoleRow } from '@/components/user-role-row';

interface Props {
  searchParams: Promise<{ q?: string }>;
}

export const dynamic = 'force-dynamic';

export default async function UsersPage({ searchParams }: Props) {
  const session = await requireAdminSession(['super_admin', 'admin']);
  const sp = await searchParams;
  const filter = sp.q?.trim() || undefined;
  const users = await listUsers(filter, 200);

  return (
    <AdminShell role={session.role} email={session.email}>
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Users className="size-3.5" />
          Users & roles
        </div>
        <h1 className="mt-2 font-display text-2xl font-semibold tracking-tight">
          People &amp; access
        </h1>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">
          Every registered user and their role on the default tenant. Change a role to grant or
          revoke admin access — writes to <code className="rounded bg-background px-1">audit_log</code>{' '}
          automatically. Only super_admin can grant super_admin.
        </p>
      </header>

      <form method="get" className="mb-4">
        <input
          type="search"
          name="q"
          defaultValue={filter}
          placeholder="Search by email, name or phone…"
          className="h-10 w-full max-w-md rounded-md border border-input bg-card px-3 text-sm outline-none focus:border-primary"
        />
      </form>

      <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-card">
        <table className="min-w-full text-sm">
          <thead className="bg-background/60 text-left text-xs uppercase tracking-wider text-ink-muted">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Phone</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {users.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-sm text-ink-muted">
                  {filter ? `No users matching "${filter}".` : 'No users yet.'}
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <UserRoleRow
                  key={u.id}
                  user={u}
                  canGrantSuperAdmin={session.role === 'super_admin'}
                  actorUserId={session.userId}
                  actorEmail={session.email ?? 'admin'}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </AdminShell>
  );
}
