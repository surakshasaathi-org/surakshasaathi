'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import { Button } from '@suraksha/ui';

/**
 * Sampling policy editor — one card per agent_slug. Admin can:
 *   - toggle enabled on/off
 *   - set rate% (0–100)
 *   - set daily cap (in ₹)
 * Saving POSTs to /api/eval-lab/sampling/[agentSlug] and invalidates the
 * in-process server cache so the new rate takes effect on the next prod
 * request (not 60s later, the cache TTL).
 */

interface Policy {
  agentSlug: string;
  ratePct: number;
  dailyCapPaise: number;
  spendTodayPaise: number;
  spendDayKey: string | null;
  enabled: boolean;
  updatedAt: string | null;
  hasRow: boolean;
}

export function SamplingPolicyEditor({ policies }: { policies: Policy[] }) {
  return (
    <div className="space-y-3">
      {policies.map((p) => (
        <PolicyRow key={p.agentSlug} initial={p} />
      ))}
    </div>
  );
}

function PolicyRow({ initial }: { initial: Policy }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const [ratePct, setRatePct] = useState(initial.ratePct);
  const [dailyCapRupees, setDailyCapRupees] = useState(Math.round(initial.dailyCapPaise / 100));
  const [enabled, setEnabled] = useState(initial.enabled);

  const dirty =
    ratePct !== initial.ratePct ||
    Math.round(initial.dailyCapPaise / 100) !== dailyCapRupees ||
    enabled !== initial.enabled;

  const remainingPaise = Math.max(initial.dailyCapPaise - initial.spendTodayPaise, 0);
  const usedPct = initial.dailyCapPaise > 0
    ? Math.min(100, Math.round((initial.spendTodayPaise / initial.dailyCapPaise) * 100))
    : 0;

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/eval-lab/sampling/${initial.agentSlug}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ratePct,
          dailyCapPaise: dailyCapRupees * 100,
          enabled,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setErr(body.error ?? `http_${res.status}`);
        return;
      }
      setSavedAt(Date.now());
      startTransition(() => router.refresh());
    } catch (e) {
      setErr((e as Error).message.slice(0, 200));
    } finally {
      setSaving(false);
    }
  }

  const busy = saving || pending;

  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="font-mono text-sm font-semibold text-ink">{initial.agentSlug}</div>
          <div className="text-xs text-ink-subtle">
            {initial.hasRow
              ? `Last updated ${initial.updatedAt ? new Date(initial.updatedAt).toLocaleString() : '—'}`
              : 'No policy row yet — first save will create one.'}
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="size-4"
          />
          <span className="text-ink">Sampling enabled</span>
        </label>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">Rate %</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={ratePct}
              onChange={(e) => setRatePct(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2"
            />
          </label>
          <p className="mt-1 text-[11px] text-ink-subtle">
            % of live agent_runs that get sampled for a judge eval.
          </p>
        </div>

        <div>
          <label className="block">
            <span className="text-xs font-medium text-ink-muted">Daily cap (₹)</span>
            <input
              type="number"
              min={0}
              step={10}
              value={dailyCapRupees}
              onChange={(e) => setDailyCapRupees(Number(e.target.value))}
              className="mt-1 w-full rounded-md border border-input bg-card px-3 py-2 text-sm outline-none focus-visible:ring-2"
            />
          </label>
          <p className="mt-1 text-[11px] text-ink-subtle">
            Hard ceiling on judge spend per IST day. Resets at midnight.
          </p>
        </div>

        <div>
          <span className="text-xs font-medium text-ink-muted">Today's spend</span>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-lg text-ink">
              ₹{(initial.spendTodayPaise / 100).toFixed(2)}
            </span>
            <span className="text-xs text-ink-subtle">
              of ₹{(initial.dailyCapPaise / 100).toFixed(0)} cap
            </span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background">
            <div
              className={`h-full ${usedPct >= 100 ? 'bg-danger' : usedPct >= 80 ? 'bg-warn' : 'bg-primary'}`}
              style={{ width: `${usedPct}%` }}
              aria-hidden
            />
          </div>
          <p className="mt-1 text-[11px] text-ink-subtle">
            ₹{(remainingPaise / 100).toFixed(2)} remaining today
          </p>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="text-xs">
          {err && (
            <span className="inline-flex items-center gap-1 text-danger">
              <AlertTriangle className="size-3.5" />
              {err}
            </span>
          )}
          {!err && savedAt && Date.now() - savedAt < 5000 && (
            <span className="inline-flex items-center gap-1 text-success">
              <Check className="size-3.5" />
              Saved
            </span>
          )}
        </div>
        <Button
          type="button"
          variant="primary"
          size="sm"
          disabled={!dirty || busy}
          onClick={save}
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : 'Save'}
        </Button>
      </div>
    </div>
  );
}
