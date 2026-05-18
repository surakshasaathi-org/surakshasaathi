import 'server-only';

/**
 * Dev-mode fixture for agents list + per-agent version history.
 *
 * When DATABASE_URL is set, admin reads from the `agent_definition` table.
 * The seed in packages/db/src/seed/agent-definitions.ts defines the same set;
 * this mirror lets the admin UX render without DB.
 */

export type ModelTier = 'opus' | 'sonnet' | 'haiku';

export interface AgentVersion {
  slug: string;
  version: number;
  displayName: string;
  purpose: string;
  modelTier: ModelTier;
  systemPrompt: string;
  tools: string[];
  temperature: number;
  maxTokens: number;
  reviewRequired: boolean;
  enabled: boolean;
  isDefault: boolean;
  localesSupported: string[];
  createdAt: string;
  createdBy: string;
  changeNote: string;
}

export interface AgentRegistryEntry {
  slug: string;
  displayName: string;
  purpose: string;
  modelTier: ModelTier;
  defaultVersion: number;
  reviewRequired: boolean;
  tools: string[];
  localesSupported: string[];
  usage7d: number;
  avgCostPaise: number;
  avgConfidence: number;
  avgLatencyMs: number;
  versions: AgentVersion[];
}

const daysAgo = (d: number) => new Date(Date.now() - d * 24 * 60 * 60 * 1000).toISOString();

function defV(
  slug: string,
  displayName: string,
  purpose: string,
  tier: ModelTier,
  systemPrompt: string,
  tools: string[],
  reviewRequired: boolean,
  changeNote: string,
): AgentVersion {
  return {
    slug,
    version: 1,
    displayName,
    purpose,
    modelTier: tier,
    systemPrompt,
    tools,
    temperature: 0.2,
    maxTokens: tier === 'haiku' ? 1024 : tier === 'sonnet' ? 4096 : 4096,
    reviewRequired,
    enabled: true,
    isDefault: true,
    localesSupported: ['en', 'hi', 'kn'],
    createdAt: daysAgo(14),
    createdBy: 'system-seed',
    changeNote,
  };
}

const POLICY_ANALYZER_PROMPT_V1 = `You are the PolicyAnalyzer — the Before-chapter flagship agent on the SurakshaSaathi protection platform. You read an Indian health-insurance policy and produce a structured 10-section report that a plain-language reader can act on.

Rules of the road:
  - Every fact in the report must be grounded in the provided OCR text. If a fact is not explicitly present, mark it \`not_found_in_policy\` with null confidence. NEVER invent a clause.
  - Every claim cites the exact page + section label + verbatim quote.
  - Every plain-language statement carries a confidence 0–1.
  - Red flags are things the user probably didn't realize — quantified consequences, not legalese. Cite the clause verbatim.
  - The Claim Readiness Score (0–100) combines 5 dimensions (coverage, gaps, waits, nominee, docs) with published weights (0.35, 0.25, 0.15, 0.10, 0.15). Show the math.
  - Tone: direct, empathetic, never alarmist. We are on the user's side; we are not their lawyer.

Output format: strict JSON matching the AnalysisReport schema. No prose outside JSON.`;

const POLICY_ANALYZER_PROMPT_V2 = POLICY_ANALYZER_PROMPT_V1 + `

Additional guidance (v2 — added 7 days ago after quality review):
  - When a sub-limit triggers proportionate-deduction, always surface the cascading-deduction consequence as a red flag with a worked example.
  - When the primary insured is within 5 years of an age-based co-pay kick-in, surface it.
  - When a declared pre-existing condition's waiting period has not yet elapsed, flag the exact date it activates.`;

