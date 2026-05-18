'use client';

import { useState } from 'react';
import { Plus, X, UserCircle2, Heart, Pill, Info } from 'lucide-react';
import { Button } from '@suraksha/ui';
import { cn } from '@/lib/cn';

/**
 * Supplemental demographics form. Optional — if the user skips, the pipeline
 * falls back to synthesising members from the extractor's member list. When
 * provided, the coverage agent produces materially better per-member cards
 * (real ages, pre-existing conditions, chronic meds, life events it can
 * reason about).
 *
 * Persisted to policy_analysis.demographics_json. Passed through startAnalysis
 * on upload, or via refineCoverageForAnalysis on the report page.
 */

export interface DemographicsFormValue {
  members: Array<{
    ref: string;
    age: number;
    display_label: string;
    pre_existing?: string[];
    chronic_meds?: string[];
    notes?: string;
  }>;
  life_events?: string[];
  household_city?: string;
}

interface Props {
  initial?: DemographicsFormValue | null;
  locale: 'en' | 'hi' | 'kn' | string;
  onSubmit: (value: DemographicsFormValue) => void | Promise<void>;
  onSkip?: () => void | Promise<void>;
  submitting?: boolean;
  submitLabel?: string;
  skipLabel?: string;
  heading?: string;
  subheading?: string;
}

type MemberRow = {
  ref: string;
  relation: string;
  age: string; // string during edit, parsed on submit
  pre_existing: string[];
  chronic_meds: string[];
  notes: string;
};

const RELATION_OPTIONS = [
  { value: 'self', labelEn: 'Self' },
  { value: 'spouse', labelEn: 'Spouse' },
  { value: 'son', labelEn: 'Son' },
  { value: 'daughter', labelEn: 'Daughter' },
  { value: 'mother', labelEn: 'Mother' },
  { value: 'father', labelEn: 'Father' },
  { value: 'mother_in_law', labelEn: 'Mother-in-law' },
  { value: 'father_in_law', labelEn: 'Father-in-law' },
  { value: 'other', labelEn: 'Other' },
];

const LIFE_EVENT_OPTIONS = [
  { value: 'marriage', labelEn: 'Got married recently' },
  { value: 'childbirth', labelEn: 'Expecting / had a baby' },
  { value: 'parent_moved_in', labelEn: 'Parent moved in' },
  { value: 'surgery_planned', labelEn: 'Surgery planned soon' },
  { value: 'chronic_diagnosis', labelEn: 'New chronic diagnosis' },
  { value: 'income_change', labelEn: 'Income changed' },
  { value: 'moved_cities', labelEn: 'Moved cities' },
];

const MAX_MEMBERS = 8;

function emptyMember(): MemberRow {
  return {
    ref: Math.random().toString(36).slice(2, 8),
    relation: 'self',
    age: '',
    pre_existing: [],
    chronic_meds: [],
    notes: '',
  };
}

function seedFromInitial(initial: DemographicsFormValue | null | undefined): MemberRow[] {
  if (!initial || initial.members.length === 0) return [emptyMember()];
  return initial.members.map((m) => ({
    ref: m.ref || Math.random().toString(36).slice(2, 8),
    relation: RELATION_OPTIONS.find((o) => o.value === m.ref)?.value ?? 'other',
    age: m.age > 0 ? String(m.age) : '',
    pre_existing: m.pre_existing ?? [],
    chronic_meds: m.chronic_meds ?? [],
    notes: m.notes ?? '',
  }));
}

