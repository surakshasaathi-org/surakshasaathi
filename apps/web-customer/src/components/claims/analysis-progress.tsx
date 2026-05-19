'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertCircle,
  Bookmark,
  Building2,
  CheckCircle2,
  ClipboardList,
  FileSearch,
  FileText,
  Loader2,
  Search,
  Sparkles,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface Snapshot {
  insurerName: string | null;
  planName: string | null;
  policyNumber: string | null;
  sumInsuredRupees: number | null;
  premiumRupees: number | null;
  memberCount: number;
  pedCount: number;
  coverageSectionsCount: number;
  exclusionsCount: number;
  waitingPeriodsCount: number;
  subLimitsCount: number;
  redFlagsCount: number;
  /** Count of pages the digitizer transcribed. Available right after the
   *  digitiser stage finishes — gives the right column an early signal
   *  even before the extractor populates the rest. */
  digitizedPages: number | null;
}

interface Props {
  analysisId: string;
  initialStatus: string;
  initialStep: string | null;
  initialErrorCode?: string | null;
  initialErrorMessage?: string | null;
  stageLabels: {
    ocr_running: string;
    intake_running: string;
    extracting: string;
    analysing: string;
    translating: string;
    reviewing: string;
  };
  titles: {
    readingPolicy: string;
    estSeconds: string;
    failedTitle: string;
    tryAgain: string;
    keepUrl: string;
  };
}

/* ───────── Stage map ─────────
 * Five meaningful customer-facing stages mapped from the pipeline's internal
 * statuses. Each stage carries its own short headline + sub-line that updates
 * the marquee on the left. The internal extractor / coverage stages map onto
 * this 5-step mental model.
 */

type StageKey = 'digitizing' | 'verify' | 'extract' | 'analyse' | 'finalize';

const STAGE_FLOW: StageKey[] = ['digitizing', 'verify', 'extract', 'analyse', 'finalize'];

const STAGE_META: Record<
  StageKey,
  {
    title: string;
    /** Single-word label for the stepper chip — fits the small column. */
    short: string;
    sub: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  digitizing: {
    title: 'Reading every page',
    short: 'Read',
    sub: 'Going through your full policy document — including all the small print.',
    icon: FileText,
  },
  verify: {
    title: 'Confirming this is a health policy',
    short: 'Verify',
    sub: 'A quick check that we have the right kind of document.',
    icon: ShieldCheck,
  },
  extract: {
    title: 'Pulling out coverage and conditions',
    short: 'Extract',
    sub: 'Finding what\'s covered, what\'s not, and the rules in between.',
    icon: FileSearch,
  },
  analyse: {
    title: 'Working out what affects your family',
    short: 'Analyse',
    sub: 'Building easy-to-read coverage cards and flagging anything that might hurt a claim.',
    icon: Users,
  },
  finalize: {
    title: 'Double-checking everything',
    short: 'Finalise',
    sub: 'Making sure every point we tell you comes from your actual document.',
    icon: ClipboardList,
  },
};

function statusToStage(status: string): StageKey {
  if (status === 'queued') return 'digitizing';
  if (status === 'digitizing') return 'digitizing';
  if (status === 'ocr_running') return 'digitizing';
  if (status === 'intake_running') return 'verify';
  if (status === 'extracting') return 'extract';
  if (status === 'analysing') return 'analyse';
  if (status === 'translating') return 'finalize';
  if (status === 'reviewing') return 'finalize';
  return 'digitizing';
}

/* ───────── Tidbits — rotating during the wait ───────── */

