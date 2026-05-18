'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Plus, X, Heart, Pill } from 'lucide-react';
import { Button } from '@suraksha/ui';
import { cn } from '@/lib/cn';
import {
  upsertFamilyMember,
  type FamilyMemberRow,
  type UpsertFamilyMemberInput,
} from '@/server/family/actions';

interface Props {
  initial?: FamilyMemberRow | null;
  /** When true, pre-check the "this is me (account holder)" flag. */
  forceIsPrimary?: boolean;
  onSaved?: () => void;
  onCancel?: () => void;
  showPrimaryCheckbox?: boolean;
}

const RELATION_PRESETS = [
  'self',
  'spouse',
  'son',
  'daughter',
  'mother',
  'father',
  'mother_in_law',
  'father_in_law',
  'brother',
  'sister',
  'other',
];

const GENDER_OPTIONS = [
  { value: '', label: '—' },
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not_to_say', label: 'Prefer not to say' },
];

/**
 * Reusable editor for a single family member. Used inline by the /my/family
 * page for both add-new and edit-existing. Handles:
 *   - basic fields (name, relation, DOB, gender)
 *   - chips for pre-existing conditions + chronic meds
 *   - ayushman card number (optional)
 *   - primary-member flag (at most one per account)
 */
export function FamilyMemberEditor({
  initial,
  forceIsPrimary,
  onSaved,
  onCancel,
  showPrimaryCheckbox = true,
}: Props) {
  const router = useRouter();
  const [relation, setRelation] = useState(initial?.relation ?? 'self');
  const [displayName, setDisplayName] = useState(initial?.displayName ?? '');
  const [dob, setDob] = useState(initial?.dateOfBirth ?? '');
  const [gender, setGender] = useState(initial?.gender ?? '');
  const [preExisting, setPreExisting] = useState<string[]>(initial?.preExistingConditions ?? []);
  const [meds, setMeds] = useState<string[]>(initial?.chronicMedications ?? []);
  const [peInput, setPeInput] = useState('');
  const [medInput, setMedInput] = useState('');
  const [ayushman, setAyushman] = useState(initial?.ayushmanCardNumber ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [isPrimary, setIsPrimary] = useState(
    forceIsPrimary ?? initial?.isPrimary ?? false,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const payload: UpsertFamilyMemberInput = {
      id: initial?.id ?? null,
      relation: relation.trim(),
      displayName: displayName.trim(),
      dateOfBirth: dob || null,
      gender: gender || null,
      preExistingConditions: preExisting,
      chronicMedications: meds,
      ayushmanCardNumber: ayushman || null,
      notes: notes || null,
      isPrimary,
    };
    startTransition(async () => {
      const res = await upsertFamilyMember(payload);
      if (!res.ok) {
        setError(res.message);
        return;
      }
      onSaved?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Name
          </span>
          <input
            type="text"
            required
            maxLength={80}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Full name"
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Relation
          </span>
          <select
            value={relation}
            onChange={(e) => setRelation(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          >
            {RELATION_PRESETS.map((r) => (
              <option key={r} value={r}>
                {humanize(r)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Date of birth
          </span>
          <input
            type="date"
            value={dob}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => setDob(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Gender
          </span>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          >
            {GENDER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Chips
        icon={<Heart className="size-3.5" />}
        label="Pre-existing conditions"
        placeholder="e.g. diabetes, hypertension"
        chips={preExisting}
        input={peInput}
        setInput={setPeInput}
        onAdd={() => {
          const v = peInput.trim();
          if (v && !preExisting.includes(v)) setPreExisting([...preExisting, v]);
          setPeInput('');
        }}
        onRemove={(c) => setPreExisting(preExisting.filter((x) => x !== c))}
      />

      <Chips
        icon={<Pill className="size-3.5" />}
        label="Chronic medications"
        placeholder="e.g. metformin, atorvastatin"
        chips={meds}
        input={medInput}
        setInput={setMedInput}
        onAdd={() => {
          const v = medInput.trim();
          if (v && !meds.includes(v)) setMeds([...meds, v]);
          setMedInput('');
        }}
        onRemove={(c) => setMeds(meds.filter((x) => x !== c))}
      />

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
          Ayushman Bharat card number (optional)
        </span>
        <input
          type="text"
          maxLength={40}
          value={ayushman}
          onChange={(e) => setAyushman(e.target.value)}
          placeholder="Your PM-JAY card if you have one"
          className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
        />
      </label>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
          Notes (optional)
        </span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Anything else relevant — surgery history, allergies, planned procedures"
          className="mt-1 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus:border-primary"
        />
      </label>

      {showPrimaryCheckbox && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPrimary}
            onChange={(e) => setIsPrimary(e.target.checked)}
            className="size-4 accent-primary"
          />
          <span className="text-ink-muted">
            This is me (the account holder). Used to anchor your dashboard.
          </span>
        </label>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 flex-none" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" size="md" disabled={pending}>
          {pending ? 'Saving…' : initial ? 'Save changes' : 'Add member'}
        </Button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="text-sm text-ink-muted hover:text-ink"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function Chips({
  icon,
  label,
  placeholder,
  chips,
  input,
  setInput,
  onAdd,
  onRemove,
}: {
  icon: React.ReactNode;
  label: string;
  placeholder: string;
  chips: string[];
  input: string;
  setInput: (s: string) => void;
  onAdd: () => void;
  onRemove: (c: string) => void;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
        {icon}
        {label}
      </div>
      <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background p-2">
        {chips.map((c) => (
          <span
            key={c}
            className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs text-primary"
          >
            {c}
            <button
              type="button"
              onClick={() => onRemove(c)}
              aria-label={`Remove ${c}`}
              className="rounded-full hover:bg-primary/20"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault();
              onAdd();
            }
          }}
          placeholder={chips.length === 0 ? placeholder : ''}
          className="min-w-[160px] flex-1 rounded bg-transparent px-1 py-1 text-sm outline-none"
        />
        {input && (
          <button
            type="button"
            onClick={onAdd}
            className={cn('rounded-md border border-border px-2 py-0.5 text-xs text-ink-muted hover:text-ink')}
            aria-label="Add"
          >
            <Plus className="size-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