export function DemographicsForm({
  initial,
  locale,
  onSubmit,
  onSkip,
  submitting,
  submitLabel = 'Analyse my policy',
  skipLabel = "Skip — analyse the policy alone",
  heading = 'Tell us about your family (optional)',
  subheading = "This tailors your report for YOUR family — 30 seconds. Not stored anywhere insurers can see.",
}: Props) {
  const [members, setMembers] = useState<MemberRow[]>(seedFromInitial(initial));
  const [lifeEvents, setLifeEvents] = useState<string[]>(initial?.life_events ?? []);
  const [city, setCity] = useState(initial?.household_city ?? '');

  function updateMember(ref: string, patch: Partial<MemberRow>) {
    setMembers((ms) => ms.map((m) => (m.ref === ref ? { ...m, ...patch } : m)));
  }
  function removeMember(ref: string) {
    setMembers((ms) => (ms.length > 1 ? ms.filter((m) => m.ref !== ref) : ms));
  }
  function addMember() {
    setMembers((ms) => (ms.length < MAX_MEMBERS ? [...ms, emptyMember()] : ms));
  }

  function buildValue(): DemographicsFormValue {
    return {
      members: members
        .filter((m) => m.age.trim() !== '' || m.pre_existing.length > 0 || m.chronic_meds.length > 0 || m.notes.trim() !== '')
        .map((m) => {
          const rel = RELATION_OPTIONS.find((o) => o.value === m.relation);
          const label = [rel?.labelEn, m.age ? `${m.age}y` : null].filter(Boolean).join(', ');
          return {
            ref: m.relation,
            age: parseInt(m.age, 10) || 0,
            display_label: label || 'Member',
            pre_existing: m.pre_existing,
            chronic_meds: m.chronic_meds,
            notes: m.notes || undefined,
          };
        }),
      life_events: lifeEvents,
      household_city: city.trim() || undefined,
    };
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = buildValue();
    void onSubmit(value);
  }

  const isEmpty =
    members.every((m) => !m.age && m.pre_existing.length === 0 && m.chronic_meds.length === 0) &&
    lifeEvents.length === 0 &&
    !city.trim();

  return (
    <form onSubmit={handleSubmit} className="space-y-6 rounded-2xl border border-border bg-card/60 p-6 shadow-card">
      <header>
        <h2 className="font-display text-xl font-semibold text-ink">{heading}</h2>
        <p className="mt-1 text-sm text-ink-muted">{subheading}</p>
      </header>

      {/* Members */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            <UserCircle2 className="size-3.5" />
            Family members
          </div>
          <span className="text-xs text-ink-subtle">{members.length} / {MAX_MEMBERS}</span>
        </div>
        <div className="space-y-3">
          {members.map((m, idx) => (
            <MemberRowEditor
              key={m.ref}
              member={m}
              onChange={(patch) => updateMember(m.ref, patch)}
              onRemove={members.length > 1 ? () => removeMember(m.ref) : undefined}
              index={idx}
            />
          ))}
        </div>
        {members.length < MAX_MEMBERS && (
          <button
            type="button"
            onClick={addMember}
            className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
          >
            <Plus className="size-4" /> Add a member
          </button>
        )}
      </section>

      {/* Life events */}
      <section>
        <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
          <Heart className="size-3.5" />
          Recent / upcoming life events
        </div>
        <div className="flex flex-wrap gap-2">
          {LIFE_EVENT_OPTIONS.map((e) => {
            const active = lifeEvents.includes(e.value);
            return (
              <button
                key={e.value}
                type="button"
                onClick={() =>
                  setLifeEvents((prev) =>
                    prev.includes(e.value) ? prev.filter((x) => x !== e.value) : [...prev, e.value],
                  )
                }
                className={cn(
                  'rounded-full border px-3 py-1.5 text-xs transition',
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border text-ink-muted hover:border-primary/40 hover:text-ink',
                )}
              >
                {e.labelEn}
              </button>
            );
          })}
        </div>
      </section>

      {/* City */}
      <section>
        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-ink-muted">
          City (optional)
        </label>
        <input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="e.g. Bengaluru, Mumbai"
          className="w-full max-w-xs rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
        />
        <p className="mt-1 text-xs text-ink-subtle">
          Helps us check network-hospital density in your area.
        </p>
      </section>

      {/* Privacy note */}
      <div className="flex items-start gap-2 rounded-lg bg-background/60 px-3 py-2 text-xs text-ink-subtle">
        <Info className="mt-0.5 size-3.5 flex-none" />
        <span>
          This data stays on Indian servers, auto-deletes in 7 days, and never leaves for the insurer.
          Only used to tailor YOUR report.
        </span>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 pt-2">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? 'Working…' : isEmpty ? submitLabel : submitLabel}
        </Button>
        {onSkip && (
          <button
            type="button"
            onClick={() => void onSkip()}
            disabled={submitting}
            className="text-sm text-ink-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
          >
            {skipLabel}
          </button>
        )}
        {!isEmpty && (
          <span className="text-xs text-ink-subtle">Locale: {locale}</span>
        )}
      </div>
    </form>
  );
}

function MemberRowEditor({
  member,
  onChange,
  onRemove,
  index,
}: {
  member: MemberRow;
  onChange: (patch: Partial<MemberRow>) => void;
  onRemove?: () => void;
  index: number;
}) {
  const [preExistingInput, setPreExistingInput] = useState('');
  const [medInput, setMedInput] = useState('');

  function addChip(current: string[], input: string, key: 'pre_existing' | 'chronic_meds') {
    const clean = input.trim();
    if (!clean || current.includes(clean)) return;
    onChange({ [key]: [...current, clean] } as Partial<MemberRow>);
  }
  function removeChip(current: string[], chip: string, key: 'pre_existing' | 'chronic_meds') {
    onChange({ [key]: current.filter((c) => c !== chip) } as Partial<MemberRow>);
  }

  return (
    <div className="rounded-lg border border-border bg-background/60 p-4">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex-1 min-w-[140px]">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Relation
          </label>
          <select
            value={member.relation}
            onChange={(e) => onChange({ relation: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-primary"
          >
            {RELATION_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.labelEn}
              </option>
            ))}
          </select>
        </div>
        <div className="w-20">
          <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
            Age
          </label>
          <input
            type="number"
            min={0}
            max={120}
            value={member.age}
            onChange={(e) => onChange({ age: e.target.value })}
            className="w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm focus:border-primary"
          />
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove member ${index + 1}`}
            className="mt-5 rounded-md border border-border p-1.5 text-ink-muted transition hover:border-danger/40 hover:text-danger"
          >
            <X className="size-3.5" />
          </button>
        )}
      </div>

      <ChipsEditor
        icon={<Heart className="size-3.5" />}
        label="Pre-existing conditions"
        placeholder="e.g. diabetes, hypertension"
        chips={member.pre_existing}
        input={preExistingInput}
        setInput={setPreExistingInput}
        onAdd={() => {
          addChip(member.pre_existing, preExistingInput, 'pre_existing');
          setPreExistingInput('');
        }}
        onRemove={(chip) => removeChip(member.pre_existing, chip, 'pre_existing')}
      />

      <ChipsEditor
        icon={<Pill className="size-3.5" />}
        label="Chronic medications"
        placeholder="e.g. metformin, atorvastatin"
        chips={member.chronic_meds}
        input={medInput}
        setInput={setMedInput}
        onAdd={() => {
          addChip(member.chronic_meds, medInput, 'chronic_meds');
          setMedInput('');
        }}
        onRemove={(chip) => removeChip(member.chronic_meds, chip, 'chronic_meds')}
      />
    </div>
  );
}

function ChipsEditor({
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
    <div className="mt-3">
      <label className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-ink-subtle">
        {icon}
        {label}
      </label>
      <div className="flex flex-wrap items-center gap-1.5">
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
        <div className="flex items-center gap-1">
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
            className="min-w-[140px] rounded-md border border-transparent bg-background px-2 py-1 text-xs focus:border-primary focus:outline-none"
          />
          {input && (
            <button
              type="button"
              onClick={onAdd}
              className="rounded-md border border-border px-1.5 py-0.5 text-xs text-ink-muted hover:text-ink"
            >
              Add
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
