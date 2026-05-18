import { notFound } from 'next/navigation';
import { Container } from '@suraksha/ui';
import { getAnalysisStore } from '@/server/analyse/store';
import { AnalysisProgress } from '@/components/claims/analysis-progress';
import { ReportView, type ReportLocaleStrings } from '@/components/claims/report-view';
import { ReportViewV2 } from '@/components/claims/report-view-v2';
import { isReportV2 } from '@/server/analyse/report-v2-types';
import { getCurrentUser } from '@/lib/current-user';
import { getPolicyScore } from '@/server/scoring';

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

// Short revalidate — while an analysis is in progress, the page re-renders
// on each router.refresh() from the client to pick up status changes.
export const dynamic = 'force-dynamic';

const STAGE_LABELS = {
  en: {
    ocr_running: 'Reading every page',
    intake_running: 'Confirming this is a health policy',
    extracting: 'Extracting coverage and exclusions',
    analysing: 'Finding red flags',
    translating: 'Translating into your language',
    reviewing: 'Double-checking every citation',
  },
  hi: {
    ocr_running: 'हर पन्ना पढ़ रहे हैं',
    intake_running: 'पुष्टि कर रहे हैं कि यह स्वास्थ्य पॉलिसी है',
    extracting: 'कवरेज और अपवर्जन निकाल रहे हैं',
    analysing: 'रेड फ्लैग ढूँढ रहे हैं',
    translating: 'आपकी भाषा में अनुवाद',
    reviewing: 'हर उद्धरण की पुनः जाँच',
  },
  kn: {
    ocr_running: 'ಪ್ರತಿ ಪುಟ ಓದಲಾಗುತ್ತಿದೆ',
    intake_running: 'ಇದು ಆರೋಗ್ಯ ಪಾಲಿಸಿ ಎಂಬುದನ್ನು ದೃಢೀಕರಿಸಲಾಗುತ್ತಿದೆ',
    extracting: 'ಕವರೇಜ್ ಮತ್ತು ಹೊರಗಿಡುವಿಕೆ ಹೊರತೆಗೆಯಲಾಗುತ್ತಿದೆ',
    analysing: 'ಸೂಕ್ಷ್ಮ ಅಂಶ ಹುಡುಕಲಾಗುತ್ತಿದೆ',
    translating: 'ನಿಮ್ಮ ಭಾಷೆಗೆ ಅನುವಾದ',
    reviewing: 'ಪ್ರತಿ ಉಲ್ಲೇಖವನ್ನು ಪುನಃ ಪರಿಶೀಲಿಸಲಾಗುತ್ತಿದೆ',
  },
};

const TITLES = {
  en: {
    readingPolicy: 'Reading your policy',
    estSeconds: 'About 3–5 minutes',
    failedTitle: "Couldn't complete the analysis",
    tryAgain: 'Try again',
    keepUrl: 'Keep this URL — it works for 7 days, even across devices.',
  },
  hi: {
    readingPolicy: 'आपकी पॉलिसी पढ़ रहे हैं',
    estSeconds: 'लगभग 3–5 मिनट',
    failedTitle: 'विश्लेषण पूरा नहीं हो सका',
    tryAgain: 'फिर से कोशिश करें',
    keepUrl: 'यह URL रखें — 7 दिन तक काम करेगा, किसी भी डिवाइस पर।',
  },
  kn: {
    readingPolicy: 'ನಿಮ್ಮ ಪಾಲಿಸಿ ಓದಲಾಗುತ್ತಿದೆ',
    estSeconds: 'ಸುಮಾರು 3–5 ನಿಮಿಷಗಳು',
    failedTitle: 'ವಿಶ್ಲೇಷಣೆ ಪೂರ್ಣಗೊಳ್ಳಲಿಲ್ಲ',
    tryAgain: 'ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ',
    keepUrl: 'ಈ URL ಇರಿಸಿಕೊಳ್ಳಿ — 7 ದಿನಗಳವರೆಗೆ ಯಾವುದೇ ಸಾಧನದಲ್ಲಿ ಕೆಲಸ ಮಾಡುತ್ತದೆ.',
  },
};

