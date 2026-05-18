/**
 * Types for the Coverage-Predictor output + our ephemeral coverage-check
 * session record.
 */

export type CoveragePrediction = 'green' | 'amber' | 'red';

export interface CoverageClauseCitation {
  page: number;
  section_label: string;
  quoted_text: string;
}

export interface CoverageClause {
  name: string;
  impact: 'covered' | 'covered_with_conditions' | 'excluded' | 'capped';
  detail: string;
  citation: CoverageClauseCitation;
}

export interface CoverageRisk {
  risk: string;
  probability: 'high' | 'medium' | 'low';
  mitigation: string;
}

export interface CoverageAction {
  action: string;
  urgency: 'do_today' | 'do_this_month' | 'optional';
  why: string;
}

export interface CoverageScenario {
  /** Plain-language description of the claim: "knee replacement surgery" */
  condition: string;
  /** Where it'll happen: "Fortis Hospital, Bengaluru" */
  hospital: string;
  /** Expected bill band (₹) — users rarely know exact figures */
  expected_amount_band: '<25k' | '25k-50k' | '50k-1L' | '1L-2L' | '2L-5L' | '>5L';
  /** When: 'this_month' | '3_months' | '6_months' | '1_year' */
  when: 'this_month' | '3_months' | '6_months' | '1_year';
  /** Any extra context the user wants to provide */
  details: string | null;
}

export interface CoverageResult {
  version: number;
  generated_at: string;
  locale: string;
  confidence: number;
  prediction: CoveragePrediction;
  prediction_summary: string;
  scenario_echo: {
    condition: string;
    hospital: string;
    expected_amount_band: string;
    when: string;
  };
  reasoning: string[];
  clauses_that_apply: CoverageClause[];
  what_could_go_wrong: CoverageRisk[];
  what_to_do_now: CoverageAction[];
  estimated_payout_range_paise: {
    min: number | null;
    max: number | null;
    explanation: string;
  } | null;
  disclaimer: string;
}

export type CoverageCheckStatus = 'queued' | 'analysing' | 'ready' | 'failed';

export interface CoverageCheckRecord {
  id: string;
  sessionToken: string;
  tenantId: string;
  sourceAnalysisId: string;
  locale: string;
  scenario: CoverageScenario;
  status: CoverageCheckStatus;
  progressStep: string | null;
  result: CoverageResult | null;
  agentRunIds: string[];
  costPaise: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  expiresAt: string;
  startedAt: string | null;
  readyAt: string | null;
}