const TIDBITS = [
  // ── Sub-limits & proportionate-deduction ──
  {
    headline: 'Most claims die on a 1-line clause',
    body: 'A single "proportionate-deduction" rule on room rent can shrink a ₹5 L bill to ₹3 L payout. We look for these.',
  },
  {
    headline: 'Sub-limits trump sum insured',
    body: 'A ₹10 L policy with a ₹50 k cataract sub-limit pays out ₹50 k — not ₹10 L. Sub-limits are the silent ceiling.',
  },
  {
    headline: 'Room-rent caps are sneakier than they look',
    body: '"1% of sum insured per day" sounds reasonable until you realise a metro ICU costs 3-5× that. The overshoot then prorates EVERY other charge.',
  },
  {
    headline: 'Modern treatments have their own caps',
    body: 'IRDAI mandates cover for 12 advanced procedures (robotic surgery, oral chemo, immunotherapy). Most policies cap each at 50% of SI or ₹5 L — much lower than headline cover.',
  },
  // ── Waiting periods ──
  {
    headline: 'Waiting periods are not all the same',
    body: 'Initial 30-day, pre-existing 24-48 month, specified-disease 1-2 yr — different conditions trigger different timers. Most policies have ALL of them simultaneously.',
  },
  {
    headline: 'PED waiting period is the #1 surprise',
    body: 'Diabetes / hypertension claims often get rejected for 24-48 months unless you actively bought "PED waiver" cover.',
  },
  {
    headline: 'Specified-disease waits apply even if you\'re healthy',
    body: 'Cataract, hernia, knee replacement, gallstones often have 1-2 year waiting periods regardless of whether you have the condition today.',
  },
  {
    headline: '"Initial 30-day" excludes accidents',
    body: 'The first-30-days waiting period applies to illness only. Hospitalisation due to an accident is covered from Day 1 in almost every Indian policy.',
  },
  // ── Day-care / OPD / AYUSH ──
  {
    headline: '"Day-care" ≠ OPD',
    body: 'Day-care procedures (cataract, dialysis, chemo) ARE covered without 24-hr admission. OPD consultations and pharmacy bills usually are not.',
  },
  {
    headline: 'AYUSH is covered. Up to a point.',
    body: 'IRDAI mandates AYUSH cover (Ayurveda / Yoga / Unani / Siddha / Homoeopathy) but typically only at government-approved hospitals, often with their own sub-limit.',
  },
  {
    headline: 'OPD riders are usually a bad deal',
    body: 'OPD add-ons add 30-50% to your premium for a benefit capped at ₹10-20 k/year. Cheaper to self-fund routine consults.',
  },
  // ── Co-pay & deductible ──
  {
    headline: 'Co-pay is per-claim, not per-year',
    body: '"20% co-pay" means YOU pay 20% on every single claim. It can quietly drain ₹2-3 L over a year of frequent visits.',
  },
  {
    headline: 'Senior co-pay is often higher',
    body: 'Many policies tier co-pay by age: 10% under 55, 20% 55-65, 30% above 65. Read the age-triggered clause carefully.',
  },
  {
    headline: 'Zone-based co-pay is a real thing',
    body: 'Tier-1 metros sometimes carry a 10-15% co-pay even when treated in-network. Smaller cities can be cheaper to claim from.',
  },
  {
    headline: 'Deductibles flip the cost curve',
    body: 'A super-top-up with ₹3 L deductible only pays once you (or your base policy) cross ₹3 L in a policy year. Powerful for catastrophic cover, useless for small claims.',
  },
  // ── Boosters & restore ──
  {
    headline: 'Restore benefit ≠ unlimited cover',
    body: 'Most "100% restore" clauses only kick in for a DIFFERENT illness or DIFFERENT family member. Read the trigger language.',
  },
  {
    headline: 'No-claim bonus stacks — but quietly',
    body: 'A 50%-per-year NCB (capped at 100% of SI) doubles your effective cover after 2 claim-free years. One claim wipes it on most policies.',
  },
  {
    headline: 'Inflation-protect lifts SI, not premium',
    body: 'Some plans bump your sum insured 5-10% every year automatically — the premium rises too, but slower than medical inflation. Check if it\'s capped.',
  },
  // ── Maternity & newborn ──
  {
    headline: 'Maternity has its own clock',
    body: 'Maternity benefit usually starts 24-36 months AFTER policy purchase. Mid-policy upgrade rarely waives this.',
  },
  {
    headline: 'Newborn cover is often capped at 90 days',
    body: 'Many policies cover the newborn under maternity for 90 days only — after that you must port them as a member with a fresh waiting period.',
  },
  {
    headline: 'C-section sub-limits are usually higher than normal delivery',
    body: 'A policy might cap normal delivery at ₹50 k but C-section at ₹75 k. The "₹50 k maternity" headline misses this — and most deliveries in metros are C-section.',
  },
  // ── Critical illness, organ donor, mental health ──
  {
    headline: 'Critical-illness rider pays a lump sum, not bills',
    body: 'A CI rider pays the full sum on diagnosis (heart attack, cancer, stroke). Independent of hospitalisation. Use it for income replacement, not medical bills.',
  },
  {
    headline: 'Mental health is mandatorily covered since 2018',
    body: 'IRDAI directed all health policies to cover mental illness on par with physical illness. If yours doesn\'t, the insurer is non-compliant.',
  },
  {
    headline: 'Organ-donor cover is your responsibility',
    body: 'Standard policies don\'t cover the donor\'s hospitalisation cost during transplant. Check for explicit "organ donor expenses" cover or a donor rider.',
  },
  // ── Cashless / network ──
  {
    headline: 'Network hospitals matter more than you think',
    body: 'Cashless only works at network hospitals. Reimbursement claims have higher rejection rates and 60-90 day turnarounds.',
  },
  {
    headline: 'Cashless can be denied at the network hospital',
    body: 'Insurers can refuse cashless approval mid-treatment, forcing you to pay and claim reimbursement. Always have a backup plan for ₹2-3 L upfront.',
  },
  {
    headline: 'Pre-authorisation timelines are tight',
    body: 'Planned hospitalisation: 48-72 hours notice. Emergency: 24 hours after admission. Miss either and the cashless desk can convert your claim to reimbursement.',
  },
  // ── Pre/post hospitalisation, ambulance, home care ──
  {
    headline: 'Pre/post hospitalisation cover is in days',
    body: 'Typical: 30-60 days pre-admission, 60-90 days post-discharge. Diagnostics and medicines outside that window aren\'t reimbursable.',
  },
  {
    headline: 'Ambulance cover is laughably low',
    body: 'Most policies cap ambulance at ₹1,500-2,000 per hospitalisation. A real city ambulance with paramedics costs ₹4-8 k.',
  },
  {
    headline: 'Domiciliary hospitalisation has tight conditions',
    body: 'Treatment at home is covered only if (a) the patient cannot be moved, or (b) the hospital had no bed. Both usually need a doctor\'s certificate.',
  },
  // ── Renewal, portability, free-look ──
  {
    headline: 'Lifetime renewability is non-negotiable',
    body: 'Since 2013, IRDAI mandates lifetime renewal — the insurer cannot refuse to renew unless you committed fraud. If your policy says "renewable up to age 75", it predates this rule.',
  },
  {
    headline: 'You can port without losing waiting-period credit',
    body: 'Switch insurers within 45 days of renewal — your accumulated waiting-period credit transfers. Most people don\'t know this.',
  },
  {
    headline: '15-day free-look is your reset button',
    body: 'Within 15 days of buying a fresh policy you can cancel for full premium refund (less stamp duty + small admin). Use it if the document doesn\'t match what was sold.',
  },
  {
    headline: 'Grace-period rules vary',
    body: 'Most insurers give 15-30 days grace after expiry to renew. Miss it and the policy lapses — fresh waiting periods, no NCB.',
  },
  // ── Claim mechanics ──
  {
    headline: 'Section 45 protects honest customers',
    body: 'After 3 years, the insurer cannot deny a claim for non-disclosure unless they prove the omission was fraudulent. A small mistake in your proposal form isn\'t enough.',
  },
  {
    headline: 'Ombudsman handles claims under ₹50 L for free',
    body: 'Insurance Ombudsman is free, has 12 regional offices, and resolves most disputes in 90 days. Use it before going to consumer court.',
  },
  {
    headline: 'Claim Settlement Ratio ≠ Claim Settlement Value',
    body: 'CSR (count of claims paid) is published. CSV (rupee value paid) tells you whether the insurer is paying small claims and rejecting big ones. Always check both.',
  },
  {
    headline: 'TPA delays are not the insurer\'s legal defence',
    body: 'Even if a Third-Party Administrator (TPA) processes your claim, the insurer is the legally accountable party for delays. Escalate to insurer customer-care if TPA stalls.',
  },
  // ── Tax, govt schemes, regulatory ──
  {
    headline: 'Section 80D shrinks your tax bill',
    body: 'Premium paid for self/family deductible up to ₹25 k (₹50 k if any senior). Parents covered separately add another ₹50 k. Easy ₹15-20 k tax saving.',
  },
  {
    headline: 'Ayushman Bharat is free, anonymous, no waiting',
    body: 'PM-JAY covers up to ₹5 L/family/year if you\'re on the SECC list. No waiting period, no PED exclusion. Worth checking eligibility before buying private cover.',
  },
  {
    headline: 'IRDAI Section 41 — agents can\'t legally rebate premium',
    body: 'If an agent offers cashback or kickback on premium, that\'s a Section-41 violation by the agent. You can keep the policy AND report them.',
  },
  {
    headline: 'PM-JJBY: ₹2 L life cover for ₹436/year',
    body: 'Anyone 18-50 with a bank account can buy PM-JJBY for ₹436/yr. ₹2 L payout on natural or accidental death. Pure protection, no investment.',
  },
  {
    headline: 'PMSBY: ₹2 L accident cover for ₹20/year',
    body: 'Pradhan Mantri Suraksha Bima Yojana costs ₹20/yr for ₹2 L accidental death cover (₹1 L for permanent disability). Cheapest insurance product on the market.',
  },
  // ── About us ──
  {
    headline: 'Free first analysis, no card',
    body: "We're advisory-only. We don't sell policies and we don't take broker commissions. Your wallet is safe.",
  },
  {
    headline: 'We never share your policy with insurers',
    body: 'India-region servers, 7-day default retention. Your document is yours, not theirs.',
  },
];

