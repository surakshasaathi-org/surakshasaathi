'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  Pencil,
  Trash2,
  UserCircle2,
  AlertCircle,
  BadgeCheck,
  Check,
  Heart,
  Pill,
  Sparkles,
  CalendarDays,
} from 'lucide-react';
import { Badge } from '@suraksha/ui';
import { cn } from '@/lib/cn';
import {
  confirmFamilyMember,
  deleteFamilyMember,
  type FamilyMemberRow,
} from '@/server/family/actions';
import { FamilyMemberEditor } from './family-member-editor';

interface Props {
  members: FamilyMemberRow[];
}

/**
 * Renders the persistent family graph. Each member is a card with inline
 * edit + delete. Pre-existing conditions and chronic meds are chip-rendered
 * so the page is scannable at a glance.
 */
export function FamilyList({ members }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);

  if (members.length === 0) return null;

  return (
    <ul className="space-y-4">
      {members.map((m) =>
        editingId === m.id ? (
          <li key={m.id}>
            <FamilyMemberEditor
              initial={m}
              onSaved={() => setEditingId(null)}
              onCancel={() => setEditingId(null)}
              showPrimaryCheckbox={!m.isPrimary || members.filter((x) => x.isPrimary).length > 1}
            />
          </li>
        ) : (
          <FamilyCard
            key={m.id}
            member={m}
            onEdit={() => setEditingId(m.id)}
            canDelete={!m.isPrimary || members.length === 1}
          />
        ),
      )}
    </ul>
  );
}

function FamilyCard({
  member,
  onEdit,
  canDelete,
}: {
  member: FamilyMemberRow;
  onEdit: () => void;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const isDraft = member.status === 'draft';

  function onDelete() {
    if (!canDelete) {
      setError('This is your primary profile. Promote another member to primary first.');
      return;
    }
    const prompt = isDraft
      ? `Reject this proposed member (${member.displayName})?`
      : `Remove ${member.displayName} from your family?`;
    if (!window.confirm(prompt)) return;
    startTransition(async () => {
      setError(null);
      const res = await deleteFamilyMember(member.id);
      if (!res.ok) {
        setError(res.message ?? 'Delete failed');
        return;
      }
      router.refresh();
    });
  }

  function onConfirm() {
    startTransition(async () => {
      setError(null);
      const res = await confirmFamilyMember(member.id);
      if (!res.ok) {
        setError(res.message ?? 'Confirm failed');
        return;
      }
      router.refresh();
    });
  }

  return (
    <li
      className={cn(
        'rounded-2xl border p-5 shadow-card',
        isDraft
          ? 'border-warn/40 bg-warn-subtle/40 border-dashed'
          : 'border-border bg-card',
      )}
    >
      {isDraft && (
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-warn/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-warn">
          <Sparkles className="size-3" />
          Proposed · review to confirm
        </div>
      )}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <UserCircle2 className="size-5 text-primary" />
            <h3 className="font-display text-lg font-semibold text-ink">
              {member.displayName}
            </h3>
            {member.isPrimary && (
              <Badge tone="primary">
                <BadgeCheck className="mr-1 size-3" />
                You
              </Badge>
            )}
            <span className="text-sm text-ink-muted">· {humanize(member.relation)}</span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-ink-muted">
            {member.dateOfBirth && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="size-3.5" />
                {formatDob(member.dateOfBirth)} · {ageInYears(member.dateOfBirth)}y
              </span>
            )}
            {member.gender && <span>{humanize(member.gender)}</span>}
            {member.ayushmanCardNumber && (
              <span className="inline-flex items-center gap-1">
                <BadgeCheck className="size-3.5 text-success" />
                PM-JAY linked
              </span>
            )}
          </div>

          {(member.preExistingConditions.length > 0 || member.chronicMedications.length > 0) && (
            <div className="mt-3 space-y-1.5">
              {member.preExistingConditions.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Heart className="size-3.5 text-ink-subtle" />
                  {member.preExistingConditions.map((c) => (
                    <Badge key={c} tone="neutral">
                      {c}
                    </Badge>
                  ))}
                </div>
              )}
              {member.chronicMedications.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5">
                  <Pill className="size-3.5 text-ink-subtle" />
                  {member.chronicMedications.map((c) => (
                    <Badge key={c} tone="neutral">
                      {c}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          )}

          {member.notes && (
            <p className="mt-3 text-sm text-ink-muted">{member.notes}</p>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-1 sm:flex-row">
          {isDraft && (
            <button
              type="button"
              onClick={onConfirm}
              aria-label="Confirm proposed member"
              disabled={pending}
              className="inline-flex items-center gap-1 rounded-md border border-success/50 bg-success/10 px-2 py-1.5 text-xs font-medium text-success transition hover:bg-success/20 disabled:opacity-50"
            >
              <Check className="size-3.5" />
              Confirm
            </button>
          )}
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit member"
            className="rounded-md border border-border p-2 text-ink-muted transition hover:border-primary/50 hover:text-ink"
          >
            <Pencil className="size-4" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={isDraft ? 'Reject proposed member' : 'Delete member'}
            disabled={pending || !canDelete}
            className={cn(
              'rounded-md border p-2 transition',
              canDelete
                ? 'border-border text-ink-muted hover:border-danger/50 hover:text-danger'
                : 'cursor-not-allowed border-border text-ink-subtle opacity-50',
            )}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 flex-none" />
          <span>{error}</span>
        </div>
      )}
    </li>
  );
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDob(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ageInYears(iso: string): number {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 0;
  const diff = Date.now() - d.getTime();
  return Math.floor(diff / (365.25 * 24 * 3600 * 1000));
}
