'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  HelpCircle,
  Info,
  LayoutDashboard,
  Lock,
  MessageCircle,
  Sparkles,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import { Badge, Button, Tab, TabList, TabPanel, Tabs, buttonVariants } from '@suraksha/ui';
import type {
  Citation,
  CoverageClarification,
  CoverageOutput,
  ExtractorOutput,
  MemberCard,
  ReportV2,
  Severity,
} from '@/server/analyse/report-v2-types';
import { cn } from '@/lib/cn';
import { ChatWidget } from './chat-widget';
import { RefineCoverageButton } from './refine-coverage-button';
import { RecomputeScoreButton } from './recompute-score-button';
import type { DemographicsFormValue } from './demographics-form';
import type { PolicyScore, ScoreComponent } from '@/server/scoring';

type TabKey = 'summary' | 'coverage' | 'members' | 'red-flags' | 'clarify' | 'actions' | 'score';
// Display order of the tab bar — tuned by perceived user relevance:
//   summary  → "what does this mean" landing
//   coverage → policy facts
//   members  → per-member coverage (sub-tabs inside, including a 'Common'
//              chip at the end for family-level notes — 2026-05-04)
//   red-flags / clarify / actions → "what do I do about it" surface
//   score    → overall Policy Health Score with breakdown, what's good,
//              and gaps (2026-05-07). Last position because it's a roll-up
//              of everything to its left.
const TAB_ORDER: readonly TabKey[] = [
  'summary',
  'coverage',
  'members',
  'red-flags',
  'clarify',
  'actions',
  'score',
] as const;
const VALID_TABS: ReadonlySet<TabKey> = new Set(TAB_ORDER);
const DEFAULT_TAB: TabKey = 'summary';

function readTabFromQuery(sp: URLSearchParams | null): TabKey {
  const raw = sp?.get('tab');
  return raw && VALID_TABS.has(raw as TabKey) ? (raw as TabKey) : DEFAULT_TAB;
}

interface Props {
  report: ReportV2;
  analysisId: string;
  locale: string;
  createdAt: string;
  expiresAt: string;
  costPaise: number;
  /** Persisted demographics (if user filled the form on upload). Seeds the refine dialog. */
  demographics: DemographicsFormValue | null;
  /** Signed-in owner → show the "My account" breadcrumb back-link. */
  showBreadcrumb?: boolean;
  /** Anonymous viewers see Summary + Red flags only; the Members /
   *  Coverage / Clarifications / Actions tabs are locked behind a
   *  sign-up prompt. Default false (anonymous). */
  isAuthenticated?: boolean;
  /** Overall PolicyScore for this analysis. Loaded server-side and passed
   *  in to avoid a client-side waterfall. Null if the scorer hasn't run
   *  (older analyses, partial-failure pipelines); the Score tab renders a
   *  graceful empty state in that case. */
  score?: PolicyScore | null;
}

/**
 * v2 report view. Renders the 3-agent pipeline output:
 *   - extractor basic facts (no interpretation)
 *   - per-member coverage cards from the coverage agent
 *   - family-level notes, red flags, what-to-do-now
 *
 * No numeric "readiness score" — intentionally removed (architecture decision:
 * a score implies precision we can't deliver; qualitative must-watch items do
 * more work). If coverage is null (partial failure), we still render the
 * extractor header + a banner inviting the user to retry coverage.
 */
