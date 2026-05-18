import 'server-only';

/**
 * Dev-mode seeded analyses for admin portal UX demo.
 *
 * When DATABASE_URL is set, admin reads live data from Postgres instead.
 * These are representative of real analysis records so the admin UX renders
 * meaningfully even with no live traffic.
 */

export type AnalysisStatus =
  | 'queued'
  | 'digitizing'
  | 'ocr_running'
  | 'intake_running'
  | 'extracting'
  | 'analysing'
  | 'translating'
  | 'reviewing'
  | 'ready'
  | 'failed';

export interface AnalysisSummary {
  id: string;
  tenantId: string;
  locale: string;
  status: AnalysisStatus;
  progressStep: string | null;
  readinessScore: number | null;
  confidenceOverall: number | null;
  redFlagsCount: number | null;
  costPaise: number;
  errorCode: string | null;
  insurerName: string | null;
  planName: string | null;
  fileKind: string;
  pageCount: number | null;
  createdAt: string;
  readyAt: string | null;
  expiresAt: string;
  durationSec: number | null;
}

function hoursAgo(h: number): string {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}
function plusDays(base: string, d: number): string {
  return new Date(new Date(base).getTime() + d * 24 * 60 * 60 * 1000).toISOString();
}

const cases: Omit<AnalysisSummary, 'expiresAt' | 'durationSec'>[] = [
  {
    id: 'a-0011',
    tenantId: 'surakshasaathi',
    locale: 'en',
    status: 'ready',
    progressStep: null,
    readinessScore: 72,
    confidenceOverall: 0.86,
    redFlagsCount: 4,
    costPaise: 14200,
    errorCode: null,
    insurerName: 'Star Health',
    planName: 'Family Health Optima',
    fileKind: 'pdf',
    pageCount: 32,
    createdAt: hoursAgo(0.5),
    readyAt: hoursAgo(0.45),
  },
  {
    id: 'a-0010',
    tenantId: 'surakshasaathi',
    locale: 'hi',
    status: 'ready',
    progressStep: null,
    readinessScore: 58,
    confidenceOverall: 0.79,
    redFlagsCount: 6,
    costPaise: 15600,
    errorCode: null,
    insurerName: 'Care Health',
    planName: 'Care Advantage',
    fileKind: 'image/jpeg',
    pageCount: 1,
    createdAt: hoursAgo(2),
    readyAt: hoursAgo(1.95),
  },
  {
    id: 'a-0009',
    tenantId: 'surakshasaathi',
    locale: 'kn',
    status: 'reviewing',
    progressStep: 'Double-checking every citation…',
    readinessScore: null,
    confidenceOverall: null,
    redFlagsCount: null,
    costPaise: 11400,
    errorCode: null,
    insurerName: 'HDFC ERGO',
    planName: 'Optima Secure',
    fileKind: 'pdf',
    pageCount: 28,
    createdAt: hoursAgo(0.15),
    readyAt: null,
  },
  {
    id: 'a-0008',
    tenantId: 'surakshasaathi',
    locale: 'en',
    status: 'ready',
    progressStep: null,
    readinessScore: 81,
    confidenceOverall: 0.91,
    redFlagsCount: 2,
    costPaise: 12800,
    errorCode: null,
    insurerName: 'Niva Bupa',
    planName: 'ReAssure 2.0',
    fileKind: 'pdf',
    pageCount: 40,
    createdAt: hoursAgo(6),
    readyAt: hoursAgo(5.96),
  },
  {
    id: 'a-0007',
    tenantId: 'surakshasaathi',
    locale: 'en',
    status: 'failed',
    progressStep: null,
    readinessScore: null,
    confidenceOverall: null,
    redFlagsCount: null,
    costPaise: 800,
    errorCode: 'intake_off_scope',
    insurerName: null,
    planName: null,
    fileKind: 'image/jpeg',
    pageCount: 1,
    createdAt: hoursAgo(8),
    readyAt: null,
  },
  {
    id: 'a-0006',
    tenantId: 'surakshasaathi',
    locale: 'hi',
    status: 'ready',
    progressStep: null,
    readinessScore: 65,
    confidenceOverall: 0.82,
    redFlagsCount: 3,
    costPaise: 13100,
    errorCode: null,
    insurerName: 'ICICI Lombard',
    planName: 'Complete Health Shield',
    fileKind: 'pdf',
    pageCount: 34,
    createdAt: hoursAgo(10),
    readyAt: hoursAgo(9.96),
  },
  {
    id: 'a-0005',
    tenantId: 'surakshasaathi',
    locale: 'en',
    status: 'ready',
    progressStep: null,
    readinessScore: 43,
    confidenceOverall: 0.74,
    redFlagsCount: 8,
    costPaise: 17200,
    errorCode: null,
    insurerName: 'Star Health',
    planName: 'Red Carpet (Senior)',
    fileKind: 'pdf',
    pageCount: 38,
    createdAt: hoursAgo(24),
    readyAt: hoursAgo(23.95),
  },
  {
    id: 'a-0004',
    tenantId: 'surakshasaathi',
    locale: 'en',
    status: 'failed',
    progressStep: null,
    readinessScore: null,
    confidenceOverall: null,
    redFlagsCount: null,
    costPaise: 200,
    errorCode: 'ocr_empty',
    insurerName: null,
    planName: null,
    fileKind: 'image/jpeg',
    pageCount: 1,
    createdAt: hoursAgo(30),
    readyAt: null,
  },
];

export const FIXTURE_ANALYSES: AnalysisSummary[] = cases.map((c) => ({
  ...c,
  expiresAt: plusDays(c.createdAt, 7),
  durationSec:
    c.readyAt && c.createdAt
      ? Math.round((new Date(c.readyAt).getTime() - new Date(c.createdAt).getTime()) / 1000)
      : null,
}));

export function getAnalysis(id: string): AnalysisSummary | null {
  return FIXTURE_ANALYSES.find((a) => a.id === id) ?? null;
}