/* ───────── Findings — derived from snapshot + pipeline status ─────────
 *
 * Findings render as a chronological feed of full-sentence beats, e.g.
 * "Read all 9 pages of your policy", "Confirmed this is a health-
 * insurance policy", "Identified Care Health · Care Freedom — Plan 2".
 * Reads as a story rather than a stat dashboard. Tone drives accent:
 * success (mint) for completed milestones, neutral for stat lines,
 * warn for "needs attention" counts.
 */

type FindingTone = 'success' | 'neutral' | 'warn';

interface Finding {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Bold first-line — the headline beat. */
  sentence: string;
  /** Optional secondary line for context, italic-muted. */
  detail?: string;
  tone: FindingTone;
}

function deriveFindings(s: Snapshot | null, status: string): Finding[] {
  const out: Finding[] = [];
  const reached = (...needed: string[]): boolean => {
    // statusOrder: queued < digitizing < intake_running < extracting < analysing < translating < reviewing < ready
    const order = [
      'queued',
      'digitizing',
      'ocr_running',
      'intake_running',
      'extracting',
      'analysing',
      'translating',
      'reviewing',
      'ready',
    ];
    const cur = order.indexOf(status);
    return needed.some((n) => order.indexOf(n) <= cur);
  };

  // All copy here is customer-facing. No internal terms (vision AI, intake
  // classifier, extractor, citations) — those are how WE talk; not how
  // customers read.

  if (s?.digitizedPages != null && s.digitizedPages > 0) {
    out.push({
      key: 'pages',
      icon: FileText,
      sentence: `Read all ${s.digitizedPages} page${s.digitizedPages === 1 ? '' : 's'} of your policy`,
      detail: 'Including every table, heading and the small print.',
      tone: 'success',
    });
  }

  if (reached('extracting')) {
    out.push({
      key: 'verified',
      icon: ShieldCheck,
      sentence: 'Confirmed this is a real health-insurance policy',
      detail: 'No mismatch — we can read it in detail now.',
      tone: 'success',
    });
  }

  if (s?.insurerName) {
    const planLine = s.planName ? `${s.insurerName} · ${s.planName}` : s.insurerName;
    out.push({
      key: 'insurer',
      icon: Building2,
      sentence: `Your policy: ${planLine}`,
      detail: s.policyNumber ? `Policy number ${s.policyNumber}` : undefined,
      tone: 'neutral',
    });
  }

  if (s?.sumInsuredRupees != null) {
    out.push({
      key: 'sumInsured',
      icon: Bookmark,
      sentence: `Total cover: ${formatRupees(s.sumInsuredRupees)}`,
      detail: 'The most this policy can pay in a year. Some treatments may have smaller caps — we\'ll show you those.',
      tone: 'neutral',
    });
  }

  if (s && s.memberCount > 0) {
    out.push({
      key: 'members',
      icon: Users,
      sentence: `${s.memberCount} ${s.memberCount === 1 ? 'person is' : 'people are'} covered`,
      detail:
        s.pedCount > 0
          ? `${s.pedCount} ongoing health condition${s.pedCount === 1 ? '' : 's'} mentioned on the policy.`
          : 'No ongoing health conditions mentioned on the policy.',
      tone: 'neutral',
    });
  }

  if (s && s.coverageSectionsCount > 0) {
    out.push({
      key: 'sections',
      icon: FileSearch,
      sentence: `Found ${s.coverageSectionsCount} thing${s.coverageSectionsCount === 1 ? '' : 's'} this policy covers`,
      detail: 'Hospital stays, day procedures, post-discharge expenses and more.',
      tone: 'neutral',
    });
  }

  if (s && s.subLimitsCount > 0) {
    out.push({
      key: 'sublimits',
      icon: AlertCircle,
      sentence: `Spotted ${s.subLimitsCount} smaller cap${s.subLimitsCount === 1 ? '' : 's'} you should know about`,
      detail: 'Specific procedures or charges with their own limit. We\'ll show you where these could affect a claim.',
      tone: 'warn',
    });
  }

  if (s && s.exclusionsCount > 0) {
    out.push({
      key: 'exclusions',
      icon: AlertCircle,
      sentence: `Found ${s.exclusionsCount} thing${s.exclusionsCount === 1 ? '' : 's'} this policy doesn't cover`,
      detail: 'We\'ll list each one in plain English so there are no surprises.',
      tone: 'warn',
    });
  }

  if (s && s.waitingPeriodsCount > 0) {
    out.push({
      key: 'waits',
      icon: AlertCircle,
      sentence: `${s.waitingPeriodsCount} waiting period${s.waitingPeriodsCount === 1 ? '' : 's'} to keep in mind`,
      detail: 'Times after buying when certain claims aren\'t paid yet. We\'ll show you exactly which and how long.',
      tone: 'warn',
    });
  }

  if (s && s.redFlagsCount > 0) {
    out.push({
      key: 'redflags',
      icon: AlertCircle,
      sentence: `Found ${s.redFlagsCount} red flag${s.redFlagsCount === 1 ? '' : 's'} worth knowing about`,
      detail: 'Things in your policy that could hurt a future claim — and what to do about each.',
      tone: 'warn',
    });
  }

  return out;
}