const REPORT_STRINGS: Record<'en' | 'hi' | 'kn', ReportLocaleStrings> = {
  en: {
    readinessScore: 'Claim Readiness Score',
    readinessOutOf: '/ 100',
    dimensions: {
      coverage_adequacy: 'Coverage',
      exclusions_and_gaps: 'Gaps',
      waiting_period_clearance: 'Waits',
      nominee_accuracy: 'Nominee',
      documentation_completeness: 'Docs',
    },
    sectionTitles: {
      quick: 'Quick summary',
      basics: 'Basic facts',
      covered: "What's covered",
      excluded: "What's NOT covered",
      waiting: 'Waiting periods',
      limits: 'Sub-limits & caps',
      copay: 'Co-pay & deductibles',
      flags: 'Red flags',
      readiness: 'Your claim-readiness, explained',
      actions: 'What to do now',
    },
    labels: {
      yes: 'Yes',
      no: 'No',
      withConditions: 'With conditions',
      share: 'Share',
      download: 'PDF',
      deleteNow: 'Delete now',
      expiresIn: 'Expires in',
      days: 'days',
      surprising: 'Likely surprising',
      nextMoment: 'Next moment',
      severityHigh: 'High severity',
      severityMed: 'Medium',
      severityLow: 'Low',
      urgencyToday: 'Do today',
      urgencyMonth: 'This month',
      urgencyOptional: 'Optional',
      confidence: 'Confidence',
      source: 'source',
      insurer: 'Insurer',
      plan: 'Plan',
      policyNumber: 'Policy no.',
      sumAssured: 'Sum insured',
      premium: 'Premium',
      period: 'Period',
      members: 'Members',
      nominee: 'Nominee',
      network: 'Network',
      relation: { self: 'Self', spouse: 'Spouse', child: 'Child', father: 'Father', mother: 'Mother' },
    },
    disclaimer: '',
  },
  hi: {
    readinessScore: 'दावा तैयारी स्कोर',
    readinessOutOf: '/ 100',
    dimensions: {
      coverage_adequacy: 'कवरेज',
      exclusions_and_gaps: 'कमियाँ',
      waiting_period_clearance: 'प्रतीक्षा',
      nominee_accuracy: 'नॉमिनी',
      documentation_completeness: 'दस्तावेज़',
    },
    sectionTitles: {
      quick: 'संक्षेप',
      basics: 'मूल जानकारी',
      covered: 'क्या कवर है',
      excluded: 'क्या कवर नहीं है',
      waiting: 'प्रतीक्षा अवधि',
      limits: 'सब-लिमिट और कैप',
      copay: 'को-पे और डिडक्टिबल',
      flags: 'रेड फ्लैग',
      readiness: 'आपकी दावा-तैयारी, समझाई गई',
      actions: 'अभी क्या करें',
    },
    labels: {
      yes: 'हाँ',
      no: 'नहीं',
      withConditions: 'शर्तों के साथ',
      share: 'शेयर',
      download: 'PDF',
      deleteNow: 'अभी हटाएं',
      expiresIn: 'समाप्ति',
      days: 'दिन',
      surprising: 'हैरानी की बात',
      nextMoment: 'अगला पल',
      severityHigh: 'उच्च',
      severityMed: 'मध्यम',
      severityLow: 'निम्न',
      urgencyToday: 'आज करें',
      urgencyMonth: 'इस महीने',
      urgencyOptional: 'वैकल्पिक',
      confidence: 'विश्वास',
      source: 'स्रोत',
      insurer: 'बीमा कंपनी',
      plan: 'प्लान',
      policyNumber: 'पॉलिसी सं.',
      sumAssured: 'बीमा राशि',
      premium: 'प्रीमियम',
      period: 'अवधि',
      members: 'सदस्य',
      nominee: 'नॉमिनी',
      network: 'नेटवर्क',
      relation: { self: 'स्वयं', spouse: 'जीवनसाथी', child: 'बच्चा', father: 'पिता', mother: 'माता' },
    },
    disclaimer: '',
  },
  kn: {
    readinessScore: 'ಕ್ಲೈಮ್ ಸಿದ್ಧತೆ ಸ್ಕೋರ್',
    readinessOutOf: '/ 100',
    dimensions: {
      coverage_adequacy: 'ಕವರೇಜ್',
      exclusions_and_gaps: 'ಅಂತರ',
      waiting_period_clearance: 'ಕಾಯುವಿಕೆ',
      nominee_accuracy: 'ನಾಮಿನಿ',
      documentation_completeness: 'ದಾಖಲೆ',
    },
    sectionTitles: {
      quick: 'ಸಾರಾಂಶ',
      basics: 'ಮೂಲ ಮಾಹಿತಿ',
      covered: 'ಏನು ಕವರ್',
      excluded: 'ಏನು ಕವರ್ ಅಲ್ಲ',
      waiting: 'ಕಾಯುವ ಅವಧಿಗಳು',
      limits: 'ಸಬ್-ಲಿಮಿಟ್‌ಗಳು',
      copay: 'ಸಹ-ಪಾವತಿ',
      flags: 'ಕೆಂಪು ಧ್ವಜಗಳು',
      readiness: 'ನಿಮ್ಮ ಕ್ಲೈಮ್ ಸಿದ್ಧತೆ, ವಿವರಿಸಲಾಗಿದೆ',
      actions: 'ಈಗ ಏನು ಮಾಡಬೇಕು',
    },
    labels: {
      yes: 'ಹೌದು',
      no: 'ಇಲ್ಲ',
      withConditions: 'ಷರತ್ತುಗಳೊಂದಿಗೆ',
      share: 'ಹಂಚಿಕೊಳ್ಳಿ',
      download: 'PDF',
      deleteNow: 'ಈಗ ಅಳಿಸಿ',
      expiresIn: 'ಅವಧಿ ಮುಗಿಯುತ್ತದೆ',
      days: 'ದಿನ',
      surprising: 'ಅಚ್ಚರಿಯ',
      nextMoment: 'ಮುಂದಿನ ಕ್ಷಣ',
      severityHigh: 'ಅಧಿಕ',
      severityMed: 'ಮಧ್ಯಮ',
      severityLow: 'ಕಡಿಮೆ',
      urgencyToday: 'ಇಂದೇ',
      urgencyMonth: 'ಈ ತಿಂಗಳು',
      urgencyOptional: 'ಐಚ್ಛಿಕ',
      confidence: 'ವಿಶ್ವಾಸ',
      source: 'ಮೂಲ',
      insurer: 'ವಿಮಾ ಕಂಪನಿ',
      plan: 'ಪ್ಲಾನ್',
      policyNumber: 'ಪಾಲಿಸಿ ಸಂ.',
      sumAssured: 'ವಿಮಾ ಮೊತ್ತ',
      premium: 'ಪ್ರೀಮಿಯಂ',
      period: 'ಅವಧಿ',
      members: 'ಸದಸ್ಯರು',
      nominee: 'ನಾಮಿನಿ',
      network: 'ಜಾಲ',
      relation: { self: 'ಸ್ವತಃ', spouse: 'ಸಂಗಾತಿ', child: 'ಮಗು', father: 'ತಂದೆ', mother: 'ತಾಯಿ' },
    },
    disclaimer: '',
  },
};

