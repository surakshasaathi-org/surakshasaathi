import { AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

/**
 * A static, illustrative product screenshot — used inside ProductFrame on
 * marketing pages to show what a real coverage report looks like without
 * needing a live analysis row. Kept separate from the real report view so
 * marketing copy can edit freely without touching production rendering.
 */

export function MockReportCard() {
  return (
    <div className="p-6">
      {/* Header row */}
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.25em] text-primary">
            Policy analysis
          </div>
          <h3 className="mt-1 font-display text-lg font-semibold text-ink">
            Family Floater · Plus
          </h3>
          <p className="mt-0.5 text-xs text-ink-muted">
            4 members · ₹10L sum assured · renews in 42d
          </p>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
          <ShieldCheck className="size-3" />
          ready
        </span>
      </div>

      {/* Member cards row */}
      <div className="mb-4 grid grid-cols-2 gap-2">
        {[
          { rel: 'Self', age: '38', note: 'Diabetes — 24-month wait remaining' },
          { rel: 'Spouse', age: '35', note: 'Maternity covered with 9-month wait' },
          { rel: 'Son', age: '8', note: 'Fully covered' },
          { rel: 'Mother', age: '66', note: '20% copay kicks in at age 60' },
        ].map((m) => (
          <div
            key={m.rel}
            className="rounded-lg border border-border bg-background/70 p-2.5"
          >
            <div className="text-[10px] uppercase tracking-wider text-ink-subtle">
              {m.rel} · {m.age}
            </div>
            <div className="mt-1 text-[11px] leading-snug text-ink">{m.note}</div>
          </div>
        ))}
      </div>

      {/* Red flag */}
      <div className="mb-4 flex items-start gap-2 rounded-lg border-l-4 border-danger bg-danger/5 p-3">
        <AlertTriangle className="mt-0.5 size-4 flex-none text-danger" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-ink">
              Room-rent cap forces 40% deduction
            </span>
            <span className="rounded-full bg-danger/10 px-1.5 py-0.5 text-[9px] font-medium text-danger">
              high
            </span>
          </div>
          <p className="mt-0.5 text-[11px] leading-relaxed text-ink-muted">
            Single-room cap of 1% of SA means a ₹8,000/day room triggers
            proportionate deduction on ALL hospital charges.
          </p>
          <p className="mt-1 text-[11px] italic text-ink-subtle">
            (p. 12, "Room & boarding")
          </p>
        </div>
      </div>

      {/* Footer chip */}
      <div className="flex items-center justify-between border-t border-border pt-3 text-[10px] text-ink-subtle">
        <span className="inline-flex items-center gap-1">
          <CheckCircle2 className="size-3 text-success" />
          12 coverage · 8 exclusions · 4 waiting periods mapped
        </span>
        <span>24 min read</span>
      </div>
    </div>
  );
}
