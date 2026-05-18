'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { setConsent } from '@/server/auth/consent';
import { type ConsentState } from '@/server/auth/consent-config';

interface PurposeDef {
  id: string;
  label: string;
  description: string;
  required: boolean;
}

interface Props {
  purposes: PurposeDef[];
  initialStates: ConsentState[];
}

export function ConsentToggles({ purposes, initialStates }: Props) {
  const router = useRouter();
  const [states, setStates] = useState(
    new Map(initialStates.map((s) => [s.purposeId, s.granted])),
  );
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [_, startTransition] = useTransition();

  function toggle(id: string, next: boolean) {
    setUpdatingId(id);
    setError(null);
    startTransition(async () => {
      const res = await setConsent(id, next);
      if (!res.ok) {
        setError(res.message ?? 'Failed to update.');
        setUpdatingId(null);
        return;
      }
      setStates((m) => new Map(m).set(id, next));
      setUpdatingId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      {purposes.map((p) => {
        const granted = states.get(p.id) ?? false;
        const busy = updatingId === p.id;
        return (
          <div
            key={p.id}
            className="flex items-start justify-between gap-4 rounded-lg border border-border bg-background/50 p-4"
          >
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-ink">{p.label}</span>
                {p.required && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                    <ShieldCheck className="size-3" />
                    required
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-ink-muted">{p.description}</p>
            </div>
            <button
              type="button"
              onClick={() => toggle(p.id, !granted)}
              disabled={busy || (p.required && granted)}
              aria-pressed={granted}
              aria-label={`${granted ? 'Withdraw' : 'Grant'} consent for ${p.label}`}
              className={cn(
                'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition',
                granted ? 'bg-primary' : 'bg-border',
                busy && 'opacity-50',
              )}
            >
              <span
                className={cn(
                  'inline-block size-5 transform rounded-full bg-white shadow transition',
                  granted ? 'translate-x-5' : 'translate-x-0.5',
                )}
              />
            </button>
          </div>
        );
      })}

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-subtle px-3 py-2 text-sm text-danger">
          <AlertCircle className="mt-0.5 size-4 flex-none" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