export const AGENTS: AgentRegistryEntry[] = [
  {
    slug: 'intake-agent',
    displayName: 'Intake Triage',
    purpose: 'Confirm an uploaded document is an Indian health-insurance policy and route it into the pipeline.',
    modelTier: 'haiku',
    defaultVersion: 1,
    reviewRequired: false,
    tools: [],
    localesSupported: ['en', 'hi', 'kn'],
    usage7d: 234,
    avgCostPaise: 32,
    avgConfidence: 0.93,
    avgLatencyMs: 2100,
    versions: [
      defV(
        'intake-agent',
        'Intake Triage',
        'Confirm health-policy scope; flag off-scope uploads.',
        'haiku',
        `You triage uploaded documents on SurakshaSaathi. Given the first ~2,000 OCR tokens, decide if this is an Indian health-insurance policy.

Return strict JSON: { is_health_insurance_policy: bool, confidence: 0-1, detected_insurance_line: "health"|"life"|"motor"|"travel"|"other", off_scope_reason: string|null, detected_locale_of_policy: "en"|"hi"|"kn"|"ta"|"te"|"bn" }.

Off-scope reasons to flag: life/ULIP, motor/vehicle, travel, group-policy, proposal-form-only (not issued), non-policy (invoice, aadhaar, etc.).`,
        [],
        false,
        'Initial seed.',
      ),
    ],
  },
  {
    slug: 'document-agent',
    displayName: 'Document Extractor',
    purpose: 'OCR + structured field extraction from the policy PDF/photo.',
    modelTier: 'sonnet',
    defaultVersion: 1,
    reviewRequired: false,
    tools: ['extract_policy_fields', 'lookup_insurer_metadata'],
    localesSupported: ['en', 'hi', 'kn'],
    usage7d: 201,
    avgCostPaise: 980,
    avgConfidence: 0.87,
    avgLatencyMs: 11200,
    versions: [
      defV(
        'document-agent',
        'Document Extractor',
        'Extract 25+ canonical fields from a health policy.',
        'sonnet',
        `You extract structured fields from Indian health-insurance policies. Input: full OCR text + page-segmented tokens. Output: strict JSON matching the extraction schema.

Rules:
  - Never invent fields. Use null for anything not explicitly in the OCR text.
  - Preserve original casing, spellings, and numbers. Do NOT normalise names.
  - For amounts, return the exact paise integer.
  - Flag low-confidence fields in \`low_confidence_fields\`.
  - If you detect a non-health document (ULIP, motor), stop and emit { off_scope: true, detected_line: "…" }.`,
        ['extract_policy_fields', 'lookup_insurer_metadata'],
        false,
        'Initial seed.',
      ),
    ],
  },
  {
    slug: 'policy-analyzer',
    displayName: 'Policy Analyzer',
    purpose: 'Deep 10-section report generation — the flagship Before-chapter agent.',
    modelTier: 'opus',
    defaultVersion: 2,
    reviewRequired: false,
    tools: ['lookup_glossary', 'lookup_urban_health_cost_bench', 'lookup_known_red_flag_patterns'],
    localesSupported: ['en', 'hi', 'kn'],
    usage7d: 198,
    avgCostPaise: 7020,
    avgConfidence: 0.86,
    avgLatencyMs: 31400,
    versions: [
      {
        slug: 'policy-analyzer',
        version: 1,
        displayName: 'Policy Analyzer',
        purpose: 'Deep 10-section report generation.',
        modelTier: 'opus',
        systemPrompt: POLICY_ANALYZER_PROMPT_V1,
        tools: ['lookup_glossary', 'lookup_urban_health_cost_bench', 'lookup_known_red_flag_patterns'],
        temperature: 0.15,
        maxTokens: 6000,
        reviewRequired: false,
        enabled: true,
        isDefault: false,
        localesSupported: ['en', 'hi', 'kn'],
        createdAt: daysAgo(14),
        createdBy: 'system-seed',
        changeNote: 'Initial seed.',
      },
      {
        slug: 'policy-analyzer',
        version: 2,
        displayName: 'Policy Analyzer',
        purpose: 'Deep 10-section report generation (improved red-flag heuristics).',
        modelTier: 'opus',
        systemPrompt: POLICY_ANALYZER_PROMPT_V2,
        tools: ['lookup_glossary', 'lookup_urban_health_cost_bench', 'lookup_known_red_flag_patterns'],
        temperature: 0.15,
        maxTokens: 6000,
        reviewRequired: false,
        enabled: true,
        isDefault: true,
        localesSupported: ['en', 'hi', 'kn'],
        createdAt: daysAgo(7),
        createdBy: 'content_editor@surakshasaathi.com',
        changeNote:
          'Added proportionate-deduction cascade flag, age-based co-pay proximity alert, pre-existing wait-end date flag. Wins: +12% red-flag recall on 25-policy eval set.',
      },
    ],
  },
  {
    slug: 'translation-agent',
    displayName: 'Translation Agent (glossary-gated)',
    purpose: 'Localise the plain-language sections to Hindi + Kannada using the insurance glossary.',
    modelTier: 'sonnet',
    defaultVersion: 1,
    reviewRequired: false,
    tools: ['lookup_glossary'],
    localesSupported: ['en', 'hi', 'kn'],
    usage7d: 180,
    avgCostPaise: 490,
    avgConfidence: 0.91,
    avgLatencyMs: 8800,
    versions: [
      defV(
        'translation-agent',
        'Translation Agent',
        'Glossary-gated localisation for reports.',
        'sonnet',
        `You localise SurakshaSaathi reports into Indian languages. For every regulated insurance term, use the glossary translation VERBATIM. For terms not in the glossary, flag them in \`needs_glossary_review\`. Preserve numbers, amounts, dates, clause citations untouched. Tone: empathetic, direct, not promotional.

Output JSON: { localised_sections: { ... }, needs_glossary_review: [...] }.`,
        ['lookup_glossary'],
        false,
        'Initial seed.',
      ),
    ],
  },
  {
    slug: 'review-agent',
    displayName: 'Review Agent (citation verifier)',
    purpose: 'Last pass before user sees the report — verify citations, catch hallucinations, enforce tone.',
    modelTier: 'opus',
    defaultVersion: 1,
    reviewRequired: false,
    tools: ['lookup_glossary'],
    localesSupported: ['en', 'hi', 'kn'],
    usage7d: 175,
    avgCostPaise: 4950,
    avgConfidence: 0.92,
    avgLatencyMs: 18400,
    versions: [
      defV(
        'review-agent',
        'Review Agent',
        'Verify every cited clause exists in OCR text; flag low-confidence sections.',
        'opus',
        `You are the last automated check before a report reaches the user. Given the report JSON + the original OCR text, verify every citation exists verbatim, flag sections with confidence < 0.5 for a visible "verify with insurer" warning, catch tone issues (alarmist language on low-confidence red flags), and check math (score components summing right).

Output strict JSON: { issues: [{ severity: "block"|"warn"|"info", section: int, index: int, reason: string, action: "suppress"|"warn"|"none" }], action_summary: string }. Do NOT modify the report yourself — just flag.`,
        ['lookup_glossary'],
        false,
        'Initial seed.',
      ),
    ],
  },
];

export function getAgent(slug: string): AgentRegistryEntry | null {
  return AGENTS.find((a) => a.slug === slug) ?? null;
}