export function ReportViewV2({
  report,
  analysisId,
  locale,
  createdAt,
  expiresAt,
  costPaise,
  demographics,
  showBreadcrumb,
  isAuthenticated = false,
  score = null,
}: Props) {
  const { extractor, coverage } = report;
  const daysLeft = Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000));

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<TabKey>(() => readTabFromQuery(searchParams));

  // Keep state in sync if the user uses back/forward — readTabFromQuery
  // re-derives whenever the search params change.
  useEffect(() => {
    setTab(readTabFromQuery(searchParams));
  }, [searchParams]);

  // If the URL points at a tab whose content is empty (and therefore the
  // tab chip is hidden), bounce to Summary so the user isn't staring at
  // an empty panel with no nav back.
  useEffect(() => {
    const empty =
      (tab === 'red-flags' && (coverage?.red_flags.length ?? 0) === 0) ||
      (tab === 'clarify' && (coverage?.clarifications_needed?.length ?? 0) === 0) ||
      // Family-level notes are a Members sub-tab on 2026-05-04. Score gaps
      // are added as actions on 2026-05-07. Actions tab is empty only when
      // BOTH coverage actions and score-gap actions are empty.
      (tab === 'actions' &&
        (coverage?.what_to_do_now.length ?? 0) === 0 &&
        (score ? deriveScoreGapActions(score).length : 0) === 0);
    if (empty) {
      setTab(DEFAULT_TAB);
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.delete('tab');
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, coverage]);

  const onTabChange = useCallback(
    (next: string) => {
      const t = (VALID_TABS.has(next as TabKey) ? next : DEFAULT_TAB) as TabKey;
      setTab(t);
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      if (t === DEFAULT_TAB) params.delete('tab');
      else params.set('tab', t);
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  const redFlagCount = coverage?.red_flags.length ?? 0;
  const clarifyCount = coverage?.clarifications_needed?.length ?? 0;
  const memberCount = coverage?.member_cards.length ?? extractor.basic_facts.members.length;
  // Actions = "what to do now" + medium-or-higher score gaps (2026-05-07).
  // Whenever a section scores poorly, its recommendation surfaces here
  // alongside the coverage agent's action list, so users only have one
  // place to look for "what should I do about this policy".
  const scoreGapActions = score ? deriveScoreGapActions(score) : [];
  const actionCount = (coverage?.what_to_do_now.length ?? 0) + scoreGapActions.length;

  return (
    <section className="bg-gradient-to-b from-primary-subtle/20 via-background to-background pb-16">
      {/* Print CSS — flatten every panel so save-as-PDF gives the full report.
          Scoped via data-attributes so we don't need a global stylesheet edit. */}
      <style>{`
        @media print {
          [data-tab-nav] { display: none !important; }
          [data-tab-panel] { display: block !important; }
          [data-tab-panel] + [data-tab-panel] { margin-top: 2rem; padding-top: 2rem; border-top: 1px solid #e5e7eb; }
          [data-chat-fab], [data-chat-drawer] { display: none !important; }
          [data-sticky-header] { position: static !important; }
        }
      `}</style>

      {/* Sticky compact header — always visible while scrolling within a tab. */}
      <StickyHeader
        extractor={extractor}
        daysLeft={daysLeft}
        coverage={coverage}
        showBreadcrumb={showBreadcrumb}
        locale={locale}
        isAuthenticated={isAuthenticated}
      />

      <div className="mx-auto max-w-5xl px-4 pt-6">
        {!coverage && (
          <CoverageFailedBanner
            analysisId={analysisId}
            locale={locale}
            demographics={demographics}
          />
        )}

        {/* Refine CTA was previously a hero banner ABOVE the tabs. Demoted
            2026-05-04 — a "your family" CTA can't be the primary card on
            the analysis page. The Refine CTA still surfaces in two places
            that retain conversion: the Members-tab gate (sign-up + refine)
            and the bottom-of-page row alongside Feedback. */}

        <Tabs value={tab} onChange={onTabChange} className="mt-2">
          <TabList ariaLabel="Policy analysis sections" className="sticky top-[var(--report-header-h,72px)] z-20 -mx-4 bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            {/* Order tuned by user relevance: orient → know what's covered →
                see member-level detail → spot problems → see what to ask /
                do. Counts for empty optional tabs are 0; the tab itself is
                hidden so the bar stays focused. Summary, Coverage, Members
                always show — they're the spine of the report. */}
            {/* Order locked: Summary → Coverage → Members → Red flags →
                To clarify → Actions. Spine first (orient → know facts →
                see members), then problems / questions / actions. */}
            <Tab value="summary">Summary</Tab>
            <Tab value="coverage">
              <span className="inline-flex items-center gap-1.5">
                Coverage
                {!isAuthenticated && <Lock className="size-3" aria-hidden />}
              </span>
            </Tab>
            <Tab value="members" count={memberCount} countTone="primary">
              <span className="inline-flex items-center gap-1.5">
                Members
                {!isAuthenticated && <Lock className="size-3" aria-hidden />}
              </span>
            </Tab>
            {redFlagCount > 0 && (
              <Tab value="red-flags" count={redFlagCount} countTone="danger">
                Red flags
              </Tab>
            )}
            {clarifyCount > 0 && (
              <Tab value="clarify" count={clarifyCount} countTone="warn">
                <span className="inline-flex items-center gap-1.5">
                  To clarify
                  {!isAuthenticated && <Lock className="size-3" aria-hidden />}
                </span>
              </Tab>
            )}
            {actionCount > 0 && (
              <Tab value="actions" count={actionCount} countTone="primary">
                <span className="inline-flex items-center gap-1.5">
                  Actions
                  {!isAuthenticated && <Lock className="size-3" aria-hidden />}
                </span>
              </Tab>
            )}
            {/* Score tab — last position. Always renders (even when score is
                null) so users can see "scoring not yet available" and know
                the surface exists; otherwise the tab silently disappearing
                feels like a bug. */}
            <Tab
              value="score"
              count={score ? scorePct(score) : undefined}
              countTone={score ? scoreBadgeTone(score) : 'primary'}
            >
              <span className="inline-flex items-center gap-1.5">
                Policy Score
                {!isAuthenticated && <Lock className="size-3" aria-hidden />}
              </span>
            </Tab>
          </TabList>

          {/* Summary tab — quick-summary tile + member-quick view + key facts at a glance. */}
          <TabPanel value="summary" className="mt-6 space-y-6 focus-visible:outline-none">
            {coverage ? (
              <>
                <QuickSummary coverage={coverage} />
                <SummaryCallouts
                  coverage={coverage}
                  onJumpTab={onTabChange}
                />
              </>
            ) : (
              <p className="rounded-xl border border-border bg-card p-6 text-sm text-ink-muted">
                Coverage analysis didn't finish — see the banner above to retry. Basic facts are still available under the Coverage tab.
              </p>
            )}
            <BasicFactsCompact extractor={extractor} />
          </TabPanel>

          {/* Red flags — only what the document says is bad. */}
          <TabPanel value="red-flags" className="mt-6 space-y-4 focus-visible:outline-none">
            {coverage && coverage.red_flags.length > 0 ? (
              <RedFlagsBlock coverage={coverage} extractor={extractor} />
            ) : (
              <EmptyState
                icon={<CheckCircle2 className="size-6 text-success" />}
                title="No red flags found"
                detail="Nothing the document says raises an immediate concern. Check the To clarify tab for things the policy doesn't state — those still need answers from your insurer."
              />
            )}
          </TabPanel>

          {/* To clarify — gaps in the document, NOT problems. Asked of insurer. */}
          <TabPanel value="clarify" className="mt-6 space-y-4 focus-visible:outline-none">
            {!isAuthenticated ? (
              <SignUpGate
                locale={locale}
                analysisId={analysisId}
                title="See the questions to ask your insurer"
                bullets={[
                  'Verbatim questions you can copy-paste to the insurer or TPA',
                  'Why each gap matters for YOUR family',
                  'Severity flags so you know what to chase first',
                ]}
                tone="warn"
              />
            ) : coverage && (coverage.clarifications_needed?.length ?? 0) > 0 ? (
              <ClarificationsBlock items={coverage.clarifications_needed!} />
            ) : (
              <EmptyState
                icon={<CheckCircle2 className="size-6 text-success" />}
                title="Nothing to clarify"
                detail="The policy document covers every key point we'd otherwise ask the insurer about."
              />
            )}
          </TabPanel>

          {/* Members tab — per-member coverage with a sub-tab strip. The
              last chip is "Common" (family-wide notes), shown when family-
              level notes exist. */}
          <TabPanel value="members" className="mt-6 space-y-4 focus-visible:outline-none">
            {!isAuthenticated ? (
              <SignUpGate
                locale={locale}
                analysisId={analysisId}
                title="See coverage tailored to each family member"
                bullets={[
                  'Per-member cards (parents, spouse, children) — what is and isn\'t covered',
                  'Pre-existing-condition aware: diabetes, hypertension, etc.',
                  'Conditional coverage and must-watch items called out',
                ]}
                tone="primary"
              />
            ) : coverage && (coverage.member_cards.length > 0 || coverage.family_level_notes.length > 0) ? (
              <MemberCards coverage={coverage} extractor={extractor} />
            ) : (
              <EmptyState
                icon={<Users className="size-6 text-ink-muted" />}
                title="No member-level cards yet"
                detail="Add or update demographics from the policy header and re-run coverage."
              />
            )}
          </TabPanel>


          {/* Coverage details tab — extractor facts. */}
          <TabPanel value="coverage" className="mt-6 space-y-4 focus-visible:outline-none">
            {!isAuthenticated ? (
              <SignUpGate
                locale={locale}
                analysisId={analysisId}
                title="See full coverage details"
                bullets={[
                  'All sub-limits, exclusions, waiting periods with exact wording',
                  'Co-pay, deductible, and renewal/portability clauses',
                  'Riders, boosters (NCB/Restore/Inflation), additional benefits',
                ]}
                tone="primary"
              />
            ) : (
              <BasicFacts extractor={extractor} />
            )}
          </TabPanel>

          {/* Actions tab. */}
          <TabPanel value="actions" className="mt-6 space-y-4 focus-visible:outline-none">
            {!isAuthenticated ? (
              <SignUpGate
                locale={locale}
                analysisId={analysisId}
                title="See what to do next, in order"
                bullets={[
                  'Concrete actions ranked by urgency',
                  'Why each action matters with supporting citations',
                  'One-click follow-up chat for any clause',
                ]}
                tone="primary"
              />
            ) : coverage && (coverage.what_to_do_now.length > 0 || scoreGapActions.length > 0) ? (
              <>
                {coverage.what_to_do_now.length > 0 && <WhatToDoNow coverage={coverage} />}
                {scoreGapActions.length > 0 && <ScoreGapActions gaps={scoreGapActions} />}
              </>
            ) : (
              <EmptyState
                icon={<Info className="size-6 text-ink-muted" />}
                title="No urgent actions"
                detail="The agent didn't flag anything you need to do immediately. Revisit if your family situation changes."
              />
            )}
          </TabPanel>

          {/* Score tab — overall Policy Health Score with a 3-block body:
              the headline number + band, what's going well, and what's
              dragging the score down. Authenticated-only because the gap
              breakdown is the kind of detail we gate behind sign-up. */}
          <TabPanel value="score" className="mt-6 space-y-6 focus-visible:outline-none">
            {!isAuthenticated ? (
              <SignUpGate
                locale={locale}
                analysisId={analysisId}
                title="See your overall Policy Health Score"
                bullets={[
                  'Single 0–100 score with a plain-English band',
                  'Section-by-section breakdown — what helped, what hurt',
                  'Concrete recommendations for each gap',
                ]}
                tone="primary"
              />
            ) : score ? (
              <ScoreTabContent score={score} analysisId={analysisId} />
            ) : (
              <div>
                <EmptyState
                  icon={<Sparkles className="size-6 text-ink-muted" />}
                  title="Score not available yet"
                  detail="The scorer didn't run when this analysis was generated, or the run didn't save. Click below to compute one now."
                />
                <RecomputeScoreButton analysisId={analysisId} />
              </div>
            )}
          </TabPanel>
        </Tabs>

        {/* Bottom action row + footer disclaimer removed 2026-05-07 at user
            request — Refine CTA, "Was this analysis helpful?" thumbs, and
            the "Expires in N days · AI-generated…" strip. The Refine CTA
            still appears on the Members-tab sign-up gate when relevant. */}
      </div>

      {/* Floating chat — FAB on mobile, side drawer on desktop.
          Suggestions are derived from THIS analysis's clarifications,
          red flags, must-watch items, and waiting periods so the chips
          are always grounded in what the user actually saw, never
          generic. (2026-05-04 — replaces hardcoded fallbacks that asked
          about maternity even on policies without maternity cover.) */}
      <ChatFab
        analysisId={analysisId}
        piiWarning={coverage?.pii_warning}
        suggestions={deriveChatSuggestions(coverage, extractor)}
      />
    </section>
  );
}

/* ───────── New components ───────── */

// RefineHeadlineBanner removed 2026-05-04 — a "your family" CTA must not
// be the primary card on the analysis page. The Refine CTA now lives in
// two contextual places: the Members-tab sign-up gate (for unauth users)
// and the bottom-of-page action row alongside Feedback (for auth users).

function StickyHeader({
  extractor,
  daysLeft,
  coverage,
  showBreadcrumb,
  locale,
  isAuthenticated,
}: {
  extractor: ExtractorOutput;
  daysLeft: number;
  coverage: CoverageOutput | null;
  showBreadcrumb: boolean | undefined;
  locale: string;
  isAuthenticated: boolean;
}) {
  const bf = extractor.basic_facts;
  const verdict = coverage ? overallVerdict(coverage) : null;
  return (
    <div
      data-sticky-header
      className="sticky top-0 z-30 border-b border-border/60 bg-background/85 backdrop-blur supports-[backdrop-filter]:bg-background/60"
      style={{ ['--report-header-h' as string]: '72px' }}
    >
      <div className="mx-auto max-w-5xl px-4 py-3">
        {showBreadcrumb && (
          <nav className="mb-1 flex items-center gap-1.5 text-[11px] text-ink-muted" aria-label="Breadcrumb">
            <Link href={`/${locale}/my`} className="hover:text-ink">
              My account
            </Link>
            <span className="text-ink-subtle">›</span>
            <Link href={`/${locale}/my/analyses`} className="hover:text-ink">
              Analyses
            </Link>
          </nav>
        )}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className="truncate font-display text-lg font-semibold leading-tight text-ink sm:text-xl">
              {bf.insurer_name}
              {bf.plan_name && <span className="ml-2 text-ink-muted">· {bf.plan_name}</span>}
            </h1>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-muted">
              {verdict && (
                <Badge tone={verdict.tone}>
                  <span className="mr-1 inline-block size-1.5 rounded-full bg-current align-middle" />
                  {verdict.label}
                </Badge>
              )}
              {formatRupees(bf.sum_insured_rupees) && (
                <span>SI {formatRupees(bf.sum_insured_rupees)}</span>
              )}
              {bf.family_type && <span>{humanPlanType(bf.family_type)}</span>}
              <span>
                {daysLeft} day{daysLeft === 1 ? '' : 's'} left
              </span>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {isAuthenticated && (
              <Link
                href={`/${locale}/my`}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary-subtle px-3 py-1.5 text-xs font-semibold text-primary transition hover:bg-primary/15"
              >
                <LayoutDashboard className="size-3.5" aria-hidden /> Dashboard
              </Link>
            )}
            {/* Share + PDF chips removed 2026-05-07 at user request. */}
          </div>
        </div>
      </div>
    </div>
  );
}

function overallVerdict(c: CoverageOutput): { tone: 'success' | 'warn' | 'danger'; label: string } {
  const high = c.red_flags.filter((f) => f.severity === 'high').length;
  const med = c.red_flags.filter((f) => f.severity === 'medium').length;
  if (high > 0) return { tone: 'danger', label: `${high} high-severity flag${high === 1 ? '' : 's'}` };
  if (med > 0 || c.red_flags.length > 0) return { tone: 'warn', label: 'Some concerns' };
  return { tone: 'success', label: 'Looks healthy' };
}

function SummaryCallouts({
  coverage,
  onJumpTab,
}: {
  coverage: CoverageOutput;
  onJumpTab: (next: string) => void;
}) {
  const flags = coverage.red_flags.length;
  const clarify = coverage.clarifications_needed?.length ?? 0;
  const actions = coverage.what_to_do_now.length;
  // Tiles for non-empty surfaces only — mirrors the tab-bar's hide-empty
  // rule so the summary doesn't surface a "0 / None found" callout that
  // links to a tab the user can't see anyway.
  const tiles: Array<{
    key: TabKey;
    icon: React.ReactNode;
    label: string;
    n: number;
    tone: string;
    detail: string;
  }> = [];
  if (flags > 0) {
    tiles.push({
      key: 'red-flags',
      icon: <AlertTriangle className="size-4" />,
      label: 'Red flags',
      n: flags,
      tone: 'border-danger/40 bg-danger/5 text-danger',
      detail: 'Things the policy says that may hurt',
    });
  }
  if (clarify > 0) {
    tiles.push({
      key: 'clarify',
      icon: <HelpCircle className="size-4" />,
      label: 'To clarify',
      n: clarify,
      tone: 'border-warn/40 bg-warn-subtle/40 text-warn',
      detail: 'Ask the insurer these',
    });
  }
  if (actions > 0) {
    tiles.push({
      key: 'actions',
      icon: <ArrowRight className="size-4" />,
      label: 'Actions',
      n: actions,
      tone: 'border-primary/40 bg-primary-subtle/40 text-primary',
      detail: 'What to do next',
    });
  }
  if (tiles.length === 0) return null;
  return (
    <div
      className={cn(
        'grid grid-cols-1 gap-3',
        tiles.length === 2 ? 'sm:grid-cols-2' : tiles.length >= 3 ? 'sm:grid-cols-3' : '',
      )}
    >
      {tiles.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onJumpTab(t.key)}
          className={cn(
            'flex flex-col items-start gap-1.5 rounded-xl border p-4 text-left transition hover:shadow-card',
            t.tone,
          )}
        >
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
            {t.icon}
            {t.label}
          </div>
          <div className="font-display text-2xl font-semibold text-ink">{t.n}</div>
          <div className="text-xs text-ink-muted">{t.detail}</div>
        </button>
      ))}
    </div>
  );
}

