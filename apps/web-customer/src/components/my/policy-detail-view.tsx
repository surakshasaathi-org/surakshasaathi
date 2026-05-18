'use client';

import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BedDouble,
  Building2,
  Calendar,
  CheckCircle2,
  FileText,
  Filter,
  MapPin,
  Phone,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Syringe,
  UserCircle2,
  XCircle,
} from 'lucide-react';
import { Badge } from '@suraksha/ui';
import { cn } from '@/lib/cn';
import type {
  ExclusionCategory,
  ExtractedExclusion,
  ExtractedSubLimit,
  ExtractedWaitingPeriod,
  SubLimitCategory,
  WaitingPeriodCategory,
} from '@/server/analyse/report-v2-types';
import type { ConditionSummary, EnrichedExtractor } from '@/server/policies/categorise';
import {
  formatWaitSpan,
  isEffectivelyUnlimited,
  isRealWaitingPeriod,
  isUnlimitedRoomRent,
} from '@/lib/policy-format';
import { LearnMore } from './learn-more';

/**
 * World-class policy detail. Overall tab = policy-wide. Member tabs =
 * everything that specifically applies to that member, called out vs.
 * policy-wide rules. Clauses grouped by clinical category (not one-card-per-
 * condition); each section has a "What's this?" explainer.
 *
 * Citations live in a collapsible block at the bottom so the body stays
 * scannable.
 */

interface Props {
  extractor: EnrichedExtractor;
  conditionSummary: ConditionSummary[];
  policyMeta: {
    sumAssuredPaise: number | null;
    premiumPaise: number | null;
  };
}

type Tab = { kind: 'overall' } | { kind: 'member'; index: number };

