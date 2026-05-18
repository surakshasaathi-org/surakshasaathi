'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Trash2 } from 'lucide-react';
import { removeUserRole, setUserRole, type UserRow } from '@/server/users/actions';

const ROLES = [
  'super_admin',
  'admin',
  'case_manager',
  'content_editor',
  'cx_agent',
  'viewer',
  'reviewer',
  'partner_admin',
  'member',
] as const;
type Role = (typeof ROLES)[number];

interface Props {
  user: UserRow;
  canGrantSuperAdmin: boolean;
  actorUserId: string;
  actorEmail: string;
}

export function UserRoleRow({ user, canGrantSuperAdmin, actorUserId, actorEmail }: Props) {
  const router = useRouter();
  const [selectedRole, setSelectedRole] = useState<Role>(
    (user.role as Role | null) ?? 'member',
  );
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const options = ROLES.filter((r) => r !== 'super_admin' || canGrantSuperAdmin);
  const dirty = selectedRole !== (user.role ?? 'member');

  function save() {
    startTransition(async () => {
      setMessage(null);
      const res = await setUserRole(user.id, selectedRole, actorUserId, actorEmail);
      if (!res.ok) {
        setMessage(res.message ?? 'Failed.');
        return;
      }
      setMessage(res.message ?? 'Saved.');
      router.refresh();
    });
  }

  function revoke() {
    if (!user.role) return;
    if (!window.confirm(`Remove ${user.role} membership from ${user.email ?? user.id}?`)) return;
    startTransition(async () => {
      setMessage(null);
      const res = await removeUserRole(user.id, actorUserId, actorEmail);
      if (!res.ok) {
        setMessage(res.message ?? 'Failed.');
        return;
      }
      setSelectedRole('member');
      router.refresh();
    });
  }

  return (
    <tr className="hover:bg-primary-subtle/30">
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <span className="text-sm text-ink">{user.fullName ?? '—'}</span>
          <span className="font-mono text-xs text-ink-subtle">{user.email ?? user.id}</span>
        </div>
      </td>
      <td className="px-4 py-3 text-xs text-ink-muted">{user.phoneE164 ?? '—'}</td>
      <td className="px-4 py-3 text-xs text-ink-muted">
        {new Date(user.createdAt).toLocaleDateString('en-IN', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        })}
      </td>
      <td className="px-4 py-3">
        <select
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value as Role)}
          disabled={pending}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs outline-none focus:border-primary"
        >
          {options.map((r) => (
            <option key={r} value={r}>
              {r.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={save}
            disabled={pending || !dirty}
            className="inline-flex items-center gap-1 rounded-md border border-primary/40 bg-primary/5 px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 disabled:opacity-50"
          >
            <Save className="size-3" />
            Save
          </button>
          {user.role && (
            <button
              type="button"
              onClick={revoke}
              disabled={pending}
              aria-label="Revoke"
              className="rounded-md border border-border p-1 text-ink-muted hover:border-danger/40 hover:text-danger disabled:opacity-50"
            >
              <Trash2 className="size-3" />
            </button>
          )}
          {message && <span className="ml-1 text-[11px] text-ink-muted">{message}</span>}
        </div>
      </td>
    </tr>
  );
}