function BasicFactsCompact({ extractor }: { extractor: ExtractorOutput }) {
  const bf = extractor.basic_facts;
  const tiles: Array<{ label: string; value: string | null }> = [
    { label: 'Sum insured', value: formatRupees(bf.sum_insured_rupees) },
    { label: 'Premium', value: formatRupees(bf.premium_rupees) },
    { label: 'Period', value: formatPeriod(bf.period_start, bf.period_end) },
    {
      label: 'Members',
      value: bf.members.length ? `${bf.members.length}` : null,
    },
  ];
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
        Key facts
      </h2>
      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
        {tiles.map((t) => (
          <div key={t.label}>
            <dt className="text-[11px] uppercase tracking-wider text-ink-subtle">{t.label}</dt>
            <dd className="mt-0.5 font-display text-base font-semibold text-ink">{t.value ?? '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ClarificationsBlock({ items }: { items: CoverageClarification[] }) {
  return (
    <div>
      <div className="mb-3 flex items-start gap-3 rounded-xl border border-warn/40 bg-warn-subtle/40 p-4">
        <HelpCircle className="mt-0.5 size-5 flex-none text-warn" />
        <div>
          <h2 className="font-display text-sm font-semibold text-ink">
            Things the document doesn't say — ask your insurer
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            We only state what's actually written in your policy. These items aren't problems with the
            policy — they're facts the document didn't include. Use the questions below verbatim when you
            call the insurer or TPA.
          </p>
        </div>
      </div>
      <ol className="space-y-3">
        {items.map((c, i) => (
          <li
            key={i}
            className={cn(
              'rounded-xl border-l-4 bg-card p-4 shadow-card',
              c.severity === 'high'
                ? 'border-warn'
                : c.severity === 'medium'
                  ? 'border-warn/60'
                  : 'border-border',
            )}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink">{c.question}</span>
              <Badge tone={severityTone(c.severity)}>{c.severity}</Badge>
            </div>
            <p className="mt-1 text-sm text-ink-muted">{c.why_it_matters}</p>
            <div className="mt-2 rounded-md bg-background/60 p-3 text-sm">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-subtle">
                Ask the insurer
              </div>
              <p className="mt-0.5 text-ink">"{c.ask_the_insurer}"</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  detail,
}: {
  icon: React.ReactNode;
  title: string;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card p-8 text-center">
      <div className="mx-auto mb-2 inline-flex size-10 items-center justify-center rounded-full bg-background">
        {icon}
      </div>
      <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
      <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">{detail}</p>
    </div>
  );
}

/**
 * Anonymous sign-up wall for gated tabs. Summary + Red flags are free; this
 * panel renders inside Members / Coverage / Clarifications / Actions for
 * unauth viewers. Returning here after signing up keeps the same analysis id
 * via `next=` so they don't lose the report.
 */
function SignUpGate({
  locale,
  analysisId,
  title,
  bullets,
  tone,
}: {
  locale: string;
  analysisId: string;
  title: string;
  bullets: string[];
  tone: 'primary' | 'warn';
}) {
  const next = encodeURIComponent(
    `/${locale}/policy-health-score/analysis/${analysisId}`,
  );
  const accentBg = tone === 'warn' ? 'bg-warn-subtle/40' : 'bg-mint-glow';
  const accentBorder = tone === 'warn' ? 'border-warn/40' : 'border-primary/40';
  const accentText = tone === 'warn' ? 'text-warn' : 'text-primary';
  return (
    <div
      className={cn(
        'rounded-2xl border p-6 sm:p-10',
        accentBorder,
        accentBg,
      )}
    >
      <div className="mx-auto max-w-xl text-center">
        <span
          className={cn(
            'inline-flex size-12 items-center justify-center rounded-full bg-background/60',
            accentText,
          )}
        >
          <Lock className="size-5" aria-hidden />
        </span>
        <h2 className="mt-4 font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {title}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-ink-muted">
          Sign up free in 30 seconds — no card, no spam. Your analysis stays exactly where you left
          it.
        </p>
        <ul className="mx-auto mt-5 max-w-md space-y-2 text-left text-sm text-ink">
          {bullets.map((b) => (
            <li key={b} className="flex items-start gap-2.5">
              <CheckCircle2 className={cn('mt-0.5 size-4 flex-none', accentText)} />
              <span>{b}</span>
            </li>
          ))}
        </ul>
        <div className="mt-7 flex flex-col items-stretch justify-center gap-2 sm:flex-row sm:items-center">
          <Link
            href={`/${locale}/sign-up?next=${next}`}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground shadow-glow transition hover:bg-primary/90"
          >
            Sign up free <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link
            href={`/${locale}/sign-in?next=${next}`}
            className="inline-flex items-center justify-center rounded-full border border-border bg-surface/40 px-6 py-3 text-sm font-medium text-ink-muted transition hover:border-primary/40 hover:text-ink"
          >
            I already have an account
          </Link>
        </div>
        <p className="mt-4 text-[11px] text-ink-subtle">
          Phone OTP · Google · Email. We never share your data with insurers.
        </p>
      </div>
    </div>
  );
}

function ChatFab({
  analysisId,
  piiWarning,
  suggestions,
}: {
  analysisId: string;
  piiWarning?: string;
  suggestions?: string[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        data-chat-fab
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? 'Close chat' : 'Open chat'}
        className={cn(
          'fixed bottom-5 right-5 z-40 inline-flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2',
          'lg:bottom-6 lg:right-6',
        )}
      >
        {open ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
      {open && (
        <div
          data-chat-drawer
          className={cn(
            'fixed inset-x-0 bottom-0 z-30 max-h-[85vh] overflow-y-auto rounded-t-2xl border-t border-border bg-background p-4 shadow-2xl',
            'lg:left-auto lg:right-0 lg:top-[72px] lg:bottom-0 lg:h-auto lg:max-h-none lg:w-[420px] lg:max-w-[100vw] lg:rounded-none lg:border-l lg:border-t-0 lg:p-5',
          )}
        >
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
              Ask about your policy
            </h3>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="rounded-full p-1 text-ink-muted hover:bg-background hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </div>
          <ChatWidget analysisId={analysisId} piiWarning={piiWarning} suggestions={suggestions} />
        </div>
      )}
    </>
  );
}

/* ───────── Sub-components ───────── */

function Header({
  extractor,
  daysLeft,
  createdAt,
}: {
  extractor: ExtractorOutput;
  daysLeft: number;
  createdAt: string;
}) {
  const bf = extractor.basic_facts;
  const memberCount = bf.members.length;
  return (
    <div className="mb-8 rounded-3xl border border-border bg-card p-6 shadow-card sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="min-w-0 flex-1">
          <div className="inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.25em] text-primary">
            <span aria-hidden className="h-px w-7 bg-primary/60" />
            Policy analysis
          </div>
          <h1 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight text-ink sm:text-4xl md:text-5xl">
            {bf.insurer_name}
          </h1>
          {bf.plan_name && (
            <div className="mt-1 font-display text-xl text-ink-muted sm:text-2xl">
              {bf.plan_name}
            </div>
          )}

          {/* Metadata strip */}
          <dl className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs uppercase tracking-wider text-ink-subtle">
            <div className="inline-flex items-center gap-1.5">
              <span className="text-ink-subtle">Analysed</span>
              <span className="text-ink">{formatShortDate(createdAt)}</span>
            </div>
            <div className="inline-flex items-center gap-1.5">
              <span className="text-ink-subtle">Expires in</span>
              <span className="text-ink">
                {daysLeft} day{daysLeft === 1 ? '' : 's'}
              </span>
            </div>
            {memberCount > 0 && (
              <div className="inline-flex items-center gap-1.5">
                <span className="text-ink-subtle">Members</span>
                <span className="text-ink">{memberCount}</span>
              </div>
            )}
            {bf.policy_number && (
              <div className="inline-flex items-center gap-1.5">
                <span className="text-ink-subtle">Policy</span>
                <span className="font-mono text-ink normal-case tracking-normal">
                  {bf.policy_number}
                </span>
              </div>
            )}
          </dl>
        </div>

        {/* Share + PDF chips removed 2026-05-07 at user request. */}
      </div>
    </div>
  );
}

// ActionChip removed 2026-05-07 — its only consumers were the Share + PDF
// chips, which were dropped from both the StickyHeader and the BasicFacts
// hero at user request.

function QuickSummary({ coverage }: { coverage: CoverageOutput }) {
  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-5 shadow-card">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-primary-subtle p-2 text-primary">
          <Info className="size-5" aria-hidden />
        </div>
        <div>
          <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
            Quick summary
          </h2>
          <p className="mt-1 text-base leading-relaxed text-ink">{coverage.quick_summary}</p>
        </div>
      </div>
    </div>
  );
}

function CoverageFailedBanner({
  analysisId,
  locale,
  demographics,
}: {
  analysisId: string;
  locale: string;
  demographics: DemographicsFormValue | null;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-start gap-3 rounded-xl border border-warn/40 bg-warn-subtle/50 p-5">
      <AlertTriangle className="mt-0.5 size-5 flex-none text-warn" />
      <div className="min-w-0 flex-1">
        <h2 className="font-display text-base font-semibold text-ink">
          We extracted your policy, but the coverage analysis didn't finish
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          The basic facts below are yours to keep. Click retry to build per-member cards — it uses
          the same extractor output, so you won't be charged for a second PDF pass.
        </p>
      </div>
      {/* Reuses the refine flow: it re-runs only the coverage agent against the
          existing extractor output. Same operation as "retry coverage". */}
      <RefineCoverageButton
        analysisId={analysisId}
        locale={locale}
        initialDemographics={demographics}
      />
    </div>
  );
}

function BasicFacts({ extractor }: { extractor: ExtractorOutput }) {
  const bf = extractor.basic_facts;
  const rows: Array<{ label: string; value: string | null }> = [
    { label: 'Policy number', value: bf.policy_number || null },
    { label: 'Family type', value: humanPlanType(bf.family_type) },
    { label: 'Plan type', value: humanPlanType(bf.plan_type) },
    { label: 'Sum insured', value: formatRupees(bf.sum_insured_rupees) },
    { label: 'Premium', value: formatRupees(bf.premium_rupees) },
    { label: 'Period', value: formatPeriod(bf.period_start, bf.period_end) },
    {
      label: 'Nominee',
      value: bf.nominee_name
        ? `${bf.nominee_name}${bf.nominee_relation ? ` (${bf.nominee_relation})` : ''}`
        : null,
    },
    {
      label: 'Network hospitals',
      value: bf.network_hospital_count ? bf.network_hospital_count.toLocaleString('en-IN') : null,
    },
  ];

  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-5 shadow-card">
      <h2 className="font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
        Basic facts
      </h2>
      <dl className="mt-3 grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.label}
            className="flex justify-between gap-3 border-b border-border/50 py-1.5 last:border-0"
          >
            <dt className="text-sm text-ink-muted">{r.label}</dt>
            <dd className="text-right text-sm font-medium text-ink">{r.value ?? '—'}</dd>
          </div>
        ))}
      </dl>

      {/* Insured members — tabular so ages + PEDs are scannable */}
      {bf.members.length > 0 && (
        <div className="mt-5">
          <div className="mb-2 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-ink-muted">
            <Users className="size-3.5" aria-hidden />
            Insured members ({bf.members.length})
          </div>
          <ul className="divide-y divide-border/50 rounded-lg border border-border/60 bg-background/40">
            {bf.members.map((m, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm"
              >
                <span className="font-medium text-ink">
                  {humanPlanType(m.relation) || 'Member'}
                </span>
                <span className="text-ink-muted">
                  {m.age != null ? `${m.age} yrs` : 'age —'}
                </span>
                {m.pre_existing && m.pre_existing.length > 0 ? (
                  <div className="flex flex-wrap items-center gap-1 text-xs">
                    <span className="text-ink-subtle">PED:</span>
                    {m.pre_existing.map((p) => (
                      <Badge key={p} tone="warn">
                        {p}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-ink-subtle">No PEDs declared</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

    </div>
  );
}

/**
 * Full extractor data — coverage sections, exclusions, waiting periods,
 * sub-limits, copay, riders, renewal/portability, grievance contacts.
 * Rendered inline on the Coverage tab; sections that have no data are
 * silently skipped (no "0 exclusions" labels). The disclosure wrapper was
 * removed — the Coverage tab is the right home for this content, hiding it
 * behind another click added no value.
 */
function DetailedPolicyInfo({ extractor }: { extractor: ExtractorOutput }) {
  const { coverage_sections, exclusions, waiting_periods, sub_limits, copay, riders, renewal_and_portability, grievance_contacts } = extractor;

  return (
    <div className="mt-6 space-y-6">
      {coverage_sections.length > 0 && (
          <DetailBlock title="Coverage sections">
            <ul className="space-y-2">
              {coverage_sections.map((s) => (
                <li key={s.id} className="rounded-md border border-border bg-card p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink">{s.name}</span>
                    <Badge tone="neutral">{s.category.replace(/_/g, ' ')}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-ink-muted">{s.summary}</p>
                  <CitationFootnote citation={s.citation} />
                </li>
              ))}
            </ul>
          </DetailBlock>
        )}

        {exclusions.length > 0 && (
          <DetailBlock title="Exclusions">
            <ul className="space-y-2">
              {exclusions.map((e) => (
                <li key={e.id} className="rounded-md border border-danger/20 bg-danger/5 p-3">
                  <p className="text-sm text-ink">{e.text}</p>
                  <CitationFootnote citation={e.citation} />
                </li>
              ))}
            </ul>
          </DetailBlock>
        )}

        {waiting_periods.length > 0 && (
          <DetailBlock title="Waiting periods">
            <ul className="space-y-2">
              {waiting_periods.map((w) => (
                <li key={w.id} className="rounded-md border border-warn/30 bg-warn-subtle/50 p-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium text-ink capitalize">{w.condition}</span>
                    {w.wait_days != null && (
                      <Badge tone="warn">
                        {w.wait_days} day{w.wait_days === 1 ? '' : 's'}
                      </Badge>
                    )}
                  </div>
                  {w.notes && <p className="mt-1 text-sm text-ink-muted">{w.notes}</p>}
                  <CitationFootnote citation={w.citation} />
                </li>
              ))}
            </ul>
          </DetailBlock>
        )}

        {sub_limits.length > 0 && (
          <DetailBlock title="Sub-limits">
            <ul className="space-y-2">
              {sub_limits.map((s) => (
                <li key={s.id} className="rounded-md border border-border bg-card p-3">
                  <div className="text-sm font-medium text-ink">{s.name}</div>
                  <p className="mt-1 text-sm text-ink-muted">{s.cap_text}</p>
                  <CitationFootnote citation={s.citation} />
                </li>
              ))}
            </ul>
          </DetailBlock>
        )}

        {(copay.voluntary_percentage != null ||
          copay.mandatory_percentage != null ||
          copay.age_triggered ||
          copay.deductible_rupees != null ||
          copay.explanation) && (
          <DetailBlock title="Co-pay & deductible">
            <div className="rounded-md border border-border bg-card p-3">
              <dl className="grid grid-cols-1 gap-y-1 text-sm sm:grid-cols-2">
                {copay.voluntary_percentage != null && (
                  <DetailRow label="Voluntary co-pay" value={`${copay.voluntary_percentage}%`} />
                )}
                {copay.mandatory_percentage != null && (
                  <DetailRow label="Mandatory co-pay" value={`${copay.mandatory_percentage}%`} />
                )}
                {copay.age_triggered && (
                  <DetailRow
                    label="Age-triggered"
                    value={`${copay.age_triggered.percentage}% from age ${copay.age_triggered.from_age}`}
                  />
                )}
                {copay.deductible_rupees != null && (
                  <DetailRow label="Deductible" value={formatRupees(copay.deductible_rupees) ?? '—'} />
                )}
              </dl>
              {copay.explanation && (
                <p className="mt-2 text-sm text-ink-muted">{copay.explanation}</p>
              )}
              {copay.citation && <CitationFootnote citation={copay.citation} />}
            </div>
          </DetailBlock>
        )}

        {riders.length > 0 && (
          <DetailBlock title="Riders">
            <ul className="space-y-2">
              {riders.map((r, i) => (
                <li key={i} className="rounded-md border border-border bg-card p-3">
                  <div className="text-sm font-medium text-ink">{r.name}</div>
                  <p className="mt-1 text-sm text-ink-muted">{r.summary}</p>
                  <CitationFootnote citation={r.citation} />
                </li>
              ))}
            </ul>
          </DetailBlock>
        )}

        {(renewal_and_portability.renewal_clause || renewal_and_portability.portability_clause) && (
          <DetailBlock title="Renewal &amp; portability">
            <div className="space-y-3 rounded-md border border-border bg-card p-3 text-sm">
              {renewal_and_portability.renewal_clause && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-ink-subtle">Renewal</div>
                  <p className="mt-1 text-ink">{renewal_and_portability.renewal_clause}</p>
                </div>
              )}
              {renewal_and_portability.portability_clause && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-ink-subtle">Portability</div>
                  <p className="mt-1 text-ink">{renewal_and_portability.portability_clause}</p>
                </div>
              )}
            </div>
          </DetailBlock>
        )}

        {(grievance_contacts.insurer_grievance ||
          grievance_contacts.ombudsman ||
          grievance_contacts.tpa) && (
          <DetailBlock title="Grievance contacts">
            <dl className="rounded-md border border-border bg-card p-3">
              {grievance_contacts.insurer_grievance && (
                <DetailRow label="Insurer grievance" value={grievance_contacts.insurer_grievance} />
              )}
              {grievance_contacts.ombudsman && (
                <DetailRow label="Ombudsman" value={grievance_contacts.ombudsman} />
              )}
              {grievance_contacts.tpa && <DetailRow label="TPA" value={grievance_contacts.tpa} />}
            </dl>
          </DetailBlock>
        )}
    </div>
  );
}

function DetailBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 font-display text-xs font-semibold uppercase tracking-wider text-ink-muted">
        {title}
      </h3>
      {children}
    </section>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-border/40 py-1.5 text-sm last:border-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="text-right font-medium text-ink">{value}</dd>
    </div>
  );
}

function CitationFootnote(_: {
  citation: { page: number; section_label: string; quoted_text: string };
}) {
  // Citations hidden in the customer-facing report — the page + quote info
  // is preserved on the underlying extractor JSON for the chat agent and the
  // admin trace, but rendering it inline made every row noisier than the
  // claim it cited. Re-enable by restoring the previous body.
  return null;
}

function RedFlagsBlock({
  coverage,
  extractor,
}: {
  coverage: CoverageOutput;
  extractor: ExtractorOutput;
}) {
  if (coverage.red_flags.length === 0) return null;
  return (
    <div className="mb-6">
      <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
        Red flags ({coverage.red_flags.length})
      </h2>
      <div className="space-y-3">
        {coverage.red_flags.map((f, i) => (
          <div
            key={i}
            className={cn(
              'rounded-xl border-l-4 bg-card p-4 shadow-card',
              severityBorder(f.severity),
            )}
          >
            <div className="flex items-start gap-3">
              <AlertTriangle className={cn('mt-0.5 size-5 flex-none', severityIcon(f.severity))} />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-ink">{f.title}</h3>
                  <Badge tone={severityTone(f.severity)}>{f.severity}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-muted">{f.why_it_matters}</p>
                <p className="mt-2 text-sm font-medium text-ink">→ {f.action}</p>
                <CitationLine extractor={extractor} refId={f.citation_ref} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Members-tab body — per-member coverage with a sub-tab strip.
 *
 *   * Horizontal chip strip, one chip per member_card, plus a final
 *     "Common" chip when family-level notes exist (2026-05-04). The
 *     chip surfaces the must-watch / note count as a small badge so
 *     users can jump to the chip with the most context first.
 *   * Body slot renders the selected member's MemberCardView, or
 *     FamilyNotes when "Common" is selected.
 *
 * The chip strip is hidden when there is only one chip total (one member
 * + no notes, or no members + only notes) — showing one chip with no
 * alternatives is noise.
 */
const COMMON_REF = '__common__';

function MemberCards({ coverage, extractor }: { coverage: CoverageOutput; extractor: ExtractorOutput }) {
  const cards = coverage.member_cards;
  const hasNotes = coverage.family_level_notes.length > 0;
  // Common is its own chip ONLY when there are 2+ insured members. With a
  // single insured, "family-level" notes really apply to that one person —
  // we merge them into the member's panel instead of creating an
  // empty-feeling Common tab. (Decision 2026-05-07.)
  const showCommonChip = hasNotes && cards.length > 1;

  const initialRef = cards[0]?.member_ref ?? (showCommonChip ? COMMON_REF : null);
  const [selectedRef, setSelectedRef] = useState<string | null>(initialRef);

  // If the underlying cards array changes (e.g. a Refine run replaces the
  // members), re-anchor the selection.
  useEffect(() => {
    const validRefs = new Set<string>(cards.map((c) => c.member_ref));
    if (showCommonChip) validRefs.add(COMMON_REF);
    if (validRefs.size === 0) {
      setSelectedRef(null);
      return;
    }
    if (!selectedRef || !validRefs.has(selectedRef)) {
      setSelectedRef(cards[0]?.member_ref ?? (showCommonChip ? COMMON_REF : null));
    }
  }, [cards, showCommonChip, selectedRef]);

  if (cards.length === 0 && !hasNotes) return null;

  const totalChips = cards.length + (showCommonChip ? 1 : 0);
  const isCommonSelected = selectedRef === COMMON_REF;
  const selectedCard = cards.find((c) => c.member_ref === selectedRef) ?? null;
  const isSingleInsuredWithNotes = cards.length === 1 && hasNotes;

  return (
    <div className="mb-6">
      <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
        Coverage, by member
      </h2>

      {totalChips > 1 && (
        <div
          role="tablist"
          aria-label="Members"
          className="-mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1 pb-1"
        >
          {cards.map((card) => {
            const isActive = selectedRef === card.member_ref;
            const issues = card.must_watch_items.length;
            return (
              <button
                key={card.member_ref}
                role="tab"
                aria-selected={isActive}
                type="button"
                onClick={() => setSelectedRef(card.member_ref)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                    : 'border-border bg-card text-ink hover:border-primary/50',
                )}
              >
                <span className="font-medium">{card.display_label}</span>
                {issues > 0 && (
                  <span
                    className={cn(
                      'inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[11px] font-semibold',
                      isActive
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-warn/15 text-warn',
                    )}
                    aria-label={`${issues} must-watch ${issues === 1 ? 'item' : 'items'}`}
                  >
                    {issues}
                  </span>
                )}
              </button>
            );
          })}
          {showCommonChip && (
            <button
              key={COMMON_REF}
              role="tab"
              aria-selected={isCommonSelected}
              type="button"
              onClick={() => setSelectedRef(COMMON_REF)}
              title="Notes that apply across every member"
              className={cn(
                'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                isCommonSelected
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-card text-ink hover:border-primary/50',
              )}
            >
              <span className="font-medium">Common</span>
              <span
                className={cn(
                  'inline-flex min-w-[1.25rem] items-center justify-center rounded-full px-1 text-[11px] font-semibold',
                  isCommonSelected
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-primary/15 text-primary',
                )}
                aria-label={`${coverage.family_level_notes.length} family-level ${coverage.family_level_notes.length === 1 ? 'note' : 'notes'}`}
              >
                {coverage.family_level_notes.length}
              </span>
            </button>
          )}
        </div>
      )}

      {isCommonSelected ? (
        <FamilyNotes coverage={coverage} />
      ) : selectedCard ? (
        <>
          <MemberCardView card={selectedCard} extractor={extractor} />
          {/* Single-insured policies: merge family-level notes into the
              same panel as the lone member's view (no separate Common
              chip). The notes still apply to "the policy" but with one
              person on it, that's effectively one card. (2026-05-07.) */}
          {isSingleInsuredWithNotes && (
            <div className="mt-4">
              <FamilyNotes coverage={coverage} />
            </div>
          )}
        </>
      ) : hasNotes ? (
        // No member_cards at all but notes exist (rare — coverage agent
        // didn't synthesize members) — render notes directly.
        <FamilyNotes coverage={coverage} />
      ) : null}
    </div>
  );
}

function MemberCardView({ card, extractor }: { card: MemberCard; extractor: ExtractorOutput }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="font-display text-base font-semibold text-ink">{card.display_label}</h3>

      {card.what_is_covered.length > 0 && (
        <SectionTable
          icon={<CheckCircle2 className="size-4 text-success" />}
          label="What's covered"
          accent="success"
          rows={card.what_is_covered.map((it) => ({
            title: it.title,
            detail: it.detail,
            bullets: it.bullets,
          }))}
        />
      )}

      {card.conditional_coverage.length > 0 && (
        <SectionTable
          icon={<Info className="size-4 text-warning" />}
          label="Conditional"
          accent="warn"
          rows={card.conditional_coverage.map((it) => ({
            title: it.title,
            // Condition tag is part of the row meta — surface as a badge
            // rather than mashing into the detail string.
            badges: it.condition ? <Badge tone="warn">{it.condition}</Badge> : null,
            detail: it.detail,
            bullets: it.bullets,
          }))}
        />
      )}

      {card.what_is_not_covered.length > 0 && (
        <SectionTable
          icon={<XCircle className="size-4 text-danger" />}
          label="Not covered"
          accent="danger"
          rows={card.what_is_not_covered.map((it) => ({
            title: it.title,
            detail: it.detail,
            bullets: it.bullets,
          }))}
        />
      )}

      {card.must_watch_items.length > 0 && (
        <SectionTable
          icon={<AlertTriangle className="size-4 text-warning" />}
          label="Must-watch items"
          accent="warn"
          rows={card.must_watch_items.map((it) => ({
            title: it.title,
            badges: <Badge tone={severityTone(it.severity)}>{it.severity}</Badge>,
            detail: it.why_it_matters,
          }))}
        />
      )}
    </div>
  );
}

interface SectionTableRow {
  title: string;
  detail?: string;
  bullets?: string[];
  badges?: React.ReactNode;
}

/**
 * 2-column scannable layout for per-member coverage sections. Column 1 is
 * the heading (e.g. "Hospitalisation up to ₹7 Lakh"); column 2 holds the
 * full detail — short paragraph + optional bullet list for multi-point
 * items (pre/post hospitalisation, etc.). Stacks vertically on narrow
 * viewports so the title doesn't get crushed at 375px.
 */
function SectionTable({
  icon,
  label,
  rows,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  rows: SectionTableRow[];
  accent: 'success' | 'warn' | 'danger' | 'neutral';
}) {
  const accentLine =
    accent === 'success'
      ? 'border-l-success/60'
      : accent === 'warn'
        ? 'border-l-warn/60'
        : accent === 'danger'
          ? 'border-l-danger/60'
          : 'border-l-border';
  // Header skipped when caller passes an empty label (used by ScoreList,
  // which renders its own h3 above the table). Avoids a stray mb-2 gap.
  const showHeader = !!label;
  return (
    <div className="mt-5">
      {showHeader && (
        <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-muted">
          {icon}
          {label}
        </div>
      )}
      <div
        className={cn(
          'overflow-hidden rounded-lg border border-l-4 border-border bg-background/40',
          accentLine,
        )}
      >
        <table className="w-full text-sm">
          <tbody className="divide-y divide-border">
            {rows.map((r, i) => {
              const hasBullets = Array.isArray(r.bullets) && r.bullets.length > 0;
              return (
                <tr key={i} className="block align-top sm:table-row">
                  <th className="block px-3 pt-3 pb-1 text-left text-sm font-semibold text-ink sm:table-cell sm:w-1/3 sm:py-3 sm:pb-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span>{r.title}</span>
                      {r.badges}
                    </div>
                  </th>
                  <td className="block px-3 pb-3 sm:table-cell sm:py-3 sm:pl-2">
                    {r.detail && (
                      <p className={cn('text-sm', hasBullets ? 'text-ink-subtle' : 'text-ink-muted')}>
                        {r.detail}
                      </p>
                    )}
                    {hasBullets && (
                      <ul className={cn('space-y-1.5 pl-1', r.detail && 'mt-2')}>
                        {r.bullets!.map((b, j) => (
                          <li key={j} className="flex gap-2 text-sm">
                            <span aria-hidden className="mt-1.5 size-1.5 flex-none rounded-full bg-ink-subtle" />
                            <span className="text-ink">{b}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function CitationLine(_: { extractor: ExtractorOutput; refId: string }) {
  // Hidden in the customer-facing report — see CitationFootnote above.
  return null;
}

/**
 * Renders family-level notes — context that applies across every member of
 * the policy. Rendered as the body of the 'Common' chip in the Members
 * sub-tab strip (2026-05-04). Wrapped in the same card+SectionTable scaffold
 * as MemberCardView so visual treatment is identical and users can scan
 * it the same way (multi-column title / detail).
 */
function FamilyNotes({ coverage }: { coverage: CoverageOutput }) {
  if (coverage.family_level_notes.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="font-display text-base font-semibold text-ink">
        Notes for the whole family
      </h3>
      <p className="mt-1 text-sm text-ink-muted">
        Things that apply across every member — shared limits, family-floater quirks, and policy-wide benefits.
      </p>
      <SectionTable
        icon={<Users className="size-4 text-primary" />}
        label="Family-level notes"
        accent="neutral"
        rows={coverage.family_level_notes.map((n) => ({
          title: n.title,
          detail: n.detail,
        }))}
      />
    </div>
  );
}

function WhatToDoNow({ coverage }: { coverage: CoverageOutput }) {
  if (coverage.what_to_do_now.length === 0) return null;
  return (
    <div className="mb-6">
      <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
        What to do now
      </h2>
      <ol className="space-y-3">
        {coverage.what_to_do_now.map((a, i) => (
          <li key={i} className="rounded-xl border border-border bg-card p-4 shadow-card">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink">{i + 1}. {a.title}</span>
              <Badge tone={urgencyTone(a.urgency)}>{urgencyLabel(a.urgency)}</Badge>
            </div>
            <p className="mt-1 text-sm text-ink-muted">{a.why}</p>
            <p className="mt-1 text-sm text-ink">→ {a.how}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

// Footer removed 2026-05-07 at user request — the "Expires in N days /
// AI-generated disclaimer" strip below the tabs. Expiry information is
// still surfaced in the StickyHeader's metadata strip.

/* ───────── Helpers ───────── */

/**
 * Build chat starter chips grounded in THIS analysis. The chips a user
 * sees should always reference something they've actually been shown (a
 * red flag, a must-watch item, a waiting period from the document) —
 * never a generic question about a benefit that may not even be in their
 * policy. Sources, in priority order:
 *
 *   1. clarifications_needed[] — verbatim "ask the insurer" questions
 *   2. red_flags[]              — "What does '<title>' mean for me?"
 *   3. member must_watch_items  — "Tell me more about <title>"
 *   4. waiting_periods[]        — "What's the waiting period for <condition>?"
 *   5. exclusions[]             — "Why is <title> excluded?"
 *   6. generic safe fallbacks   — only when nothing else exists
 *
 * Caps at 3 chips, dedupes by exact string, truncates each to ~80 chars.
 */
function deriveChatSuggestions(
  coverage: CoverageOutput | null,
  extractor: ExtractorOutput,
): string[] {
  const out: string[] = [];
  const push = (q: string | null | undefined) => {
    if (!q) return;
    const trimmed = q.trim().replace(/\s+/g, ' ');
    if (!trimmed) return;
    const truncated = trimmed.length > 80 ? trimmed.slice(0, 77) + '…' : trimmed;
    if (!out.includes(truncated)) out.push(truncated);
  };

  // 1. Highest-severity clarification's verbatim insurer-question.
  const clarifications = (coverage?.clarifications_needed ?? [])
    .slice()
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  if (clarifications[0]?.ask_the_insurer) {
    push(clarifications[0].ask_the_insurer);
  }

  // 2. Top red flag → ask the explainer to ground it.
  if (out.length < 3) {
    const topFlag = (coverage?.red_flags ?? [])
      .slice()
      .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
    if (topFlag) push(`What does "${topFlag.title}" mean for me?`);
  }

  // 3. First member's first must-watch — pulls in PED-aware questions.
  if (out.length < 3) {
    const firstMustWatch = (coverage?.member_cards ?? [])
      .flatMap((m) => m.must_watch_items)
      .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))[0];
    if (firstMustWatch) push(`Tell me more about ${firstMustWatch.title.toLowerCase()}`);
  }

  // 4. Waiting periods from the extractor — always grounded in the document.
  if (out.length < 3 && extractor.waiting_periods.length > 0) {
    const wp = extractor.waiting_periods[0]!;
    const subject = (wp as { condition?: string; title?: string }).condition
      ?? (wp as { title?: string }).title
      ?? 'pre-existing diseases';
    push(`What's the waiting period for ${subject.toLowerCase()}?`);
  }

  // 5. An exclusion if we still have headroom.
  if (out.length < 3 && extractor.exclusions.length > 0) {
    const ex = extractor.exclusions[0] as { title?: string };
    if (ex.title) push(`Why is ${ex.title.toLowerCase()} excluded?`);
  }

  // 6. Final generic fallbacks — only used when the analysis is sparse.
  const generics = [
    'What does this policy actually cover?',
    'How do I make a cashless claim?',
    'When does my coverage start?',
  ];
  for (const g of generics) {
    if (out.length >= 3) break;
    push(g);
  }

  return out.slice(0, 3);
}

function severityRank(s: Severity | undefined): number {
  if (s === 'high') return 3;
  if (s === 'medium') return 2;
  if (s === 'low') return 1;
  return 0;
}

/* ───────── Score tab helpers ───────── */

const SCORE_BAND_META: Record<
  PolicyScore['band'],
  { label: string; tone: 'success' | 'primary' | 'warn' | 'danger'; oneliner: string }
> = {
  claim_ready: {
    label: 'Claim-ready',
    tone: 'success',
    oneliner: 'Strong policy. Most likely scenarios are covered with low friction.',
  },
  mostly_covered: {
    label: 'Mostly covered',
    tone: 'success',
    oneliner: 'Solid policy with a couple of friction points worth knowing about.',
  },
  gaps_to_close: {
    label: 'Gaps to close',
    tone: 'warn',
    oneliner: 'Workable, but several sections will cost you out-of-pocket. Action needed.',
  },
  high_risk: {
    label: 'High risk',
    tone: 'danger',
    oneliner: "Serious gaps — claims under common scenarios will be rejected or capped.",
  },
};

/**
 * Display-side total. Per user decision 2026-05-07, the headline number is
 * the SUM of individual achieved scores on a /100 scale — no skip-and-
 * rescale for missing sections. So if SI=20, RR=missing(0), copay=10, etc.,
 * the total adds up to whatever the user can verify by adding the column.
 *
 * Bands are re-derived from this additive total so the visible band
 * matches the visible number (the agent's own `band` is computed via
 * skip-and-rescale and would otherwise contradict the displayed score).
 */
function scorePct(score: PolicyScore): number {
  return Math.max(0, Math.min(100, Math.round(score.totalScore)));
}

function bandFromAdditiveTotal(total: number): PolicyScore['band'] {
  if (total >= 80) return 'claim_ready';
  if (total >= 65) return 'mostly_covered';
  if (total >= 50) return 'gaps_to_close';
  return 'high_risk';
}

function scoreBadgeTone(score: PolicyScore): 'primary' | 'warn' | 'danger' {
  const tone = SCORE_BAND_META[bandFromAdditiveTotal(scorePct(score))]?.tone ?? 'primary';
  // Tab count-badge supports primary/danger/warn/neutral — map success → primary
  // so a "claim-ready" score reads as the same affirmative blue used for
  // member counts elsewhere in the bar.
  if (tone === 'success' || tone === 'primary') return 'primary';
  return tone;
}

/**
 * Score tab body. Two vertical blocks:
 *   1. Headline card — score / 100, band, one-liner
 *   2. Section breakdown — every scored section in canonical rubric order
 *      (sum_insured → ... → additional_benefits), each row with
 *      achieved/weight, severity badge, and the scorer's reason text.
 *
 * Sections at full marks (achieved == weight) show "What's working" framing.
 * Anything below full marks shows "Why it's not full" framing — the user
 * always sees an explanation, even on info-severity dings (the prior split
 * UI dropped these into a no-man's-land between strengths and gaps).
 *
 * `missing=true` rows render with a muted "Couldn't score this" treatment
 * so the user knows the document didn't expose enough info — they're not
 * hidden, because the user asked "why is X missing".
 */
function ScoreTabContent({ score, analysisId }: { score: PolicyScore; analysisId: string }) {
  const pct = scorePct(score);
  // Re-derive the band from the additive headline total so the band label
  // and the visible number always agree. (Agent-reported band is derived
  // from skip-and-rescale, which can disagree with the additive view.)
  const band = SCORE_BAND_META[bandFromAdditiveTotal(pct)];

  // Components are already canonically ordered by parseScore + getPolicyScore
  // (1 → 8). Render in place so the breakdown lines up row-for-row with the
  // weights table in the system prompt and the admin agent editor.
  const rows = score.components;

  return (
    <div className="space-y-6">
      {/* Headline card */}
      <div
        className={cn(
          'rounded-2xl border-2 bg-card p-5 shadow-card sm:p-6',
          band.tone === 'success' && 'border-success/30',
          band.tone === 'primary' && 'border-primary/40',
          band.tone === 'warn' && 'border-warn/40',
          band.tone === 'danger' && 'border-danger/40',
        )}
      >
        <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
          <Sparkles className="size-3" />
          Policy Health Score
        </div>

        <div className="mt-3">
          <div className="flex items-baseline gap-2">
            <span className="font-display text-5xl font-semibold leading-none text-ink">{pct}</span>
            <span className="font-display text-lg text-ink-muted">/ 100</span>
          </div>
          <div
            className={cn(
              'mt-2 inline-flex items-center gap-1.5 text-sm font-semibold',
              band.tone === 'success' && 'text-success',
              band.tone === 'primary' && 'text-primary',
              band.tone === 'warn' && 'text-warn',
              band.tone === 'danger' && 'text-danger',
            )}
          >
            <span
              className={cn(
                'size-2 rounded-full',
                band.tone === 'success' && 'bg-success',
                band.tone === 'primary' && 'bg-primary',
                band.tone === 'warn' && 'bg-warn',
                band.tone === 'danger' && 'bg-danger',
              )}
            />
            {band.label}
          </div>
        </div>

        <p className="mt-4 text-sm text-ink-muted">{band.oneliner}</p>
      </div>

      {/* Full canonical breakdown */}
      <ScoreBreakdown rows={rows} />

      {/* Recompute affordance — visible even when a score exists, so users
          looking at a row written under an older rubric can refresh to the
          current schema without DB surgery. (2026-05-07.) */}
      <details className="group rounded-lg border border-dashed border-border bg-background/30 px-4 py-3 text-sm text-ink-muted">
        <summary className="cursor-pointer select-none text-xs font-semibold uppercase tracking-wider text-ink-subtle">
          Score looks off?
        </summary>
        <p className="mt-2 text-sm text-ink-muted">
          We sometimes update the rubric (weight tables, calibration). Recompute to apply the
          latest scoring to this analysis.
        </p>
        <div className="mt-2">
          <RecomputeScoreButton analysisId={analysisId} />
        </div>
      </details>
    </div>
  );
}

/**
 * Score breakdown — renders every scored section in canonical rubric order
 * (1 → 8) as a 3-column table:
 *
 *   Section                    │  Score   │  Positive / Negative bullets
 *   Sum Insured Adequacy       │  20/20   │  ✓ Positive: ...adequate for a floater...
 *   Room Rent & ICU Caps       │  18/20   │  ✓ Positive: Uncapped single AC room
 *                              │          │  ✘ Negative: ICU cap of ₹15k/day
 *   Waiting Periods            │  4/10    │  ✘ Negative: PED waiting 48 months
 *
 * The user can have BOTH positives and negatives in the same section — a
 * mostly-good policy can carry a small caveat, and a low-scoring section
 * can still acknowledge what's working. (Decision 2026-05-07.)
 *
 * Falls back to the legacy single `reason` string when the scorer didn't
 * emit positives/negatives — older policy_score rows persisted before the
 * prompt update still display correctly.
 */
/**
 * Static metadata for each rubric section: a one-line inline summary
 * (rendered as small grey text under the section title) + a longer
 * tooltip (rendered on hover via the native `title` attribute, with a
 * <details> fallback for mobile/tap inside the table cell).
 *
 * This is hardcoded in the UI rather than fetched from the agent_definition
 * table because the rubric is locked + customer-facing copy needs careful
 * wording that survives admin prompt edits.
 */
const SECTION_META: Record<
  string,
  { oneLiner: string; tooltip: string }
> = {
  sum_insured: {
    oneLiner: 'Whether the cover amount is enough for a serious hospital bill in your city.',
    tooltip:
      "Total amount the policy will pay in a year. Bigger Indian metros need ₹10L+ for one person, ₹15L+ for a family. ICU stays + advanced surgeries can hit ₹5–8L easily — you want headroom above that.",
  },
  room_rent_icu: {
    oneLiner: 'Caps on hospital room class — the silent killer of Indian claims.',
    tooltip:
      'A "1% of SI" cap forces proportionate cuts to EVERY other expense (doctor fees, drugs, ICU charges) when you take a higher room class. This is the single most common claim-cut clause in Indian health insurance.',
  },
  copay: {
    oneLiner: 'How much of every claim YOU pay out-of-pocket.',
    tooltip:
      'A 20% co-pay means the insurer pays ₹4 of every ₹5 admissible. Triggers vary — age (often 60+), zone, non-network hospital, or specific conditions. Read the fine print on triggers.',
  },
  sub_limits: {
    oneLiner: 'Per-procedure caps that override your sum insured.',
    tooltip:
      'A ₹40k cataract cap means the insurer pays a maximum of ₹40k even if you have ₹10L sum insured. Common on cataract, knee replacement, cardiac procedures, and "modern treatments".',
  },
  exclusions: {
    oneLiner: 'What the policy will never pay for, no matter what.',
    tooltip:
      'Beyond IRDAI standard exclusions (war, suicide, cosmetic surgery), watch for non-standard ones — consumables, named diseases, specific procedures, room category restrictions. Each one is a covered loophole the insurer can use.',
  },
  boosters: {
    oneLiner: 'No-claim bonus, restore, and inflation-protect — long-term value adds.',
    tooltip:
      "Restore reinstates your sum insured if you exhaust it mid-year. NCB grows it year-on-year (much better if it doesn't reset on claim). Inflation-protect indexes the SI to medical inflation. Even one of these is meaningful.",
  },
  waits: {
    oneLiner: 'How long before specific conditions become claimable.',
    tooltip:
      'Pre-existing diseases typically wait 24–48 months. Maternity 24 months. Specific surgeries (cataract, hernia, knee replacement) 24 months. Plan elective treatment around these — claims filed inside the wait are auto-rejected.',
  },
  additional_benefits: {
    oneLiner: 'OPD, wellness, mental-health, daily cash — perks beyond hospitalisation.',
    tooltip:
      'Often capped or rider-only. Includes teleconsult, annual health check-ups, mental-health cover, AYUSH treatment, organ-donor expenses, daily cash for long stays. Not the headline cover but adds up.',
  },
};

function ScoreBreakdown({ rows }: { rows: ScoreComponent[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="rounded-xl border border-border bg-card p-5 shadow-card">
      <h3 className="font-display text-base font-semibold text-ink">Score breakdown</h3>
      <p className="mt-1 text-sm text-ink-muted">
        Every section in the rubric, in the order it carries weight. We list what's working and
        what isn't, side by side.
      </p>

      <div className="mt-4 overflow-hidden rounded-lg border border-border bg-background/40">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-background/60 text-left text-[10px] uppercase tracking-wider text-ink-subtle">
            <tr className="hidden sm:table-row">
              <th className="px-3 py-2 font-medium">Section</th>
              <th className="px-3 py-2 font-medium">Score</th>
              <th className="px-3 py-2 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((c) => {
              const isMissing = c.missing === true;
              const atFullMarks = !isMissing && c.achieved >= c.weight;
              const { positives, negatives } = derivePosNeg(c, isMissing, atFullMarks);
              const meta = SECTION_META[c.sectionSlug];
              return (
                <tr key={c.sectionSlug} className="block align-top sm:table-row">
                  {/* Column 1: Section name + 1-liner + tooltip */}
                  <td className="block px-3 pt-3 pb-1 sm:table-cell sm:w-[28%] sm:py-3 sm:pb-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-ink">{c.sectionLabel}</span>
                      {meta && (
                        <button
                          type="button"
                          aria-label={`What is ${c.sectionLabel}?`}
                          // Native tooltip on desktop hover; the popover below
                          // handles tap-to-reveal on mobile.
                          title={meta.tooltip}
                          className="group/info inline-flex size-4 items-center justify-center rounded-full text-ink-subtle transition hover:text-ink"
                        >
                          <HelpCircle className="size-3.5" aria-hidden />
                        </button>
                      )}
                    </div>
                    {meta && (
                      <p className="mt-1 text-xs text-ink-subtle">{meta.oneLiner}</p>
                    )}
                    {meta && (
                      <details className="mt-1 sm:hidden">
                        <summary className="cursor-pointer select-none text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
                          More
                        </summary>
                        <p className="mt-1 text-xs text-ink-muted">{meta.tooltip}</p>
                      </details>
                    )}
                  </td>

                  {/* Column 2: Score badge */}
                  <td className="block px-3 pb-1 sm:table-cell sm:w-[14%] sm:py-3 sm:pb-3 sm:whitespace-nowrap">
                    <Badge tone={badgeForRow(c, isMissing, atFullMarks)}>
                      {isMissing ? "Couldn't score" : `${formatScore(c.achieved)} / ${c.weight}`}
                    </Badge>
                  </td>

                  {/* Column 3: Positive / Negative bullets */}
                  <td className="block px-3 pb-3 sm:table-cell sm:py-3">
                    {isMissing ? (
                      <p className="text-sm italic text-ink-subtle">
                        The document didn't expose enough information to score this section.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {positives.length > 0 && (
                          <PositiveNegativeList tone="positive" items={positives} />
                        )}
                        {negatives.length > 0 && (
                          <PositiveNegativeList tone="negative" items={negatives} />
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Resolve which strings to render as positives vs negatives for a row.
 * Priority:
 *   1. Use the agent-supplied positives + negatives arrays (preferred).
 *   2. Fall back to bucketing the legacy `reason` string by SEVERITY, not
 *      by score-fullness. A section can be below full marks but still a
 *      positive (e.g. SI at 1× benchmark earned 16/20 under the old curve
 *      with severity=info — the reason "adequate, meeting the benchmark"
 *      is positive in tone). Severity tracks concern; score-fullness
 *      tracks calibration nuance. (2026-05-07.)
 */
function derivePosNeg(
  c: ScoreComponent,
  isMissing: boolean,
  _atFullMarks: boolean,
): { positives: string[]; negatives: string[] } {
  if (isMissing) return { positives: [], negatives: [] };
  const pos = c.positives ?? [];
  const neg = c.negatives ?? [];
  if (pos.length > 0 || neg.length > 0) {
    return { positives: pos, negatives: neg };
  }
  const reason = c.reason?.trim();
  if (!reason) return { positives: [], negatives: [] };
  // Severity-based bucketing for legacy rows: info/low = positive, medium+
  // = negative. Matches what the user sees as concerning.
  const isConcerning = c.severity === 'medium' || c.severity === 'high' || c.severity === 'critical';
  return isConcerning
    ? { positives: [], negatives: [reason] }
    : { positives: [reason], negatives: [] };
}

function PositiveNegativeList({
  tone,
  items,
}: {
  tone: 'positive' | 'negative';
  items: string[];
}) {
  const isPos = tone === 'positive';
  return (
    <div>
      <div
        className={cn(
          'text-[11px] font-semibold uppercase tracking-wider',
          isPos ? 'text-success' : 'text-warn',
        )}
      >
        {isPos ? 'Positive' : 'Negative'}
      </div>
      <ul className="mt-1 space-y-1">
        {items.map((s, i) => (
          <li key={i} className="flex gap-2 text-sm text-ink-muted">
            <span aria-hidden className="mt-1.5 size-1.5 flex-none rounded-full bg-current opacity-60" />
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function formatScore(n: number): string {
  // Most rubric awards are integers but some (additional_benefits) award
  // half-points. Show one decimal only when needed so common rows stay tidy.
  if (Number.isInteger(n)) return String(n);
  return n.toFixed(1);
}

/**
 * Score-bucket → badge tone. Driven by % of weight achieved, NOT by the
 * agent's severity field — severity tracks what the rubric calls a
 * concern, but a 2.5/10 score should never read as green just because the
 * agent labelled severity "low". The user reads the badge color first,
 * the number second; they have to agree.
 *
 *   ≥ 90% → success (green)
 *   ≥ 70% → primary (mint) — solid but with friction
 *   ≥ 40% → warn (amber)   — meaningful gap
 *    < 40% → danger (red)  — major shortfall
 *   missing → neutral (grey)
 */
function badgeForRow(
  c: ScoreComponent,
  isMissing: boolean,
  _atFullMarks: boolean,
): 'success' | 'warn' | 'danger' | 'primary' | 'neutral' {
  if (isMissing) return 'neutral';
  if (c.weight <= 0) return 'neutral';
  const pct = c.achieved / c.weight;
  if (pct >= 0.9) return 'success';
  if (pct >= 0.7) return 'primary';
  if (pct >= 0.4) return 'warn';
  return 'danger';
}

function scoreSeverityTone(s: ScoreComponent['severity']): 'success' | 'warn' | 'danger' | 'primary' {
  if (s === 'critical') return 'danger';
  if (s === 'high') return 'danger';
  if (s === 'medium') return 'warn';
  return 'primary';
}

/* ───────── Score-gap → Actions integration (2026-05-07) ───────── */

export interface ScoreGapAction {
  sectionSlug: string;
  sectionLabel: string;
  reason: string;
  severity: ScoreComponent['severity'];
  /** Built from c.action?.label when the scorer provided one; otherwise
   *  derived from the section slug. */
  recommendation: string;
  /** Mapped from severity for the urgency chip. */
  urgency: 'do_today' | 'do_this_month' | 'optional';
}

/**
 * Convert score components scoring poorly into action cards for the
 * Actions tab. Cap at 5 so the tab doesn't drown the coverage-agent's
 * own action list. Sorted by points-lost desc — biggest gap first.
 *
 * Components flagged `missing=true` are excluded — the user can't act on
 * a section the document didn't expose.
 */
function deriveScoreGapActions(score: PolicyScore): ScoreGapAction[] {
  return score.components
    .filter((c) => !c.missing)
    .filter((c) => c.severity === 'medium' || c.severity === 'high' || c.severity === 'critical')
    .sort((a, b) => b.weight - b.achieved - (a.weight - a.achieved))
    .slice(0, 5)
    .map((c) => ({
      sectionSlug: c.sectionSlug,
      sectionLabel: c.sectionLabel,
      reason: c.reason,
      severity: c.severity,
      recommendation: c.action?.label ?? defaultRecommendationFor(c.sectionSlug),
      urgency:
        c.severity === 'critical' || c.severity === 'high'
          ? 'do_today'
          : c.severity === 'medium'
            ? 'do_this_month'
            : 'optional',
    }));
}

const SECTION_DEFAULT_RECOMMENDATION: Record<string, string> = {
  sum_insured:
    'Consider topping up your sum insured — a super top-up adds high-limit cover for ~₹3–5k/year.',
  room_rent_icu:
    'Ask your insurer how to remove or raise the room-rent cap; check if a single private AC room rider is available.',
  copay:
    "Ask your insurer about a no-copay variant or a senior-citizen waiver. Confirm in writing what triggers the co-pay.",
  sub_limits:
    'Get the full procedure-cap schedule in writing. If sub-limits are tight on cataract/knee/cardiac, plan for the difference.',
  exclusions:
    'Read every named exclusion carefully. Ask the insurer if waivers are available, especially for non-standard exclusions.',
  boosters:
    'Ask whether NCB, Restore, or Inflation-protect can be added at renewal — they often cost little but add real headroom.',
  waits:
    'Confirm the start date of every waiting period in writing. Plan elective treatment and pre-existing conditions around it.',
  additional_benefits:
    'Check if OPD, wellness, mental-health, or daily-cash add-ons can be opted at next renewal — often free or cheap.',
};

function defaultRecommendationFor(slug: string): string {
  return (
    SECTION_DEFAULT_RECOMMENDATION[slug] ??
    'Discuss this gap with your insurer or advisor and confirm next steps in writing.'
  );
}

/**
 * Render score-derived gaps as action cards inside the Actions tab. Visual
 * scaffold matches WhatToDoNow's numbered list so the two blocks read as
 * one continuous list of next steps to the user — the only difference is
 * a small "From your score" sub-heading so power users can see why.
 */
function ScoreGapActions({ gaps }: { gaps: ScoreGapAction[] }) {
  if (gaps.length === 0) return null;
  return (
    <div className="mt-6">
      <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
        From your score breakdown
      </h2>
      <p className="mb-3 text-xs text-ink-subtle">
        Sections that scored poorly come with a recommendation here so you can act on them in the
        same place as the coverage-agent's action list.
      </p>
      <ol className="space-y-3">
        {gaps.map((g, i) => (
          <li
            key={g.sectionSlug}
            className="rounded-xl border border-border bg-card p-4 shadow-card"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-ink">
                {i + 1}. {g.sectionLabel}
              </span>
              <Badge tone={urgencyTone(g.urgency)}>{urgencyLabel(g.urgency)}</Badge>
              <Badge tone={scoreSeverityTone(g.severity)}>
                {g.severity === 'critical'
                  ? 'Critical gap'
                  : g.severity === 'high'
                    ? 'High'
                    : 'Medium'}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-ink-muted">{g.reason}</p>
            <p className="mt-1 text-sm text-ink">→ {g.recommendation}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function resolveCitation(extractor: ExtractorOutput, refId: string): Citation | null {
  if (!refId) return null;

  // Strategy 1: id-based lookup (new default). The pipeline's mintCitationIds
  // gives every clause a stable id (cs_0, ex_3, wp_1, sl_0).
  const byId = [
    ...extractor.coverage_sections,
    ...extractor.exclusions,
    ...extractor.waiting_periods,
    ...extractor.sub_limits,
  ].find((x) => x.id === refId);
  if (byId) return byId.citation;

  // Strategy 2: legacy index-style refs from older coverage outputs.
  const match = refId.match(/^([a-z_]+)\[(\d+)\]$/);
  if (match) {
    const [, key, idxStr] = match;
    const idx = parseInt(idxStr!, 10);
    const arr = (extractor as unknown as Record<string, unknown>)[key!];
    if (Array.isArray(arr) && arr[idx] && typeof arr[idx] === 'object' && 'citation' in arr[idx]!) {
      const item = arr[idx] as { citation?: Citation };
      return item.citation ?? null;
    }
  }

  // Strategy 3: best-effort content match (helps when the LLM echoed a name
  // instead of an id). Not authoritative, but better than hiding the line.
  const byName = [
    ...extractor.coverage_sections.map((s) => ({ name: s.name, citation: s.citation })),
    ...extractor.exclusions.map((e) => ({ name: e.text.slice(0, 40), citation: e.citation })),
    ...extractor.sub_limits.map((s) => ({ name: s.name, citation: s.citation })),
    ...extractor.waiting_periods.map((w) => ({ name: w.condition, citation: w.citation })),
  ].find((x) => x.name === refId);
  return byName?.citation ?? null;
}

function formatRupees(rupees: number | null): string | null {
  if (rupees == null || rupees === 0) return null;
  const r = rupees > 500_000_000 ? Math.round(rupees / 100) : Math.round(rupees);
  if (r >= 10_000_000) return `₹${(r / 10_000_000).toFixed(2)} Cr`;
  if (r >= 100_000) return `₹${(r / 100_000).toFixed(2)} L`;
  return `₹${r.toLocaleString('en-IN')}`;
}

function formatPeriod(start: string | null, end: string | null): string | null {
  if (!start || !end) return null;
  return `${formatShortDate(start)} → ${formatShortDate(end)}`;
}

function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function humanPlanType(t: string): string {
  return t.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n).trim()}…` : s;
}

function severityTone(s: Severity): 'danger' | 'warn' | 'neutral' {
  return s === 'high' ? 'danger' : s === 'medium' ? 'warn' : 'neutral';
}

function severityBorder(s: Severity): string {
  return s === 'high' ? 'border-danger' : s === 'medium' ? 'border-warning' : 'border-border';
}

function severityIcon(s: Severity): string {
  return s === 'high' ? 'text-danger' : s === 'medium' ? 'text-warning' : 'text-ink-subtle';
}

function urgencyTone(u: 'do_today' | 'do_this_month' | 'optional'): 'danger' | 'warn' | 'neutral' {
  return u === 'do_today' ? 'danger' : u === 'do_this_month' ? 'warn' : 'neutral';
}

function urgencyLabel(u: 'do_today' | 'do_this_month' | 'optional'): string {
  return u === 'do_today' ? 'Today' : u === 'do_this_month' ? 'This month' : 'Optional';
}
