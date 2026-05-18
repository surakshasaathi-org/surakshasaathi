'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Plus } from 'lucide-react';
import { Button } from '@suraksha/ui';
import { createCase, type CreateCaseInput } from '@/server/claims/actions';

const KIND_OPTIONS: Array<{ value: CreateCaseInput['kind']; label: string; help: string }> = [
  { value: 'claim_rejection', label: 'Claim rejection', help: "A claim rejected by your insurer." },
  { value: 'mis_selling', label: 'Mis-selling recovery', help: 'A ULIP or life policy you were mis-sold.' },
  { value: 'unclaimed_recovery', label: 'Unclaimed amount', help: 'Tracking an unpaid claim or unclaimed sum assured.' },
  { value: 'scheme_refusal', label: 'Scheme refusal', help: 'A hospital refused to honour a govt scheme (PM-JAY etc).' },
  { value: 'advisory', label: 'Other advisory', help: 'Anything else you want help with.' },
];

interface Props {
  locale: string;
}

export function NewCaseForm({ locale }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CreateCaseInput['kind']>('claim_rejection');
  const [title, setTitle] = useState('');
  const [insurer, setInsurer] = useState('');
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3) {
      setError('Give the case a short title (what happened, in a sentence).');
      return;
    }
    startTransition(async () => {
      setError(null);
      const amountPaise = amount ? Math.round(parseFloat(amount.replace(/,/g, '')) * 100) : null;
      const res = await createCase({
        kind,
        title: title.trim(),
        insurerName: insurer.trim() || null,
        amountClaimedPaise: amountPaise && !Number.isNaN(amountPaise) ? amountPaise : null,
        notes: notes.trim() || undefined,
      });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      setOpen(false);
      router.push(`/${locale}/my/claims/${res.id}`);
    });
  }

  if (!open) {
    return (
      <Button type="button" variant="primary" onClick={() => setOpen(true)}>
        <Plus className="mr-1.5 size-4" />
        Open a new case
      </Button>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-border bg-card p-5 shadow-card">
      <h2 className="font-display text-lg font-semibold text-ink">Open a case</h2>

      <div className="grid grid-cols-1 gap-3">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Kind</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as CreateCaseInput['kind'])}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-ink-subtle">
            {KIND_OPTIONS.find((o) => o.value === kind)?.help}
          </p>
        </label>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Title (what happened)
          </span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Hospitalisation at X hospital — claim rejected"
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Insurer</span>
            <input
              type="text"
              value={insurer}
              onChange={(e) => setInsurer(e.target.value)}
              placeholder="e.g. Star Health"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
              Amount claimed (₹)
            </span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 85000"
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            />
          </label>
        </div>

        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Background notes
          </span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="What was the treatment? When? What has the insurer said so far?"
            className="mt-1 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus:border-primary"
          />
        </label>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 flex-none" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={pending}>
          {pending ? 'Opening…' : 'Open case'}
        </Button>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-muted hover:text-ink">
          Cancel
        </button>
      </div>
    </form>
  );
}