function formatRupees(rupees: number): string {
  if (rupees >= 10_000_000) return `₹${(rupees / 10_000_000).toFixed(2)} Cr`;
  if (rupees >= 100_000) return `₹${(rupees / 100_000).toFixed(0)} L`;
  return `₹${rupees.toLocaleString('en-IN')}`;
}

/* ───────── Component ───────── */

export function AnalysisProgress({
  analysisId,
  initialStatus,
  initialStep,
  initialErrorCode,
  initialErrorMessage,
  titles,
}: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [step, setStep] = useState<string | null>(initialStep);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(initialErrorCode ?? null);
  const [errorMessage, setErrorMessage] = useState<string | null>(initialErrorMessage ?? null);
  const [tidbitIndex, setTidbitIndex] = useState(() => Math.floor(Math.random() * TIDBITS.length));
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<NodeJS.Timeout | null>(null);
  const startTime = useRef<number>(Date.now());

  // Status poll
  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const r = await fetch(`/api/analyse/${analysisId}/status`, { cache: 'no-store' });
        if (!r.ok) return;
        const data = (await r.json()) as {
          ok: boolean;
          status: string;
          progressStep: string | null;
          errorCode: string | null;
          errorMessage: string | null;
          snapshot: Snapshot | null;
        };
        if (cancelled || !data.ok) return;
        setStatus(data.status);
        setStep(data.progressStep);
        setSnapshot(data.snapshot);
        if (data.errorCode) setErrorCode(data.errorCode);
        if (data.errorMessage) setErrorMessage(data.errorMessage);
        if (data.status === 'ready') {
          router.refresh();
          return;
        }
        if (data.status === 'failed') return;
        timer.current = setTimeout(poll, 2000);
      } catch {
        timer.current = setTimeout(poll, 4000);
      }
    }
    poll();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [analysisId, router]);

  // Tidbit rotator — every 8s. Long enough to read both headline + body
  // without feeling like a stream of confetti.
  useEffect(() => {
    const t = setInterval(() => {
      setTidbitIndex((i) => (i + 1) % TIDBITS.length);
    }, 8000);
    return () => clearInterval(t);
  }, []);

  // Elapsed seconds
  useEffect(() => {
    const t = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTime.current) / 1000));
    }, 1000);
    return () => clearInterval(t);
  }, []);

  /* ───────── Failure states ───────── */

  if (status === 'failed') {
    if (errorCode === 'upstream_unavailable') {
      return (
        <FailurePanel
          tone="warn"
          title="Our AI provider is having a moment"
          body="Gemini responded with a temporary error. Your document is fine — please try again in a minute."
          ctaHref="../analyse"
          ctaLabel="Try again"
        />
      );
    }
    if (errorCode === 'not_a_policy') {
      return (
        <FailurePanel
          tone="warn"
          title="This doesn't look like a health-insurance policy"
          body={
            errorMessage ??
            "We couldn't recognise this as an Indian health-policy schedule, certificate, or wording document."
          }
          ctaHref="../analyse"
          ctaLabel="Upload a different file"
        />
      );
    }
    return (
      <FailurePanel
        tone="danger"
        title={titles.failedTitle}
        body={errorMessage ?? 'Something went wrong. Please try uploading again.'}
        ctaHref="../analyse"
        ctaLabel={titles.tryAgain}
      />
    );
  }

  /* ───────── In-progress UI ───────── */

  const currentStage = statusToStage(status);
  const currentMeta = STAGE_META[currentStage];
  const currentIndex = STAGE_FLOW.indexOf(currentStage);
  const findings = deriveFindings(snapshot, status);
  const tidbit = TIDBITS[tidbitIndex]!;

  return (
    <div className="grid gap-5 lg:grid-cols-[1.05fr_1fr]">
      {/* ───────── Left: stage + tidbit ───────── */}
      <div className="rounded-3xl border border-border bg-surface/50 p-6 shadow-card sm:p-8">
        <div className="flex items-start gap-4">
          <span className="relative inline-flex size-12 flex-none items-center justify-center rounded-2xl bg-primary/15 text-primary">
            <span
              aria-hidden
              className="absolute inset-0 rounded-2xl bg-primary/20 motion-safe:animate-ping"
            />
            <currentMeta.icon className="relative size-6" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
              Step {currentIndex + 1} of {STAGE_FLOW.length}
            </div>
            <h2 className="mt-1 font-display text-2xl font-semibold leading-tight tracking-tight text-ink sm:text-3xl">
              {currentMeta.title}
            </h2>
            <p className="mt-1.5 text-sm text-ink-muted">{currentMeta.sub}</p>
          </div>
        </div>

        {/* Stage progress bar */}
        <div className="mt-6">
          <div className="flex items-center justify-between text-[11px] text-ink-subtle">
            <span>{titles.estSeconds}</span>
            <span className="font-mono">{elapsed}s elapsed</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-elevated">
            <div
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-700 ease-out"
              style={{
                width: `${Math.min(100, ((currentIndex + 0.6) / STAGE_FLOW.length) * 100)}%`,
              }}
            />
          </div>
          <ol className="mt-3 grid grid-cols-5 gap-1.5">
            {STAGE_FLOW.map((s, i) => {
              const meta = STAGE_META[s];
              const isDone = i < currentIndex;
              const isActive = i === currentIndex;
              return (
                <li
                  key={s}
                  className={cn(
                    'flex flex-col items-center gap-1.5 rounded-lg px-2 py-2 text-center transition',
                    isActive && 'bg-primary-subtle',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex size-7 items-center justify-center rounded-full text-[10px] font-bold transition',
                      isDone && 'bg-primary text-primary-foreground',
                      isActive && 'bg-primary text-primary-foreground shadow-glow',
                      !isDone && !isActive && 'bg-surface-elevated text-ink-subtle',
                    )}
                  >
                    {isDone ? <CheckCircle2 className="size-3.5" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      'hidden text-[10px] font-medium leading-tight sm:block',
                      isActive && 'text-primary',
                      isDone && 'text-ink',
                      !isDone && !isActive && 'text-ink-subtle',
                    )}
                  >
                    {meta.short}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        {/* Live progressStep from server (more granular than stage) */}
        {step && (
          <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1.5 text-xs text-ink-muted">
            <Loader2 className="size-3 animate-spin text-primary" />
            <span>{step}</span>
          </div>
        )}

        {/* Knowledge tidbit — rotates every 6s */}
        <div className="mt-7 rounded-2xl border border-accent/30 bg-accent/5 p-5">
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-accent">
            <Sparkles className="size-3" /> Did you know
          </div>
          <div key={tidbitIndex} className="mt-2 motion-safe:animate-in motion-safe:fade-in-50">
            <div className="font-display text-base font-semibold leading-snug text-ink">
              {tidbit.headline}
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{tidbit.body}</p>
          </div>
          <div className="mt-3 flex justify-center gap-1.5">
            {TIDBITS.map((_, i) => (
              <span
                key={i}
                aria-hidden
                className={cn(
                  'h-1 rounded-full transition-all',
                  i === tidbitIndex ? 'w-4 bg-accent' : 'w-1 bg-ink-subtle/30',
                )}
              />
            ))}
          </div>
        </div>
      </div>

      {/* ───────── Right: live findings ─────────
          Sticky on desktop, capped at viewport height so the card itself
          stays visible while the inner findings list scrolls. On mobile the
          card flows normally and the page scrolls. */}
      <div
        className="flex flex-col rounded-3xl border border-border bg-surface/40 p-6 sm:p-7 lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)]"
        style={{ scrollbarColor: 'hsl(220 18% 25%) transparent' }}
      >
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-base font-semibold text-ink">What we've found</h3>
          {snapshot ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-success">
              <CheckCircle2 className="size-3" /> Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-elevated px-2.5 py-1 text-[10px] font-medium text-ink-subtle">
              <Loader2 className="size-3 animate-spin" /> Reading
            </span>
          )}
        </div>

        {/* Inner scroll container — `min-h-0` is the magic that lets a
            flex-1 child actually become scrollable inside a flex column.
            Negative right margin + padding so the scrollbar doesn't shove
            content. Mask-image fades the top/bottom edges so cut-off rows
            don't look harshly clipped. */}
        <div
          className="-mr-3 mt-4 min-h-0 flex-1 overflow-y-auto pr-3"
          style={{
            maskImage:
              'linear-gradient(to bottom, transparent, #000 12px, #000 calc(100% - 12px), transparent)',
            WebkitMaskImage:
              'linear-gradient(to bottom, transparent, #000 12px, #000 calc(100% - 12px), transparent)',
          }}
        >
          {findings.length > 0 ? (
            <ul className="space-y-2.5 py-1">
              {findings.map((f, i) => {
                const accentBg =
                  f.tone === 'success'
                    ? 'bg-success/15 text-success'
                    : f.tone === 'warn'
                      ? 'bg-warn/15 text-warn'
                      : 'bg-primary-subtle text-primary';
                const borderTone =
                  f.tone === 'success'
                    ? 'border-success/30'
                    : f.tone === 'warn'
                      ? 'border-warn/30'
                      : 'border-border';
                return (
                  <li
                    key={f.key}
                    className={cn(
                      'flex items-start gap-3 rounded-xl border bg-background/40 p-3.5 motion-safe:animate-in motion-safe:fade-in-50 motion-safe:slide-in-from-bottom-2',
                      borderTone,
                    )}
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <span
                      className={cn(
                        'inline-flex size-8 flex-none items-center justify-center rounded-lg',
                        accentBg,
                      )}
                    >
                      <f.icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold leading-snug text-ink">
                        {f.sentence}
                      </div>
                      {f.detail && (
                        <p className="mt-1 text-xs leading-relaxed text-ink-muted">{f.detail}</p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <FindingsSkeleton />
          )}
        </div>

        <p className="mt-4 shrink-0 border-t border-border pt-4 text-[11px] text-ink-subtle">
          {titles.keepUrl}
        </p>
      </div>
    </div>
  );
}

/* ───────── Bits ───────── */

function FindingsSkeleton() {
  return (
    <div className="mt-4 space-y-2.5">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="flex items-center gap-3 rounded-xl border border-border/60 bg-background/30 p-3"
        >
          <div className="size-9 flex-none animate-pulse rounded-lg bg-surface-elevated" />
          <div className="flex-1 space-y-2">
            <div className="h-2 w-1/3 animate-pulse rounded bg-surface-elevated" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-surface-elevated" />
          </div>
        </div>
      ))}
      <p className="px-1 pt-2 text-[11px] text-ink-subtle">
        Searching the document. Findings will appear here as we extract them.
      </p>
    </div>
  );
}

function FailurePanel({
  tone,
  title,
  body,
  ctaHref,
  ctaLabel,
}: {
  tone: 'warn' | 'danger';
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}) {
  const cls = tone === 'warn' ? 'border-warn/40 bg-warn-subtle/40' : 'border-danger/40 bg-danger-subtle/40';
  const iconCls = tone === 'warn' ? 'text-warn' : 'text-danger';
  const btnCls =
    tone === 'warn'
      ? 'border-warn/40 text-ink hover:bg-warn/10'
      : 'border-danger/40 text-danger hover:bg-danger/10';
  return (
    <div className={cn('rounded-2xl border p-6', cls)}>
      <div className="flex items-start gap-3">
        <AlertCircle className={cn('mt-0.5 size-5 flex-none', iconCls)} aria-hidden />
        <div className="flex-1">
          <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
          <p className="mt-2 text-sm text-ink-muted">{body}</p>
          <a
            href={ctaHref}
            className={cn(
              'mt-4 inline-block rounded-md border bg-background/40 px-4 py-2 text-sm font-medium',
              btnCls,
            )}
          >
            {ctaLabel}
          </a>
        </div>
      </div>
    </div>
  );
}
