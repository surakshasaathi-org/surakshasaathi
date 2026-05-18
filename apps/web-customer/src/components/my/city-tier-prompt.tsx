'use client';

import { useState, useTransition } from 'react';
import { MapPin, X } from 'lucide-react';
import { cn } from '@/lib/cn';
import { setScoringProfile } from '@/server/scoring/actions';

/**
 * Compact city-tier prompt. Shown when the user doesn't have a scoring
 * profile and would benefit from one. Dismissible per-session.
 *
 * Kept deliberately small — one question, three chips, done. No pincode
 * lookup in v1 (ops can add later).
 */
export function CityTierPrompt() {
  const [dismissed, setDismissed] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (dismissed) return null;

  function pick(tier: 'metro' | 'tier_2' | 'tier_3') {
    setError(null);
    startTransition(async () => {
      const res = await setScoringProfile(tier);
      if (!res.ok) {
        setError(res.error ?? 'Could not save');
        return;
      }
      setDismissed(true);
    });
  }

  return (
    <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <MapPin className="mt-0.5 size-4 text-primary" />
          <div>
            <h3 className="text-sm font-semibold text-ink">Where do you live?</h3>
            <p className="mt-1 text-xs text-ink-muted">
              Helps us score your sum insured against local hospital costs — ₹5 L goes further in
              Indore than in Bengaluru.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss"
          className="rounded p-1 text-ink-muted hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {(
          [
            { slug: 'metro' as const, label: 'Metro', hint: 'Mumbai, Delhi, Bengaluru, Chennai, Kolkata…' },
            { slug: 'tier_2' as const, label: 'Tier 2', hint: 'Jaipur, Pune, Lucknow, Indore…' },
            { slug: 'tier_3' as const, label: 'Smaller town', hint: 'District HQs and below' },
          ]
        ).map((opt) => (
          <button
            key={opt.slug}
            type="button"
            disabled={pending}
            onClick={() => pick(opt.slug)}
            className={cn(
              'rounded-full border border-primary/40 bg-card px-3 py-1.5 text-xs font-medium transition',
              pending ? 'opacity-50' : 'hover:border-primary hover:bg-primary/10',
            )}
            title={opt.hint}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
