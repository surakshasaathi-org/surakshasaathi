'use client';

import { useState } from 'react';
import { AlertTriangle, ChevronDown, ChevronUp, ShieldCheck, Sparkles } from 'lucide-react';
import { cn } from '@/lib/cn';
import type { Band, PolicyScore, ScoreComponent } from '@/server/scoring';

/**
 * Readiness card — headline surface for the policy score. Shows the four
 * framings the user approved: score + band label + expected OOP % + gap count.
 * Clicking expands a drill-down table of every scored section.
 *
 * Composite "Payout health" row (decision #8) rolls up room_rent_icu +
 * sub_limits + copay into one expandable line.
 */

interface Props {
  score: PolicyScore;
}

// Band tones. `mostly_covered` = 65-84/100 — that's a healthy policy with a
// couple of friction points; rendered green (success) so users read it as
// "solid" rather than alarming. Warn + danger reserved for <65 where there
// are real gaps to act on.
const BAND_META: Record<Band, { label: string; tone: 'success' | 'primary' | 'warn' | 'danger' }> = {
  claim_ready: { label: 'Claim-ready', tone: 'success' },
  mostly_covered: { label: 'Mostly covered', tone: 'success' },
  gaps_to_close: { label: 'Gaps to close', tone: 'warn' },
  high_risk: { label: 'High risk', tone: 'danger' },
};

const PAYOUT_SLUGS = new Set(['room_rent_icu', 'sub_limits', 'copay']);