export default async function AnalysisPage({ params }: Props) {
  const { locale, id } = await params;
  const store = getAnalysisStore();
  const rec = await store.get(id);
  if (!rec) notFound();

  // Only signed-in owners see the "back to dashboard" breadcrumb; anonymous
  // uploads intentionally don't advertise the account shell.
  const user = await getCurrentUser();
  const showBreadcrumb = !!(user && rec.userId && rec.userId === user.id);

  const loc = (locale in STAGE_LABELS ? locale : 'en') as 'en' | 'hi' | 'kn';

  if (rec.status !== 'ready' || !rec.report) {
    return (
      <section className="bg-hero-aurora py-12">
        <Container className="max-w-5xl">
          <AnalysisProgress
            analysisId={rec.id}
            initialStatus={rec.status}
            initialStep={rec.progressStep}
            initialErrorCode={rec.errorCode}
            initialErrorMessage={rec.errorMessage}
            stageLabels={STAGE_LABELS[loc]}
            titles={TITLES[loc]}
          />
        </Container>
      </section>
    );
  }

  // v2 reports come from the policy-extractor + policy-coverage chain; v1 reports
  // are the older single-agent shape. Existing rows keep working until their 7-day TTL.
  if (isReportV2(rec.report)) {
    // Score lives in a separate table (policy_score) keyed on analysis_id —
    // load it alongside the report so the Score tab renders without a
    // client-side waterfall. Null when the scorer hasn't run yet (older
    // analyses, partial-failure pipelines); the Score tab renders a graceful
    // empty state in that case.
    const score = await getPolicyScore(rec.id).catch(() => null);
    return (
      <ReportViewV2
        report={rec.report}
        analysisId={rec.id}
        locale={rec.locale}
        createdAt={rec.createdAt}
        expiresAt={rec.expiresAt}
        costPaise={rec.costPaise}
        demographics={(rec.demographics as never) ?? null}
        showBreadcrumb={showBreadcrumb}
        isAuthenticated={!!user}
        score={score}
      />
    );
  }

  return (
    <ReportView
      report={rec.report}
      analysisId={rec.id}
      locale={rec.locale}
      createdAt={rec.createdAt}
      expiresAt={rec.expiresAt}
      costPaise={rec.costPaise}
      strings={REPORT_STRINGS[loc]}
    />
  );
}
