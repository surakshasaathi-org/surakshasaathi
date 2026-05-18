import { NextResponse } from 'next/server';
import { getAnalysisStore, getDigitizedDocument } from '@/server/analyse/store';
import { isReportV2 } from '@/server/analyse/report-v2-types';

/**
 * Status polling endpoint. Client polls every 2–3s while status != ready|failed.
 *
 * Returns the minimal status fields PLUS a `snapshot` of facts that have
 * been extracted so far — populated as soon as the policy-extractor stage
 * completes (pipeline writes an intermediate report at that point). The
 * customer progress UI uses these to surface "We just found …" beats so
 * the wait isn't a boring loader.
 */

export const dynamic = 'force-dynamic';

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
  digitizedPages: number | null;
}

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  const store = getAnalysisStore();
  const rec = await store.get(id);
  if (!rec) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  // Pull the digitiser's page count from policy_document.extracted — this
  // is set as soon as the digitiser stage completes (well before the
  // extractor populates the rest of the snapshot), so the UI gets an
  // early "X pages digitised" finding instead of staring at an empty
  // panel for the full first half of the wait.
  const digitized = await getDigitizedDocument(id).catch(() => null);
  const digitizedPages = digitized?.totalPages ?? null;

  let snapshot: Snapshot | null = null;
  if (isReportV2(rec.report)) {
    const e = rec.report.extractor;
    const bf = e.basic_facts;
    const peds = bf.members.reduce((sum, m) => sum + (m.pre_existing?.length ?? 0), 0);
    snapshot = {
      insurerName: bf.insurer_name ?? null,
      planName: bf.plan_name ?? null,
      policyNumber: bf.policy_number ?? null,
      sumInsuredRupees: bf.sum_insured_rupees ?? null,
      premiumRupees: bf.premium_rupees ?? null,
      memberCount: bf.members.length,
      pedCount: peds,
      coverageSectionsCount: e.coverage_sections.length,
      exclusionsCount: e.exclusions.length,
      waitingPeriodsCount: e.waiting_periods.length,
      subLimitsCount: e.sub_limits.length,
      redFlagsCount: rec.report.coverage?.red_flags.length ?? 0,
      digitizedPages,
    };
  } else if (digitizedPages != null) {
    // Even if the extractor hasn't run yet, surface the digitiser count
    // so the customer sees SOMETHING in the right column ~60-90s in.
    snapshot = {
      insurerName: null,
      planName: null,
      policyNumber: null,
      sumInsuredRupees: null,
      premiumRupees: null,
      memberCount: 0,
      pedCount: 0,
      coverageSectionsCount: 0,
      exclusionsCount: 0,
      waitingPeriodsCount: 0,
      subLimitsCount: 0,
      redFlagsCount: 0,
      digitizedPages,
    };
  }

  return NextResponse.json({
    ok: true,
    id: rec.id,
    status: rec.status,
    progressStep: rec.progressStep,
    locale: rec.locale,
    errorCode: rec.errorCode,
    errorMessage: rec.errorMessage,
    readyAt: rec.readyAt,
    snapshot,
  });
}