export function ReadinessCard({ score }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [payoutOpen, setPayoutOpen] = useState(false);

  const bandMeta = BAND_META[score.band];
  const pct = score.denominator > 0 ? Math.round((score.totalScore * 100) / score.denominator) : 0;

  const payoutComponents = score.components.filter((c) => PAYOUT_SLUGS.has(c.sectionSlug) && !c.missing);
  const payoutWeight = payoutComponents.reduce((n, c) => n + c.weight, 0);
  const payoutAchieved = Math.round(payoutComponents.reduce((n, c) => n + c.achieved, 0));
  const nonPayoutComponents = score.components.filter((c) => !PAYOUT_SLUGS.has(c.sectionSlug));

  return (
    <div
      className={cn(
        'rounded-3xl border-2 bg-card p-5 shadow-card sm:p-6',
        bandMeta.tone === 'success' && 'border-success/30',
        bandMeta.tone === 'primary' && 'border-primary/40',
        bandMeta.tone === 'warn' && 'border-warn/40',
        bandMeta.tone === 'danger' && 'border-danger/40',
      )}
    >
      <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
        <Sparkles className="size-3" />
        Policy readiness
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-6">
        <div>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-5xl font-semibold leading-none text-ink">{pct}</span>
            <span className="font-display text-lg text-ink-muted">/ 100</span>
          </div>
          <div
            className={cn(
              'mt-2 inline-flex items-center gap-1.5 text-sm font-semibold',
              bandMeta.tone === 'success' && 'text-success',
              bandMeta.tone === 'primary' && 'text-primary',
              bandMeta.tone === 'warn' && 'text-warn',
              bandMeta.tone === 'danger' && 'text-danger',
            )}
          >
            <span
              className={cn(
                'size-2 rounded-full',
                bandMeta.tone === 'success' && 'bg-success',
                bandMeta.tone === 'primary' && 'bg-primary',
                bandMeta.tone === 'warn' && 'bg-warn',
                bandMeta.tone === 'danger' && 'bg-danger',
              )}
            />
            {bandMeta.label}
          </div>
        </div>

        <div className="flex flex-col items-end gap-0.5 text-right">
          <div className="text-xs uppercase tracking-wider text-ink-subtle">Expected out-of-pocket</div>
          <div className="font-display text-2xl font-semibold text-ink">
            ~{score.outOfPocketPct.toFixed(1)}%
          </div>
          <div className="text-[11px] italic text-ink-subtle">on a typical ₹5L claim</div>
        </div>
      </div>

      {score.gapCount > 0 && (
        <div className="mt-4 flex items-center gap-2 text-sm">
          <AlertTriangle className="size-4 shrink-0 text-warn" />
          <span className="text-ink">
            <strong>{score.gapCount}</strong> gap{score.gapCount === 1 ? '' : 's'} to review
            {' · '}
            <a href="#risk-list" className="text-primary underline hover:text-primary-hover">
              see the list
            </a>
          </span>
        </div>
      )}

      {/* Drill-down toggle */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-ink-muted hover:text-ink"
      >
        {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
        {expanded ? 'Hide' : 'Show'} full score breakdown
      </button>

      {expanded && (
        <div className="mt-4 overflow-hidden rounded-xl border border-border/60 bg-background/40">
          <table className="w-full text-sm">
            <thead className="bg-background/60 text-left text-[10px] uppercase tracking-wider text-ink-subtle">
              <tr>
                <th className="px-4 py-2 font-medium">Section</th>
                <th className="px-4 py-2 text-right font-medium">Score</th>
                <th className="px-4 py-2 font-medium">Why</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {/* Composite "Payout health" row — collapses room + sub-limits + copay */}
              {payoutComponents.length > 0 && (
                <>
                  <tr className="bg-background/20">
                    <td className="px-4 py-2 font-semibold text-ink">
                      <button
                        type="button"
                        onClick={() => setPayoutOpen((v) => !v)}
                        className="inline-flex items-center gap-1.5"
                      >
                        {payoutOpen ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
                        Payout health
                      </button>
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-ink">
                      {payoutAchieved} / {payoutWeight}
                    </td>
                    <td className="px-4 py-2 text-xs italic text-ink-muted">
                      Room/ICU + sub-limits + co-pay combined
                    </td>
                  </tr>
                  {payoutOpen &&
                    payoutComponents.map((c) => (
                      <tr key={c.sectionSlug} className="bg-background/10">
                        <td className="px-4 py-2 pl-8 text-ink-muted">{c.sectionLabel}</td>
                        <td className="px-4 py-2 text-right font-medium text-ink">
                          {Math.round(c.achieved)} / {c.weight}
                        </td>
                        <td className="px-4 py-2 text-xs text-ink-muted">{c.reason}</td>
                      </tr>
                    ))}
                </>
              )}

              {nonPayoutComponents.map((c) => (
                <tr key={c.sectionSlug} className={c.missing ? 'opacity-60' : ''}>
                  <td className="px-4 py-2 font-medium text-ink">{c.sectionLabel}</td>
                  <td className="px-4 py-2 text-right font-medium text-ink">
                    {c.missing ? 'N/A' : `${Math.round(c.achieved)} / ${c.weight}`}
                  </td>
                  <td className="px-4 py-2 text-xs text-ink-muted">{c.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

    </div>
  );
}

export function RiskList({ components }: { components: ScoreComponent[] }) {
  const risks = components
    .filter((c) => !c.missing && ['medium', 'high', 'critical'].includes(c.severity))
    .sort((a, b) => b.weight - b.achieved - (a.weight - a.achieved));

  if (risks.length === 0) return null;

  return (
    <section id="risk-list" className="scroll-mt-24">
      <header className="mb-4">
        <h2 className="font-display text-lg font-semibold text-ink">Top gaps to review</h2>
        <p className="mt-1 text-sm text-ink-muted">
          These are the clauses costing you the most points — ranked by gap size.
        </p>
      </header>
      <ol className="space-y-3">
        {risks.map((r, i) => (
          <li
            key={r.sectionSlug}
            className={cn(
              'rounded-2xl border p-4 shadow-card',
              r.severity === 'critical' && 'border-danger/40 bg-danger/5',
              r.severity === 'high' && 'border-warn/40 bg-warn-subtle/40',
              r.severity === 'medium' && 'border-border bg-card',
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-2">
                  <span className="inline-flex size-5 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  <h3 className="font-semibold text-ink">{r.sectionLabel}</h3>
                  <SeverityChip severity={r.severity} />
                </div>
                <p className="mt-2 text-sm text-ink-muted">{r.reason}</p>
                {r.action && (
                  <p className="mt-2 text-sm text-primary">
                    <strong>Next step:</strong> {r.action.label}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="font-display text-lg font-semibold text-ink">
                  {Math.round(r.achieved)} <span className="text-ink-muted">/ {r.weight}</span>
                </div>
                <div className="text-[10px] uppercase tracking-wider text-ink-subtle">
                  {r.weight - Math.round(r.achieved)} pts lost
                </div>
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

function SeverityChip({ severity }: { severity: ScoreComponent['severity'] }) {
  const meta = {
    info: { label: 'Info', cls: 'bg-primary/10 text-primary' },
    low: { label: 'Low', cls: 'bg-primary/10 text-primary' },
    medium: { label: 'Medium', cls: 'bg-warn/20 text-warn' },
    high: { label: 'High', cls: 'bg-warn/30 text-warn' },
    critical: { label: 'Critical', cls: 'bg-danger/20 text-danger' },
  }[severity];
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
        meta.cls,
      )}
    >
      {meta.label}
    </span>
  );
}
