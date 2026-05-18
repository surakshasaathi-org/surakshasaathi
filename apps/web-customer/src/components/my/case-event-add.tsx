'use client';

import { useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, Send } from 'lucide-react';
import { Button } from '@suraksha/ui';
import { addCaseEvent, updateCaseStatus } from '@/server/claims/actions';

interface Props {
  caseId: string;
  currentStatus: string;
}

const EVENT_TYPES = [
  { value: 'note', label: 'Note' },
  { value: 'document_uploaded', label: 'Document uploaded' },
  { value: 'insurer_contacted', label: 'Contacted insurer' },
  { value: 'ombudsman_filed', label: 'Ombudsman filed' },
  { value: 'payment_received', label: 'Payment received' },
];

const STATUS_OPTIONS = [
  'draft',
  'intake',
  'triaged',
  'docs_needed',
  'drafting',
  'awaiting_review',
  'filed',
  'awaiting_insurer',
  'escalated_ombudsman',
  'escalated_consumer_court',
  'resolved_in_favour',
  'resolved_against',
  'withdrawn',
  'abandoned',
];

export function CaseEventAdd({ caseId, currentStatus }: Props) {
  const router = useRouter();
  const [type, setType] = useState('note');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState(currentStatus);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (note.trim().length < 3) {
      setError('Add a short note describing what happened.');
      return;
    }
    startTransition(async () => {
      setError(null);
      const ev = await addCaseEvent({ caseId, type, note: note.trim() });
      if (!ev.ok) {
        setError(ev.message ?? 'Failed to add event.');
        return;
      }
      if (status !== currentStatus) {
        await updateCaseStatus(caseId, status);
      }
      setNote('');
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
      <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
        Add to timeline
      </h3>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Type</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          >
            {EVENT_TYPES.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            Case status (optional)
          </span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wider text-ink-subtle">Note</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="What happened?"
          className="mt-1 w-full rounded-md border border-input bg-background p-3 text-sm outline-none focus:border-primary"
        />
      </label>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 flex-none" />
          <span>{error}</span>
        </div>
      )}

      <Button type="submit" disabled={pending}>
        <Send className="mr-1.5 size-4" />
        {pending ? 'Adding…' : 'Add event'}
      </Button>
    </form>
  );
}