export function PolicyDetailView({ extractor, conditionSummary, policyMeta }: Props) {
  const members = extractor.basic_facts.members;
  const [active, setActive] = useState<Tab>({ kind: 'overall' });
  const hasMembers = members.length > 0;

  return (
    <div>
      {hasMembers && (
        <div className="sticky top-14 z-10 -mx-4 mb-8 bg-background/92 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6">
          <div className="flex gap-2 overflow-x-auto pb-1">
            <TabChip
              active={active.kind === 'overall'}
              onClick={() => setActive({ kind: 'overall' })}
              label="Overall"
              sub="Policy-wide"
              icon={<FileText className="size-3.5" />}
            />
            {members.map((m, i) => (
              <TabChip
                key={i}
                active={active.kind === 'member' && active.index === i}
                onClick={() => setActive({ kind: 'member', index: i })}
                label={humanize(m.relation) || `Member ${i + 1}`}
                sub={m.age != null ? `${m.age} yrs` : 'age —'}
                icon={<UserCircle2 className="size-3.5" />}
                badge={m.pre_existing?.length ? `${m.pre_existing.length} PED` : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {active.kind === 'overall' ? (
        <OverallPanel
          extractor={extractor}
          conditionSummary={conditionSummary}
          policyMeta={policyMeta}
        />
      ) : (
        <MemberPanel extractor={extractor} memberIndex={active.index} />
      )}

      <SourceReferences extractor={extractor} />
    </div>
  );
}

/* ───────── Tab chip ───────── */

function TabChip({
  active,
  onClick,
  label,
  sub,
  icon,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
  icon: React.ReactNode;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-sm transition',
        active
          ? 'border-primary bg-primary text-primary-foreground shadow-card'
          : 'border-border bg-card text-ink-muted hover:border-primary/40 hover:text-ink',
      )}
    >
      <span className={cn(active ? 'text-primary-foreground' : 'text-primary')}>{icon}</span>
      <span className="flex flex-col items-start leading-tight">
        <span className="font-medium">{label}</span>
        <span
          className={cn(
            'text-[10px] uppercase tracking-wider',
            active ? 'text-primary-foreground/80' : 'text-ink-subtle',
          )}
        >
          {sub}
        </span>
      </span>
      {badge && (
        <span
          className={cn(
            'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
            active ? 'bg-primary-foreground/20 text-primary-foreground' : 'bg-warn/15 text-warn',
          )}
        >
          {badge}
        </span>
      )}
    </button>
  );
}

/* ───────── Overall panel ───────── */

function OverallPanel({
  extractor,
  conditionSummary,
  policyMeta,
}: {
  extractor: EnrichedExtractor;
  conditionSummary: ConditionSummary[];
  policyMeta: { sumAssuredPaise: number | null; premiumPaise: number | null };
}) {
  const roomRent = extractor.sub_limits.find((s) => s.category === 'room_rent');
  const roomRentUnlimited = roomRent ? isUnlimitedRoomRent(roomRent.cap_text) : false;
  // Policy-wide waits only — drop ped/condition (those are member-specific).
  const policyWideWaits = extractor.waiting_periods.filter(
    (w) => w.category !== 'ped' && w.category !== 'condition',
  );
  // Policy-wide sub-limits only — drop condition-level (those are member-specific).
  const policyWideSubLimits = extractor.sub_limits.filter((s) => s.applies_to !== 'condition');
  // Copay without condition-level rows.
  const policyWideCopay = { ...extractor.copay, condition_copays: [] };
  // By-condition rows grounded in universal rules (specified-disease etc.) only.
  const policyWideConditions = conditionSummary.filter((r) => r.policyWide);
  // "Nearest wait" is the soonest-coverage heads-up. We look across ALL waits
  // (including PED/condition) because "None flagged" while member tabs have
  // real waits is misleading. When the nearest comes from a member-only rule
  // we call that out in the card sub-label.
  const nearestWait = [...extractor.waiting_periods]
    .filter((w) => w.wait_days != null && w.wait_days > 0)
    .sort((a, b) => (a.wait_days ?? 0) - (b.wait_days ?? 0))[0];
  const nearestIsMemberSpecific =
    nearestWait?.category === 'ped' || nearestWait?.category === 'condition';
  const copay = extractor.copay;

  const bf = extractor.basic_facts;
  // Detect whether the re-analyse nudge banner is warranted — anything the
  // new IA expects that the analysis doesn't carry.
  const missingSections: string[] = [];
  if (!extractor.boosters) missingSections.push('boosters');
  if (!extractor.additional_benefits || extractor.additional_benefits.length === 0)
    missingSections.push('additional benefits');
  if (!extractor.ambulance) missingSections.push('ambulance');
  if (!extractor.custom_clauses || extractor.custom_clauses.length === 0)
    missingSections.push('policy-specific clauses');

  return (
    <div className="space-y-12">
      {/* ── §1 Basics & always-applies money rules ── */}
      <BasicsPanel
        bf={bf}
        copay={copay}
        policyMeta={policyMeta}
        roomRentUnlimited={roomRentUnlimited}
        roomRent={roomRent}
      />

      {/* LEGACY at-a-glance — kept for back-compat diff; will be removed in follow-up. */}
      <section className="hidden">
        <SectionHeader
          icon={<Sparkles className="size-4 text-primary" />}
          title="At a glance"
          subtitle="The four numbers that matter most for an actual hospital bill"
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <GlanceCard
            label="Sum insured"
            value={formatRupees(policyMeta.sumAssuredPaise) ?? '—'}
            tone="primary"
          />
          <GlanceCard
            label="Room-rent cap"
            value={roomRent?.cap_text ?? 'Not declared'}
            help="room_rent"
            tone={!roomRent ? 'neutral' : roomRentUnlimited ? 'success' : 'warn'}
          />
          <GlanceCard
            label="Policy co-pay"
            value={summariseHeadlineCopay(copay)}
            help="copay"
            tone={headlineCopayTone(copay)}
          />
          <GlanceCard
            label="Nearest wait"
            value={
              nearestWait
                ? `${formatWaitSpan(nearestWait.wait_days!)} · ${titleCase(nearestWait.condition)}`
                : 'None flagged'
            }
            hint={nearestIsMemberSpecific ? 'Member-specific — see their tab' : undefined}
            help="waiting_period"
            tone={nearestWait ? 'warn' : 'neutral'}
          />
        </div>
      </section>

      {/* ── 2. By condition (cross-cut table) — policy-wide rows only. */}
      {policyWideConditions.length > 0 && (
        <section>
          <SectionHeader
            icon={<Stethoscope className="size-4 text-primary" />}
            title="By condition"
            subtitle="Waits, caps, and co-pays attached to named conditions — in one place"
          />
          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
            <table className="min-w-full text-sm">
              <thead className="bg-background/60 text-left text-[10px] uppercase tracking-[0.15em] text-ink-subtle">
                <tr>
                  <th className="px-4 py-3">Condition</th>
                  <th className="px-4 py-3">Waiting period</th>
                  <th className="px-4 py-3">Cap</th>
                  <th className="px-4 py-3">Co-pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {policyWideConditions.map((row) => (
                  <tr key={row.key}>
                    <td className="px-4 py-3 font-medium text-ink">{row.display}</td>
                    <td className="px-4 py-3 text-ink-muted">
                      {row.waitDays != null ? formatWaitSpan(row.waitDays) : '—'}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {row.caps.length > 0 ? row.caps.join(' · ') : '—'}
                    </td>
                    <td className="px-4 py-3 text-ink-muted">
                      {row.copayPercentage != null ? `${row.copayPercentage}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Room & ICU eligibility — standalone, not buried in sub-limits. ── */}
      <RoomAndIcuPanel subLimits={policyWideSubLimits} />

      {/* ── §3 Sum-insured boosters (good news) ── */}
      <BoostersPanel boosters={extractor.boosters} />

      {/* ── §2 What's covered ── */}
      {extractor.coverage_sections.length > 0 && (
        <section>
          <SectionHeader
            icon={<CheckCircle2 className="size-4 text-success" />}
            title="What's covered"
            subtitle={`${extractor.coverage_sections.length} coverage section${extractor.coverage_sections.length === 1 ? '' : 's'}`}
          />
          <ul className="grid gap-3 sm:grid-cols-2">
            {extractor.coverage_sections.map((s) => (
              <li key={s.id} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-ink">{s.name}</h3>
                  <Badge tone="neutral">{humanize(s.category)}</Badge>
                </div>
                {s.summary?.trim() && (
                  <p className="mt-2 text-sm text-ink-muted">{s.summary}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 4. Waiting periods — grouped by category (policy-wide only). */}
      <WaitingPeriodsBlock waits={policyWideWaits} />

      {/* ── 5. Sub-limits — grouped by category (policy-wide only). */}
      <SubLimitsBlock subLimits={policyWideSubLimits} />

      {/* ── 6. Co-pay — grouped by scope (policy-wide only). */}
      <CopayBlock copay={policyWideCopay} />

      {/* ── §7 Exclusions — filterable ── */}
      <ExclusionsBlock exclusions={extractor.exclusions} />

      {/* ── §8 Additional benefits (health check-up, OPD, teleconsult, AYUSH, daily cash, etc.) + ambulance + maternity ── */}
      <AdditionalBenefitsPanel
        benefits={extractor.additional_benefits}
        ambulance={extractor.ambulance}
        maternity={extractor.maternity}
      />

      {/* ── §9a Policy-specific clauses (catch-all for insurer idiosyncrasies) ── */}
      <CustomClausesPanel clauses={extractor.custom_clauses} />

      {/* ── §9 Riders ── */}
      {extractor.riders.length > 0 && (
        <section>
          <SectionHeader
            icon={<Sparkles className="size-4 text-accent" />}
            title="Riders (add-on covers)"
            subtitle="Optional bolt-ons you paid extra for — or that came bundled with this plan."
            help="riders"
          />
          <ul className="grid gap-3 sm:grid-cols-2">
            {extractor.riders.map((r, i) => (
              <li key={i} className="rounded-2xl border border-border bg-card p-4 shadow-card">
                <div className="text-sm font-semibold text-ink">{r.name}</div>
                {r.summary?.trim() && (
                  <p className="mt-1 text-sm text-ink-muted">{r.summary}</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── 9. Renewal & portability ── */}
      {(extractor.renewal_and_portability.renewal_clause ||
        extractor.renewal_and_portability.portability_clause) && (
        <section>
          <SectionHeader icon={<Calendar className="size-4 text-primary" />} title="Renewal & portability" />
          <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-card">
            {extractor.renewal_and_portability.renewal_clause && (
              <div>
                <div className="text-xs uppercase tracking-wider text-ink-subtle">Renewal</div>
                <p className="mt-1 text-sm text-ink">
                  {extractor.renewal_and_portability.renewal_clause}
                </p>
              </div>
            )}
            {extractor.renewal_and_portability.portability_clause && (
              <div>
                <div className="text-xs uppercase tracking-wider text-ink-subtle">Portability</div>
                <p className="mt-1 text-sm text-ink">
                  {extractor.renewal_and_portability.portability_clause}
                </p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── 10. Grievance contacts ── */}
      {(extractor.grievance_contacts.insurer_grievance ||
        extractor.grievance_contacts.ombudsman ||
        extractor.grievance_contacts.tpa) && (
        <section>
          <SectionHeader
            icon={<Phone className="size-4 text-primary" />}
            title="Grievance contacts"
            subtitle="If something goes wrong, these are the people to call"
          />
          <dl className="rounded-2xl border border-border bg-card p-5 shadow-card">
            {extractor.grievance_contacts.insurer_grievance && (
              <DetailRow label="Insurer grievance" value={extractor.grievance_contacts.insurer_grievance} />
            )}
            {extractor.grievance_contacts.ombudsman && (
              <DetailRow label="Ombudsman" value={extractor.grievance_contacts.ombudsman} />
            )}
            {extractor.grievance_contacts.tpa && (
              <DetailRow label="TPA" value={extractor.grievance_contacts.tpa} />
            )}
          </dl>
        </section>
      )}

      {/* ── Re-analyse nudge for legacy analyses missing the new blocks ── */}
      {missingSections.length > 0 && <ReAnalyseNudge missingSections={missingSections} />}
    </div>
  );
}

/* ───────── Waiting periods (grouped) ───────── */

const WAIT_GROUPS: Array<{
  key: WaitingPeriodCategory;
  title: string;
  help: keyof typeof import('./policy-glossary').GLOSSARY;
  subtitle: string;
}> = [
  { key: 'initial', title: 'Initial waiting period', help: 'initial_wait', subtitle: 'First 30 days after buying — only accidents admissible.' },
  { key: 'ped', title: 'Pre-existing diseases', help: 'ped_wait', subtitle: 'Conditions you declared when you bought — applied only to those members.' },
  { key: 'specified_disease', title: 'Specified diseases', help: 'specified_disease_wait', subtitle: 'A named list of planned procedures — applies to every member, healthy or not.' },
  { key: 'maternity', title: 'Maternity & newborn', help: 'maternity_wait', subtitle: 'Delivery, newborn, and maternity-related benefits.' },
  { key: 'condition', title: 'Condition-specific waits', help: 'waiting_period', subtitle: 'Other condition-named waiting periods in this policy.' },
  { key: 'other', title: 'Other waits', help: 'waiting_period', subtitle: 'Waits that don\'t fit the standard buckets above.' },
];

function WaitingPeriodsBlock({ waits }: { waits: ExtractedWaitingPeriod[] }) {
  // LLMs occasionally emit co-pays, exclusions, or "no wait applies" notes
  // into the waiting_periods array. A real waiting period must have a
  // positive wait_days — drop the rest so the UI only shows clauses that
  // actually delay a claim.
  const realWaits = waits.filter((w) => isRealWaitingPeriod(w.wait_days));
  if (realWaits.length === 0) return null;
  const byCat = groupByCategory(realWaits, (w) => (w.category ?? 'other') as WaitingPeriodCategory);
  return (
    <section>
      <SectionHeader
        icon={<Calendar className="size-4 text-warn" />}
        title="Waiting periods"
        subtitle="Claims that only kick in after a delay — grouped by type"
        help="waiting_period"
      />
      <div className="space-y-4">
        {WAIT_GROUPS.map((g) => {
          const items = byCat.get(g.key);
          if (!items || items.length === 0) return null;
          return (
            <WaitGroup
              key={g.key}
              title={g.title}
              subtitle={g.subtitle}
              helpKey={g.help}
              items={items}
            />
          );
        })}
      </div>
    </section>
  );
}

function WaitGroup({
  title,
  subtitle,
  helpKey,
  items,
}: {
  title: string;
  subtitle: string;
  helpKey: keyof typeof import('./policy-glossary').GLOSSARY;
  items: ExtractedWaitingPeriod[];
}) {
  return (
    <div className="rounded-2xl border-l-4 border-warn/70 bg-warn-subtle/40 p-5">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
          <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
        </div>
        <LearnMore termKey={helpKey} />
      </div>
      <ul className="divide-y divide-warn/10 rounded-xl bg-card/60">
        {items.map((w) => (
          <li key={w.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
            <span className="text-sm font-medium capitalize text-ink">{w.condition}</span>
            {w.wait_days != null && <Badge tone="warn">{formatWaitSpan(w.wait_days)}</Badge>}
            {w.notes && !isRedundantWaitNote(w.notes) && (
              <span className="text-xs text-ink-muted">{w.notes}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────── Room & ICU (standalone section, NOT part of sub-limits) ─────────
 *
 * Room-rent is formally a sub-limit but operationally it's the #1 out-of-
 * pocket surprise in Indian health claims (proportionate-deduction trap).
 * It gets its own top-level section rather than being buried in the
 * sub-limits grid, and ICU cap rides along with it since the two share the
 * same "daily bed charge" mental model.
 */
function RoomAndIcuPanel({ subLimits }: { subLimits: ExtractedSubLimit[] }) {
  const roomRents = subLimits.filter((s) => s.category === 'room_rent');
  const icuCaps = subLimits.filter((s) => s.category === 'icu');
  if (roomRents.length === 0 && icuCaps.length === 0) return null;

  const allUnlimited =
    roomRents.length > 0 && roomRents.every((r) => isUnlimitedRoomRent(r.cap_text));
  const tone: 'success' | 'danger' | 'warn' =
    roomRents.length === 0 ? 'warn' : allUnlimited ? 'success' : 'danger';

  return (
    <section>
      <SectionHeader
        icon={<BedDouble className={cn('size-4', tone === 'success' ? 'text-success' : tone === 'danger' ? 'text-danger' : 'text-warn')} />}
        title="Room & ICU eligibility"
        subtitle="Which hospital room and ICU you can use — and the proportionate-deduction rule behind it"
        help="room_rent"
      />

      {/* Room-rent hero — green/reassuring if unlimited, red/warning if capped. */}
      {roomRents.length > 0 && (
        <div
          className={cn(
            'rounded-2xl border-2 p-5',
            tone === 'success' && 'border-success/30 bg-success/5',
            tone === 'danger' && 'border-danger/30 bg-danger/5',
          )}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div
                className={cn(
                  'rounded-lg p-2',
                  tone === 'success' && 'bg-success/10 text-success',
                  tone === 'danger' && 'bg-danger/10 text-danger',
                )}
              >
                <BedDouble className="size-5" />
              </div>
              <div>
                <h3 className="font-display text-base font-semibold text-ink">
                  Room rent {allUnlimited ? '(no cap — any room)' : `cap${roomRents.length > 1 ? 's' : ''}`}
                </h3>
                <p className="mt-1 max-w-prose text-xs text-ink-muted">
                  {allUnlimited ? (
                    <>
                      Good news — this policy doesn't restrict which hospital room you can choose.
                      No proportionate-deduction trap.
                    </>
                  ) : (
                    <>
                      If your actual room charge exceeds this cap, the insurer applies a{' '}
                      <strong className="text-ink">proportionate deduction</strong> to ALL other
                      hospital charges — not just the room.
                    </>
                  )}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <LearnMore termKey="room_rent" label="What this means" />
              {!allUnlimited && (
                <LearnMore termKey="room_rent_proportion" label="How deduction works" />
              )}
            </div>
          </div>
          <ul className="mt-4 space-y-2">
            {roomRents.map((r) => (
              <li
                key={r.id}
                className={cn(
                  'rounded-lg border bg-card/80 p-3 text-sm text-ink',
                  tone === 'success' && 'border-success/20',
                  tone === 'danger' && 'border-danger/20',
                )}
              >
                <div className="font-medium">{r.name}</div>
                <div className="mt-0.5 text-ink-muted">{r.cap_text}</div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ICU daily cap — sits alongside room-rent because the mental model matches. */}
      {icuCaps.length > 0 && (
        <div className="mt-3 rounded-2xl border border-warn/30 bg-warn-subtle/40 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              <BedDouble className="size-4 text-warn" />
              <div>
                <h3 className="font-display text-sm font-semibold text-ink">ICU daily cap</h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Daily ICU charge is capped separately — often 2× the regular room cap.
                </p>
              </div>
            </div>
            <LearnMore termKey="icu_cap" iconOnly />
          </div>
          <ul className="mt-3 divide-y divide-warn/10 rounded-lg bg-card/60">
            {icuCaps.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2.5">
                <span className="text-sm font-medium text-ink">{s.name}</span>
                <span className="text-sm text-ink-muted">{s.cap_text}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

/* ───────── Sub-limits (grouped; excludes room_rent + icu — those are in RoomAndIcuPanel) ───────── */

function SubLimitsBlock({ subLimits }: { subLimits: ExtractedSubLimit[] }) {
  // Filter:
  //   - Room-rent + ICU (own section in RoomAndIcuPanel above).
  //   - Effectively-unlimited entries: "Covered up to sum insured",
  //     "No sub-limit", "At actuals" etc. These aren't caps — showing them
  //     under "Sub-limits" is misleading and implies a constraint that
  //     doesn't exist.
  const filtered = subLimits.filter(
    (s) =>
      s.category !== 'room_rent' &&
      s.category !== 'icu' &&
      !isEffectivelyUnlimited(s.cap_text),
  );
  if (filtered.length === 0) return null;
  const byCat = groupByCategory(filtered, (s) => (s.category ?? 'other') as SubLimitCategory);
  const procedures = byCat.get('procedure') ?? [];
  const diseaseSublimits = byCat.get('disease_sublimit') ?? [];
  const modern = byCat.get('modern_treatment') ?? [];
  const ancillary = byCat.get('ancillary') ?? [];
  const other = byCat.get('other') ?? [];

  return (
    <section>
      <SectionHeader
        icon={<Syringe className="size-4 text-warn" />}
        title="Sub-limits"
        subtitle="Per-procedure, per-disease, and ancillary caps inside your sum insured"
        help="sub_limits"
      />

      <div className="grid gap-4 lg:grid-cols-2">

        {procedures.length > 0 && (
          <SubLimitGroup
            icon={<Syringe className="size-4 text-warn" />}
            title="Procedure caps"
            subtitle="Per-procedure rupee ceilings (cataract, hernia, knee replacement, etc.)"
            helpKey="procedure_caps"
            items={procedures}
          />
        )}
        {diseaseSublimits.length > 0 && (
          <SubLimitGroup
            icon={<Stethoscope className="size-4 text-warn" />}
            title="Disease-level caps"
            subtitle="Total spending ceiling for a named disease, across every related procedure."
            helpKey="disease_sublimit"
            items={diseaseSublimits}
          />
        )}
        {modern.length > 0 && (
          <SubLimitGroup
            icon={<Sparkles className="size-4 text-warn" />}
            title="Modern treatments"
            subtitle="The IRDAI-mandated list of 12 advanced treatments — usually sub-limited."
            helpKey="modern_treatment"
            items={modern}
          />
        )}
        {ancillary.length > 0 && (
          <SubLimitGroup
            icon={<Building2 className="size-4 text-warn" />}
            title="Ancillary"
            subtitle="Pre- and post-hospitalisation, day-care, domiciliary, nursing allowance."
            helpKey="ancillary"
            items={ancillary}
          />
        )}
        {other.length > 0 && (
          <SubLimitGroup
            icon={<AlertTriangle className="size-4 text-warn" />}
            title="Other sub-limits"
            subtitle="Clauses that don't fit the standard buckets above."
            helpKey="sub_limits"
            items={other}
          />
        )}
      </div>
    </section>
  );
}

function SubLimitGroup({
  icon,
  title,
  subtitle,
  helpKey,
  items,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  helpKey: keyof typeof import('./policy-glossary').GLOSSARY;
  items: ExtractedSubLimit[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {icon}
          <div>
            <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
            <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>
          </div>
        </div>
        <LearnMore termKey={helpKey} iconOnly />
      </div>
      <ul className="divide-y divide-border/50">
        {items.map((s) => (
          <li key={s.id} className="py-2.5 first:pt-0 last:pb-0">
            <div className="text-sm font-medium text-ink">{s.name}</div>
            <div className="mt-0.5 text-sm text-ink-muted">{s.cap_text}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ───────── Co-pay — grouped by scope ───────── */

function CopayBlock({
  copay,
  scope = 'overall',
}: {
  copay: EnrichedExtractor['copay'];
  /** overall scope drops the always-applies tier (moved to BasicsPanel).
   *  member scope keeps it (for the rare member-only detail view). */
  scope?: 'overall' | 'member';
}) {
  const alwaysApplies: Array<{ label: string; value: string; help: keyof typeof import('./policy-glossary').GLOSSARY }> = [];
  // In 'overall' scope we skip these — they're rendered in the top Basics band.
  if (scope !== 'overall' && copay.voluntary_percentage != null)
    alwaysApplies.push({ label: 'Voluntary co-pay', value: `${copay.voluntary_percentage}%`, help: 'copay' });
  if (scope !== 'overall' && copay.mandatory_percentage != null)
    alwaysApplies.push({ label: 'Mandatory co-pay', value: `${copay.mandatory_percentage}%`, help: 'copay' });
  if (scope !== 'overall' && copay.deductible_rupees != null)
    alwaysApplies.push({ label: 'Deductible', value: formatRupees(copay.deductible_rupees) ?? '—', help: 'deductible' });

  const circumstantial: Array<{ label: string; value: string; help: keyof typeof import('./policy-glossary').GLOSSARY; hint: string }> = [];
  if (copay.age_triggered) {
    circumstantial.push({
      label: 'Age-triggered',
      value: `${copay.age_triggered.percentage}%`,
      hint: `From age ${copay.age_triggered.from_age}`,
      help: 'copay',
    });
  }
  if (copay.non_network_percentage != null) {
    circumstantial.push({
      label: 'Non-network hospital',
      value: `${copay.non_network_percentage}%`,
      hint: 'Kicks in at hospitals outside the insurer\'s network',
      help: 'non_network_copay',
    });
  }
  if (copay.zone_based) {
    circumstantial.push({
      label: 'Zone-based',
      value: copay.zone_based.zones?.length
        ? `${copay.zone_based.zones.length} zone${copay.zone_based.zones.length === 1 ? '' : 's'}`
        : 'Configured',
      hint: copay.zone_based.description,
      help: 'zone_copay',
    });
  }

  const conditionCopays = copay.condition_copays ?? [];

  const hasAny =
    alwaysApplies.length > 0 ||
    circumstantial.length > 0 ||
    conditionCopays.length > 0 ||
    copay.explanation;
  if (!hasAny) return null;

  return (
    <section>
      <SectionHeader
        icon={<ShieldCheck className="size-4 text-primary" />}
        title="Co-pay & deductible"
        subtitle="Your share of every admissible claim — grouped by when each rule kicks in"
        help="copay"
      />

      <div className="space-y-4">
        {alwaysApplies.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-sm font-semibold text-ink">Policy-level — always applies</h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  These reduce every admissible claim, regardless of hospital or condition.
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-1 sm:grid-cols-2">
              {alwaysApplies.map((r) => (
                <CopayRow key={r.label} {...r} />
              ))}
            </dl>
          </div>
        )}

        {circumstantial.length > 0 && (
          <div className="rounded-2xl border border-warn/30 bg-warn-subtle/40 p-5">
            <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-display text-sm font-semibold text-ink">
                  Policy-level — applies under specific circumstances
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  These only kick in for certain members, zones, or hospitals.
                </p>
              </div>
            </div>
            <ul className="space-y-2">
              {circumstantial.map((r) => (
                <li
                  key={r.label}
                  className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-warn/15 bg-card/80 px-3 py-2.5"
                >
                  <div className="min-w-0 flex-1">
                    <div className="inline-flex items-center gap-2">
                      <span className="text-sm font-medium text-ink">{r.label}</span>
                      <Badge tone="warn">{r.value}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-ink-muted">{r.hint}</p>
                  </div>
                  <LearnMore termKey={r.help} iconOnly />
                </li>
              ))}
            </ul>
          </div>
        )}

        {conditionCopays.length > 0 && (
          <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
            <div className="mb-3 flex items-start gap-2">
              <Stethoscope className="size-4 text-primary" />
              <div>
                <h3 className="font-display text-sm font-semibold text-ink">
                  Condition- or treatment-specific
                </h3>
                <p className="mt-0.5 text-xs text-ink-muted">
                  Co-pay rules that only apply when being treated for a named condition.
                </p>
              </div>
            </div>
            <ul className="divide-y divide-border/50">
              {conditionCopays.map((c, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                  <span className="text-sm font-medium capitalize text-ink">
                    {c.condition_or_treatment}
                  </span>
                  <Badge tone="primary">{c.percentage}%</Badge>
                  {c.notes && <span className="text-xs text-ink-muted">{c.notes}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        {copay.explanation && (
          <p className="max-w-prose text-sm text-ink-muted">{copay.explanation}</p>
        )}
      </div>
    </section>
  );
}

function CopayRow({
  label,
  value,
  help,
}: {
  label: string;
  value: string;
  help: keyof typeof import('./policy-glossary').GLOSSARY;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border/40 py-2 last:border-0">
      <div className="inline-flex items-center gap-2">
        <span className="text-sm text-ink-muted">{label}</span>
        <LearnMore termKey={help} iconOnly />
      </div>
      <span className="text-sm font-medium text-ink">{value}</span>
    </div>
  );
}

/* ───────── Exclusions ───────── */

const EXCLUSION_GROUPS: Array<{ key: ExclusionCategory; label: string; short: string }> = [
  { key: 'permanent', label: 'Permanent', short: 'war, nuclear, cosmetic' },
  { key: 'treatments', label: 'Treatments', short: 'AYUSH, experimental' },
  { key: 'conditions', label: 'Conditions', short: 'dental, eye, non-allopathic' },
  { key: 'behavioural', label: 'Behavioural', short: 'intoxication, self-harm' },
  { key: 'admin', label: 'Administrative', short: 'fraud, non-disclosure' },
  { key: 'other', label: 'Other', short: 'misc' },
];

function ExclusionsBlock({ exclusions }: { exclusions: ExtractedExclusion[] }) {
  const [activeFilter, setActiveFilter] = useState<ExclusionCategory | 'all'>('all');
  if (exclusions.length === 0) return null;
  const byCat = groupByCategory(exclusions, (e) => (e.category ?? 'other') as ExclusionCategory);

  const filtered = activeFilter === 'all' ? exclusions : exclusions.filter((e) => (e.category ?? 'other') === activeFilter);

  return (
    <section>
      <SectionHeader
        icon={<XCircle className="size-4 text-danger" />}
        title="Not covered"
        subtitle={`${exclusions.length} exclusion${exclusions.length === 1 ? '' : 's'} — filter to see what's grouped under each.`}
        help="exclusions"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Filter className="size-3.5 text-ink-subtle" aria-hidden />
        <FilterChip
          active={activeFilter === 'all'}
          onClick={() => setActiveFilter('all')}
          label={`All ${exclusions.length}`}
        />
        {EXCLUSION_GROUPS.map((g) => {
          const count = byCat.get(g.key)?.length ?? 0;
          if (count === 0) return null;
          return (
            <FilterChip
              key={g.key}
              active={activeFilter === g.key}
              onClick={() => setActiveFilter(g.key)}
              label={`${g.label} · ${count}`}
              title={g.short}
            />
          );
        })}
      </div>

      <ul className="space-y-2">
        {filtered.map((e) => (
          <li
            key={e.id}
            className="rounded-xl border-l-4 border-danger/60 bg-danger/5 p-4"
          >
            <p className="text-sm text-ink">{e.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  title,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'rounded-full border px-3 py-1 text-xs font-medium transition',
        active
          ? 'border-danger bg-danger/10 text-danger'
          : 'border-border bg-card text-ink-muted hover:border-danger/40 hover:text-ink',
      )}
    >
      {label}
    </button>
  );
}

/* ───────── Per-member panel ───────── */

function MemberPanel({
  extractor,
  memberIndex,
}: {
  extractor: EnrichedExtractor;
  memberIndex: number;
}) {
  const m = extractor.basic_facts.members[memberIndex];
  if (!m) return null;
  const peds = (m.pre_existing ?? []).map((p) => p.trim()).filter(Boolean);

  // Waits relevant to THIS member (intersect with their PEDs for PED/condition,
  // include all specified_disease because they apply universally).
  const relevantPedWaits = useMemo(
    () =>
      extractor.waiting_periods.filter(
        (w) =>
          (w.category === 'ped' || w.category === 'condition') &&
          peds.some((p) => {
            const pLower = p.toLowerCase();
            const cLower = w.condition.toLowerCase();
            return cLower.includes(pLower) || pLower.includes(cLower);
          }),
      ),
    [extractor.waiting_periods, peds],
  );
  const universalSpecifiedDisease = useMemo(
    () => extractor.waiting_periods.filter((w) => w.category === 'specified_disease'),
    [extractor.waiting_periods],
  );

  // Condition-copays that match this member's PEDs.
  const relevantConditionCopays = useMemo(() => {
    const list = extractor.copay.condition_copays ?? [];
    return list.filter((c) => {
      const t = c.condition_or_treatment.toLowerCase();
      return peds.some((p) => t.includes(p.toLowerCase()) || p.toLowerCase().includes(t));
    });
  }, [extractor.copay.condition_copays, peds]);

  // Procedure/condition sub-limits matching member's PEDs.
  const relevantConditionSubLimits = useMemo(
    () =>
      extractor.sub_limits.filter(
        (s) =>
          s.applies_to === 'condition' &&
          peds.some((p) => {
            const name = (s.condition ?? s.name).toLowerCase();
            return name.includes(p.toLowerCase()) || p.toLowerCase().includes(name);
          }),
      ),
    [extractor.sub_limits, peds],
  );

  // Age-triggered copay qualification.
  const ageCopay =
    extractor.copay.age_triggered && m.age != null && m.age >= extractor.copay.age_triggered.from_age
      ? extractor.copay.age_triggered
      : null;

  // Room-rent callout (policy-wide, but every member should see it).
  const roomRent = extractor.sub_limits.find((s) => s.category === 'room_rent');

  return (
    <div className="space-y-10">
      {/* Member hero */}
      <div className="rounded-3xl border border-border bg-card p-6 shadow-card sm:p-7">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
            <UserCircle2 className="size-7" />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="font-display text-2xl font-semibold text-ink">
              {humanize(m.relation) || `Member ${memberIndex + 1}`}
            </h2>
            <p className="text-sm text-ink-muted">
              {m.age != null ? `${m.age} years` : 'Age not on schedule'}
              {peds.length > 0 ? ` · ${peds.length} pre-existing condition${peds.length === 1 ? '' : 's'}` : ''}
            </p>
          </div>
        </div>
        {peds.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {peds.map((p) => (
              <Badge key={p} tone="warn">
                {p}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Member-specific from PEDs */}
      <MemberSection
        title="Member-specific — from their declared conditions"
        subtitle={
          peds.length === 0
            ? 'No pre-existing conditions declared, so no member-specific clauses apply.'
            : 'These apply because of what was declared on the policy schedule.'
        }
      >
        {relevantPedWaits.length > 0 && (
          <MemberBucket
            icon={<Calendar className="size-4 text-warn" />}
            title="Waiting periods for their conditions"
            subtitle={(() => {
              const first = relevantPedWaits[0];
              if (first?.wait_days != null && relevantPedWaits.every((w) => w.wait_days === first.wait_days)) {
                return `A ${formatWaitSpan(first.wait_days)} wait applies to each of these, from the policy start date.`;
              }
              return 'These conditions each carry their own wait, applied from the policy start date.';
            })()}
            help="ped_wait"
          >
            <ul className="divide-y divide-border/40">
              {relevantPedWaits.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                  <span className="text-sm font-medium capitalize text-ink">{w.condition}</span>
                  {w.wait_days != null && <Badge tone="warn">{formatWaitSpan(w.wait_days)}</Badge>}
                  {w.notes && !isRedundantWaitNote(w.notes) && (
                    <span className="text-xs text-ink-muted">{w.notes}</span>
                  )}
                </li>
              ))}
            </ul>
          </MemberBucket>
        )}
        {relevantConditionSubLimits.length > 0 && (
          <MemberBucket
            icon={<Syringe className="size-4 text-warn" />}
            title="Procedure/treatment caps for their conditions"
            help="procedure_caps"
          >
            <ul className="divide-y divide-border/40">
              {relevantConditionSubLimits.map((s) => (
                <li key={s.id} className="py-2.5">
                  <div className="text-sm font-medium text-ink">{s.name}</div>
                  <div className="mt-0.5 text-sm text-ink-muted">{s.cap_text}</div>
                </li>
              ))}
            </ul>
          </MemberBucket>
        )}
        {relevantConditionCopays.length > 0 && (
          <MemberBucket
            icon={<ShieldCheck className="size-4 text-warn" />}
            title="Condition co-pay for their conditions"
            help="copay"
          >
            <ul className="divide-y divide-border/40">
              {relevantConditionCopays.map((c, i) => (
                <li key={i} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                  <span className="text-sm font-medium capitalize text-ink">
                    {c.condition_or_treatment}
                  </span>
                  <Badge tone="warn">{c.percentage}%</Badge>
                  {c.notes && <span className="text-xs text-ink-muted">{c.notes}</span>}
                </li>
              ))}
            </ul>
          </MemberBucket>
        )}
        {relevantPedWaits.length === 0 &&
          relevantConditionSubLimits.length === 0 &&
          relevantConditionCopays.length === 0 && (
            <EmptyBucket>
              No member-specific clauses match this member's declared conditions. The policy-wide
              rules below still apply.
            </EmptyBucket>
          )}
      </MemberSection>

      {/* In addition to policy-level — call out clearly */}
      <MemberSection
        title="In addition to policy-level — also applies to them"
        subtitle="These are policy-wide rules that affect this member specifically."
      >
        {ageCopay && (
          <MemberBucket
            icon={<ShieldCheck className="size-4 text-primary" />}
            title={`Age-triggered co-pay (aged ${extractor.copay.age_triggered?.from_age}+)`}
            help="copay"
            tag="Applies to this member"
          >
            <div className="rounded-lg border border-warn/30 bg-warn-subtle/40 p-3 text-sm text-ink">
              A <strong>{ageCopay.percentage}%</strong> co-pay on every admissible claim, because
              this member is <strong>{m.age}</strong>.
            </div>
          </MemberBucket>
        )}

        {universalSpecifiedDisease.length > 0 && (
          <MemberBucket
            icon={<Calendar className="size-4 text-primary" />}
            title="Specified-disease waits (every member, healthy or not)"
            help="specified_disease_wait"
            tag="Same as every member"
          >
            <ul className="divide-y divide-border/40">
              {universalSpecifiedDisease.map((w) => (
                <li key={w.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2.5">
                  <span className="text-sm font-medium capitalize text-ink">{w.condition}</span>
                  {w.wait_days != null && <Badge tone="warn">{formatWaitSpan(w.wait_days)}</Badge>}
                </li>
              ))}
            </ul>
          </MemberBucket>
        )}

        {roomRent && (() => {
          const unlimited = isUnlimitedRoomRent(roomRent.cap_text);
          return (
            <MemberBucket
              icon={<BedDouble className={cn('size-4', unlimited ? 'text-success' : 'text-primary')} />}
              title={unlimited ? 'Room choice is open for this member' : 'Room-rent cap affects this member too'}
              help="room_rent"
              tag={unlimited ? 'Policy-wide · good news' : 'Policy-wide · applies here'}
            >
              <div
                className={cn(
                  'rounded-lg border p-3 text-sm text-ink',
                  unlimited ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5',
                )}
              >
                <div className="font-medium">{roomRent.name}</div>
                <div className="mt-0.5 text-ink-muted">{roomRent.cap_text}</div>
                <p className="mt-2 text-xs text-ink-muted">
                  {unlimited
                    ? 'No room-rent restriction, so no proportionate deduction trap for this member.'
                    : "If the member's actual room rent exceeds this cap, proportionate deduction applies to every other charge too."}
                </p>
              </div>
            </MemberBucket>
          );
        })()}
      </MemberSection>
    </div>
  );
}

function MemberSection({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <header className="mb-4">
        <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
        <p className="mt-1 max-w-prose text-sm text-ink-muted">{subtitle}</p>
      </header>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function MemberBucket({
  icon,
  title,
  subtitle,
  help,
  tag,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  help: keyof typeof import('./policy-glossary').GLOSSARY;
  tag?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-5 shadow-card">
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          {icon}
          <div>
            <h4 className="font-display text-sm font-semibold text-ink">{title}</h4>
            {subtitle && <p className="mt-0.5 max-w-prose text-xs text-ink-muted">{subtitle}</p>}
            {tag && (
              <span className="mt-1 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
                {tag}
              </span>
            )}
          </div>
        </div>
        <LearnMore termKey={help} iconOnly />
      </div>
      {children}
    </div>
  );
}

function EmptyBucket({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-background/40 p-4 text-sm text-ink-muted">
      {children}
    </div>
  );
}

/* ───────── Shared primitives ───────── */

function SectionHeader({
  icon,
  title,
  subtitle,
  help,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  help?: keyof typeof import('./policy-glossary').GLOSSARY;
}) {
  return (
    <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-start gap-2">
        <span className="mt-0.5">{icon}</span>
        <div>
          <h2 className="font-display text-base font-semibold text-ink">{title}</h2>
          {subtitle && <p className="mt-0.5 max-w-prose text-xs text-ink-muted">{subtitle}</p>}
        </div>
      </div>
      {help && <LearnMore termKey={help} />}
    </header>
  );
}

function GlanceCard({
  label,
  value,
  hint,
  help,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  help?: keyof typeof import('./policy-glossary').GLOSSARY;
  tone: 'primary' | 'warn' | 'neutral' | 'success';
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border p-4 shadow-card',
        tone === 'primary' && 'border-primary/30 bg-primary/5',
        tone === 'warn' && 'border-warn/40 bg-warn-subtle/40',
        tone === 'success' && 'border-success/30 bg-success/5',
        tone === 'neutral' && 'border-border bg-card',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
          {label}
        </div>
        {help && <LearnMore termKey={help} iconOnly />}
      </div>
      <div className="mt-2 font-display text-xl font-semibold leading-tight text-ink">{value}</div>
      {hint && <div className="mt-1 text-[11px] italic text-ink-subtle">{hint}</div>}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/40 py-2 text-sm last:border-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

/* ───────── Source references ───────── */

function SourceReferences({ extractor }: { extractor: EnrichedExtractor }) {
  const groups: Array<{ title: string; items: Array<{ label: string; page: number; section: string }> }> = [
    {
      title: 'Coverage sections',
      items: extractor.coverage_sections.map((s) => ({
        label: s.name,
        page: s.citation.page,
        section: s.citation.section_label,
      })),
    },
    {
      title: 'Exclusions',
      items: extractor.exclusions.map((e) => ({
        label: truncate(e.text, 60),
        page: e.citation.page,
        section: e.citation.section_label,
      })),
    },
    {
      title: 'Waiting periods',
      items: extractor.waiting_periods.map((w) => ({
        label: w.condition,
        page: w.citation.page,
        section: w.citation.section_label,
      })),
    },
    {
      title: 'Sub-limits',
      items: extractor.sub_limits.map((s) => ({
        label: s.name,
        page: s.citation.page,
        section: s.citation.section_label,
      })),
    },
    {
      title: 'Riders',
      items: extractor.riders.map((r) => ({
        label: r.name,
        page: r.citation.page,
        section: r.citation.section_label,
      })),
    },
  ].filter((g) => g.items.length > 0);

  if (groups.length === 0) return null;
  const total = groups.reduce((n, g) => n + g.items.length, 0);

  return (
    <details className="group mt-12 rounded-2xl border border-border/60 bg-background/40 open:bg-background/60">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 text-sm font-medium text-ink transition hover:bg-primary/5">
        <span className="inline-flex items-center gap-2">
          <FileText className="size-4 text-primary" aria-hidden />
          View source references
          <span className="text-xs text-ink-subtle">({total} citations in the policy PDF)</span>
        </span>
        <span className="text-lg leading-none transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="space-y-5 border-t border-border/60 p-5">
        {groups.map((g) => (
          <div key={g.title}>
            <h3 className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-ink-muted">
              {g.title}
            </h3>
            <ul className="space-y-1 text-sm text-ink-muted">
              {g.items.map((it, i) => (
                <li
                  key={i}
                  className="flex items-start justify-between gap-3 border-b border-border/40 pb-1.5 last:border-0"
                >
                  <span className="min-w-0 flex-1 text-ink">{it.label}</span>
                  <span className="shrink-0 text-xs italic">
                    p. {it.page}
                    {it.section ? ` · ${it.section}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </details>
  );
}

/* ───────── §1 Basics & money rules band ───────── */

function BasicsPanel({
  bf,
  copay,
  policyMeta,
  roomRentUnlimited,
  roomRent,
}: {
  bf: EnrichedExtractor['basic_facts'];
  copay: EnrichedExtractor['copay'];
  policyMeta: { sumAssuredPaise: number | null; premiumPaise: number | null };
  roomRentUnlimited: boolean;
  roomRent: ExtractedSubLimit | undefined;
}) {
  // Family-type + member count for a human label.
  const memberCount = bf.members?.length ?? 0;
  const familyLabel = (() => {
    const ft = (bf as unknown as { family_type?: string }).family_type;
    if (ft === 'floater') return `Floater${memberCount > 0 ? ` · ${memberCount} ${memberCount === 1 ? 'member' : 'members'}` : ''}`;
    if (ft === 'individual') return 'Individual';
    if (ft === 'group') return 'Group';
    return humanize(ft ?? null) ?? '—';
  })();
  const planLabel = (() => {
    const pt = (bf as unknown as { plan_type?: string }).plan_type;
    if (pt === 'base') return 'Base';
    if (pt === 'super_topup') return 'Super top-up';
    if (pt === 'topup') return 'Top-up';
    return humanize(pt ?? null) ?? '—';
  })();
  const deductibleRupees = (bf as unknown as { deductible_rupees?: number | null }).deductible_rupees
    ?? null;

  return (
    <section>
      <SectionHeader
        icon={<Sparkles className="size-4 text-primary" />}
        title="Policy basics & money rules"
        subtitle="The numbers that shape every claim, before any condition-specific rule kicks in"
      />
      {/* Row 1 — money floor */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <GlanceCard
          label="Sum insured"
          value={formatRupees(policyMeta.sumAssuredPaise) ?? 'Not extracted'}
          tone="primary"
        />
        <GlanceCard
          label="Deductible"
          value={formatRupees(deductibleRupees) ?? 'None'}
          help="super_topup"
          tone={deductibleRupees ? 'warn' : 'neutral'}
        />
        <GlanceCard
          label="Mandatory co-pay"
          value={copay.mandatory_percentage != null ? `${copay.mandatory_percentage}%` : 'None'}
          help="copay"
          tone={copay.mandatory_percentage && copay.mandatory_percentage > 0 ? 'warn' : 'neutral'}
        />
        <GlanceCard
          label="Voluntary co-pay"
          value={copay.voluntary_percentage != null ? `${copay.voluntary_percentage}%` : 'None'}
          help="copay"
          tone={copay.voluntary_percentage && copay.voluntary_percentage > 0 ? 'warn' : 'neutral'}
        />
      </div>
      {/* Row 2 — plan shape */}
      <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <GlanceCard label="Family type" value={familyLabel} tone="neutral" />
        <GlanceCard label="Plan type" value={planLabel} tone="neutral" />
        <GlanceCard
          label="Room-rent cap"
          value={roomRent?.cap_text ?? 'Not declared'}
          help="room_rent"
          tone={!roomRent ? 'neutral' : roomRentUnlimited ? 'success' : 'warn'}
        />
        <GlanceCard
          label="Network hospitals"
          value={bf.network_hospital_count != null ? bf.network_hospital_count.toLocaleString('en-IN') : '—'}
          tone="neutral"
        />
      </div>
    </section>
  );
}

/* ───────── §3 Boosters (NCB / Restore / Inflation protect) ───────── */

function BoostersPanel({ boosters }: { boosters: EnrichedExtractor['boosters'] }) {
  if (!boosters || (!boosters.no_claim_bonus && !boosters.restore && !boosters.inflation_protect)) {
    return null;
  }
  return (
    <section>
      <SectionHeader
        icon={<Sparkles className="size-4 text-success" />}
        title="Sum-insured boosters"
        subtitle="The good news — rules that extend your cover over time"
      />
      <div className="grid gap-3 lg:grid-cols-3">
        {/* NCB */}
        <div className="rounded-2xl border-2 border-success/30 bg-success/5 p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-sm font-semibold text-ink">No Claim Bonus</h3>
            <LearnMore termKey="ncb" iconOnly />
          </div>
          {boosters.no_claim_bonus ? (
            <>
              <div className="mt-2 font-display text-2xl font-semibold text-ink">
                +{boosters.no_claim_bonus.per_year_percentage}% / year
              </div>
              <div className="mt-1 text-xs text-ink-muted">
                Up to {boosters.no_claim_bonus.max_percentage}% of base SI.
              </div>
              <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-card/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                {boosters.no_claim_bonus.resets_on_claim ? (
                  <span className="text-warn">Resets on claim</span>
                ) : (
                  <span className="text-success">Bonus preserved</span>
                )}
              </div>
              {boosters.no_claim_bonus.notes && (
                <p className="mt-2 text-xs text-ink-muted">{boosters.no_claim_bonus.notes}</p>
              )}
            </>
          ) : (
            <div className="mt-2 text-sm italic text-ink-subtle">Not included in this policy.</div>
          )}
        </div>

        {/* Restore */}
        <div className="rounded-2xl border-2 border-success/30 bg-success/5 p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-sm font-semibold text-ink">Restore / Refill</h3>
            <LearnMore termKey="restore" iconOnly />
          </div>
          {boosters.restore ? (
            <>
              <div className="mt-2 text-sm font-medium text-ink">
                {boosters.restore.frequency === 'unlimited' ? 'Unlimited restores' : 'Once per year'}
                {' · '}
                {boosters.restore.trigger === 'partial_exhaustion' ? 'Partial exhaustion' : 'Full exhaustion'}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
                <div className="rounded-md bg-card/80 px-2 py-1.5">
                  <div className="font-semibold uppercase tracking-wider text-ink-subtle">Disease</div>
                  <div className="mt-0.5 text-ink">{titleCase(boosters.restore.disease)}</div>
                </div>
                <div className="rounded-md bg-card/80 px-2 py-1.5">
                  <div className="font-semibold uppercase tracking-wider text-ink-subtle">Person</div>
                  <div className="mt-0.5 text-ink">{titleCase(boosters.restore.person)}</div>
                </div>
              </div>
              {boosters.restore.notes && (
                <p className="mt-2 text-xs text-ink-muted">{boosters.restore.notes}</p>
              )}
            </>
          ) : (
            <div className="mt-2 text-sm italic text-ink-subtle">Not included in this policy.</div>
          )}
        </div>

        {/* Inflation protect */}
        <div className="rounded-2xl border-2 border-success/30 bg-success/5 p-5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-display text-sm font-semibold text-ink">Inflation Protect</h3>
            <LearnMore termKey="inflation_protect" iconOnly />
          </div>
          {boosters.inflation_protect ? (
            <>
              <div className="mt-2 font-display text-2xl font-semibold text-ink">
                +{boosters.inflation_protect.per_year_percentage}% / year
              </div>
              {boosters.inflation_protect.max_percentage != null && (
                <div className="mt-1 text-xs text-ink-muted">
                  Capped at {boosters.inflation_protect.max_percentage}% of base SI.
                </div>
              )}
              {boosters.inflation_protect.notes && (
                <p className="mt-2 text-xs text-ink-muted">{boosters.inflation_protect.notes}</p>
              )}
            </>
          ) : (
            <div className="mt-2 text-sm italic text-ink-subtle">Not included in this policy.</div>
          )}
        </div>
      </div>
    </section>
  );
}

/* ───────── §8 Additional benefits + ambulance + maternity ───────── */

const BENEFIT_ICONS: Record<string, React.ReactNode> = {
  health_checkup: <Stethoscope className="size-4 text-primary" />,
  teleconsult: <Phone className="size-4 text-primary" />,
  opd: <Building2 className="size-4 text-primary" />,
  ayush: <Sparkles className="size-4 text-primary" />,
  mental_health: <Sparkles className="size-4 text-primary" />,
  daily_cash: <Sparkles className="size-4 text-primary" />,
  organ_donor: <Sparkles className="size-4 text-primary" />,
  vaccination: <Syringe className="size-4 text-primary" />,
  second_opinion: <Sparkles className="size-4 text-primary" />,
  wellness: <Sparkles className="size-4 text-primary" />,
  other: <Sparkles className="size-4 text-primary" />,
};

function AdditionalBenefitsPanel({
  benefits,
  ambulance,
  maternity,
}: {
  benefits?: EnrichedExtractor['additional_benefits'];
  ambulance?: EnrichedExtractor['ambulance'];
  maternity?: EnrichedExtractor['maternity'];
}) {
  const hasBenefits = benefits && benefits.length > 0;
  const hasAmbulance = !!ambulance;
  const hasMaternity = maternity?.covered;
  if (!hasBenefits && !hasAmbulance && !hasMaternity) return null;

  const glossaryKey = (k: string): keyof typeof import('./policy-glossary').GLOSSARY | null => {
    if (k === 'health_checkup') return 'health_checkup';
    if (k === 'teleconsult') return 'teleconsult';
    if (k === 'opd') return 'opd';
    if (k === 'ayush') return 'ayush';
    if (k === 'daily_cash') return 'daily_cash';
    return null;
  };

  return (
    <section>
      <SectionHeader
        icon={<Sparkles className="size-4 text-primary" />}
        title="Additional benefits"
        subtitle="Claimable benefits beyond hospitalisation — check-ups, OPD, daily cash, ambulance, maternity"
        help="additional_benefits"
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {hasBenefits && benefits!.map((b, i) => {
          const help = glossaryKey(b.kind);
          return (
            <div key={i} className="rounded-2xl border border-border bg-card p-4 shadow-card">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  {BENEFIT_ICONS[b.kind] ?? BENEFIT_ICONS.other}
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-ink">{b.label}</div>
                  </div>
                </div>
                {help && <LearnMore termKey={help} iconOnly />}
              </div>
              <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                {b.amount_rupees != null ? (
                  <span className="font-display text-lg font-semibold text-ink">
                    {formatRupees(b.amount_rupees)}
                  </span>
                ) : (
                  <span className="font-display text-lg font-semibold text-success">Unlimited</span>
                )}
                {b.frequency && <span className="text-xs text-ink-muted">{b.frequency}</span>}
              </div>
              {b.scope && <p className="mt-1 text-xs text-ink-muted">{b.scope}</p>}
              {b.members_eligible && b.members_eligible !== 'all' && (
                <Badge tone="neutral">{humanize(b.members_eligible)}</Badge>
              )}
              {b.notes && <p className="mt-2 text-xs italic text-ink-subtle">{b.notes}</p>}
            </div>
          );
        })}

        {hasAmbulance && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Sparkles className="size-4 text-primary" />
                <div className="text-sm font-semibold text-ink">Ambulance</div>
              </div>
              <LearnMore termKey="ambulance" iconOnly />
            </div>
            <dl className="mt-2 space-y-1 text-sm">
              {ambulance!.road_cap_rupees != null && (
                <div className="flex items-baseline justify-between">
                  <dt className="text-ink-muted">Road</dt>
                  <dd className="font-medium text-ink">{formatRupees(ambulance!.road_cap_rupees)}</dd>
                </div>
              )}
              {ambulance!.air_cap_rupees != null && (
                <div className="flex items-baseline justify-between">
                  <dt className="text-ink-muted">Air</dt>
                  <dd className="font-medium text-ink">{formatRupees(ambulance!.air_cap_rupees)}</dd>
                </div>
              )}
              {ambulance!.per_event_or_annual && (
                <div className="mt-1 inline-block rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                  {ambulance!.per_event_or_annual === 'per_event' ? 'Per admission' : 'Annual'}
                </div>
              )}
            </dl>
            {ambulance!.notes && (
              <p className="mt-2 text-xs italic text-ink-subtle">{ambulance!.notes}</p>
            )}
          </div>
        )}

        {hasMaternity && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2">
                <Sparkles className="size-4 text-primary" />
                <div className="text-sm font-semibold text-ink">Maternity cover</div>
              </div>
              <LearnMore termKey="maternity" iconOnly />
            </div>
            <dl className="mt-2 space-y-1 text-sm">
              {maternity!.delivery_cap_rupees != null && (
                <div className="flex items-baseline justify-between">
                  <dt className="text-ink-muted">Delivery cap</dt>
                  <dd className="font-medium text-ink">{formatRupees(maternity!.delivery_cap_rupees)}</dd>
                </div>
              )}
              {maternity!.newborn_cover_days != null && (
                <div className="flex items-baseline justify-between">
                  <dt className="text-ink-muted">Newborn cover</dt>
                  <dd className="font-medium text-ink">{maternity!.newborn_cover_days} days</dd>
                </div>
              )}
              {maternity!.newborn_cap_rupees != null && (
                <div className="flex items-baseline justify-between">
                  <dt className="text-ink-muted">Newborn cap</dt>
                  <dd className="font-medium text-ink">{formatRupees(maternity!.newborn_cap_rupees)}</dd>
                </div>
              )}
              {maternity!.well_baby_checkup && (
                <div className="mt-1 inline-block rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-success">
                  Well-baby check-up included
                </div>
              )}
            </dl>
            {maternity!.notes && (
              <p className="mt-2 text-xs italic text-ink-subtle">{maternity!.notes}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────── §9a Custom clauses (catch-all) ───────── */

const CUSTOM_BUCKET_TONE: Record<string, 'success' | 'warn' | 'primary' | 'neutral'> = {
  benefit: 'success',
  service: 'primary',
  geographic: 'primary',
  disease_specific: 'warn',
  cost_rule: 'warn',
  eligibility: 'warn',
  other: 'neutral',
};

const CUSTOM_BUCKET_LABEL: Record<string, string> = {
  benefit: 'Extra benefit',
  service: 'Service',
  geographic: 'Geographic',
  disease_specific: 'Disease-specific',
  cost_rule: 'Cost rule',
  eligibility: 'Eligibility',
  other: 'Other',
};

function CustomClausesPanel({ clauses }: { clauses?: EnrichedExtractor['custom_clauses'] }) {
  if (!clauses || clauses.length === 0) return null;
  // Group by bucket for readability.
  const groups = new Map<string, typeof clauses>();
  for (const c of clauses) {
    const b = c.bucket ?? 'other';
    const arr = groups.get(b) ?? [];
    arr.push(c);
    groups.set(b, arr);
  }
  const bucketOrder: Array<keyof typeof CUSTOM_BUCKET_LABEL> = [
    'benefit',
    'service',
    'geographic',
    'disease_specific',
    'cost_rule',
    'eligibility',
    'other',
  ];

  return (
    <section>
      <SectionHeader
        icon={<Sparkles className="size-4 text-primary" />}
        title="Policy-specific clauses"
        subtitle="Clauses unique to this product that don't fit any standard category"
      />
      <div className="space-y-4">
        {bucketOrder.map((b) => {
          const items = groups.get(b);
          if (!items || items.length === 0) return null;
          const tone = CUSTOM_BUCKET_TONE[b] ?? 'neutral';
          return (
            <div key={b}>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
                {CUSTOM_BUCKET_LABEL[b]}
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {items.map((c, i) => (
                  <div
                    key={i}
                    className={cn(
                      'rounded-2xl border bg-card p-4 shadow-card',
                      tone === 'success' && 'border-success/30',
                      tone === 'warn' && 'border-warn/30',
                      tone === 'primary' && 'border-primary/30',
                      tone === 'neutral' && 'border-border',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="text-sm font-semibold text-ink">{c.title}</h4>
                      {c.numeric_value != null && (
                        <Badge tone={tone === 'primary' ? 'primary' : tone === 'success' ? 'success' : 'warn'}>
                          {c.numeric_unit === 'rupees' || c.numeric_unit === '₹'
                            ? formatRupees(c.numeric_value)
                            : `${c.numeric_value}${c.numeric_unit ? ' ' + c.numeric_unit : ''}`}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-ink-muted">{c.summary}</p>
                    {c.notes && <p className="mt-2 text-xs italic text-ink-subtle">{c.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/* ───────── Re-analyse nudge banner ───────── */

function ReAnalyseNudge({ missingSections }: { missingSections: string[] }) {
  if (missingSections.length === 0) return null;
  const list =
    missingSections.length === 1
      ? missingSections[0]
      : missingSections.length === 2
        ? `${missingSections[0]} and ${missingSections[1]}`
        : `${missingSections.slice(0, -1).join(', ')}, and ${missingSections[missingSections.length - 1]}`;
  return (
    <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-5">
      <div className="flex items-start gap-3">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
        <div>
          <h3 className="text-sm font-semibold text-ink">Re-analyse for full detail</h3>
          <p className="mt-1 text-sm text-ink-muted">
            Some sections ({list}) weren't captured in this analysis. Re-analysing the policy will
            fill them in using the latest extractor.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ───────── Helpers ───────── */

function groupByCategory<T, K>(items: T[], keyOf: (t: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const it of items) {
    const k = keyOf(it);
    const arr = map.get(k) ?? [];
    arr.push(it);
    map.set(k, arr);
  }
  return map;
}

function summariseHeadlineCopay(c: EnrichedExtractor['copay']): string {
  const parts: string[] = [];
  if (c.voluntary_percentage != null) parts.push(`${c.voluntary_percentage}% vol.`);
  if (c.mandatory_percentage != null) parts.push(`${c.mandatory_percentage}% mand.`);
  if (c.age_triggered) parts.push(`${c.age_triggered.percentage}% @ ${c.age_triggered.from_age}+`);
  if (parts.length === 0) return 'None declared';
  return parts.join(' · ');
}

function headlineCopayTone(c: EnrichedExtractor['copay']): 'primary' | 'warn' | 'neutral' {
  const highest =
    Math.max(c.voluntary_percentage ?? 0, c.mandatory_percentage ?? 0, c.age_triggered?.percentage ?? 0);
  if (highest >= 20) return 'warn';
  if (highest > 0) return 'primary';
  return 'neutral';
}

function formatRupees(rupees: number | null): string | null {
  if (rupees == null || rupees === 0) return null;
  // Safety net: if a legacy value in paise (>50 Cr rupees worth) slipped
  // through, fold it back. Kept here as a last-mile guard on top of
  // `normaliseRupees()` which runs at the write boundary.
  const r = rupees > 500_000_000 ? Math.round(rupees / 100) : Math.round(rupees);
  if (r >= 10_000_000) return `₹${(r / 10_000_000).toFixed(2)} Cr`;
  if (r >= 100_000) return `₹${(r / 100_000).toFixed(2)} L`;
  return `₹${r.toLocaleString('en-IN')}`;
}

function humanize(s: string | null): string | null {
  if (!s) return null;
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function titleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function truncate(s: string, n: number): string {
  return s.length > n ? s.slice(0, n) + '…' : s;
}

/* formatWaitSpan + isUnlimitedRoomRent + isEffectivelyUnlimited +
 * isRealWaitingPeriod now all live in `@/lib/policy-format` so the scorer
 * and the UI share the exact same predicates. */


/**
 * Hide a wait note when it restates the section context — e.g. when every
 * row in a member's PED bucket carries "PED waiting period for Anand Mohan".
 * The user already knows the member + category from the section header.
 */
function isRedundantWaitNote(note: string): boolean {
  const t = note.toLowerCase().trim();
  return /^(ped|pre[- ]?existing)\s+waiting\s+period(\s+for\s+.+)?$/.test(t)
    || /^specified\s+disease\s+waiting\s+period$/.test(t)
    || /^initial\s+waiting\s+period$/.test(t);
}

// Silence the MapPin / AlertTriangle / Building2 unused-vars if any were
// trimmed during iteration — keep them imported for future variant icons.
void MapPin;
