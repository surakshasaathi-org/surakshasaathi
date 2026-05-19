import { Users } from 'lucide-react';
import { listFamily } from '@/server/family/actions';
import { FamilyList } from '@/components/my/family-list';
import { FamilyAddButton } from '@/components/my/family-add-button';

/**
 * The persistent family graph. One-time setup; used by every policy analysis
 * going forward — so users stop re-entering the same data on every upload.
 */
export const dynamic = 'force-dynamic';

export default async function FamilyPage() {
  const members = await listFamily();
  const hasPrimary = members.some((m) => m.isPrimary);

  return (
    <div>
      <header className="mb-6">
        <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Users className="size-3.5" />
          Your family
        </div>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Everyone you want protected
        </h1>
        <p className="mt-2 max-w-prose text-ink-muted">
          Add each family member once — we'll use their age, pre-existing conditions, and chronic
          medications for every policy analysis and coverage check from now on. You stay in
          control: edit or remove anyone, any time.
        </p>
      </header>

      {members.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <Users className="mx-auto size-10 text-ink-subtle" aria-hidden />
          <h2 className="mt-3 font-display text-lg font-semibold text-ink">
            No family members yet
          </h2>
          <p className="mt-1 text-sm text-ink-muted">
            Start with yourself — we'll pre-fill it from your profile. You can add others below.
          </p>
          <div className="mt-5">
            <FamilyAddButton hasPrimary={false} />
          </div>
        </div>
      ) : (
        <>
          <FamilyList members={members} />
          <FamilyAddButton hasPrimary={hasPrimary} />
        </>
      )}

      <div className="mt-10 rounded-xl border border-border bg-background/60 p-4 text-xs text-ink-subtle">
        <strong className="font-semibold text-ink">Privacy:</strong> your family data stays on
        Indian servers. We never share it with insurers; it's used only to tailor your reports. You
        can export or delete all of it any time from{' '}
        <a href="./settings" className="text-primary underline">
          Settings
        </a>
        .
      </div>
    </div>
  );
}
