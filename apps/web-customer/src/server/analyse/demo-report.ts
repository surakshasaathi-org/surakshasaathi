/**
 * Canned demo report returned by the dev-stub pipeline.
 *
 * When DEV_STUBS=true (or no ANTHROPIC_API_KEY present), the orchestrator
 * produces this report regardless of what the user uploaded. The shape exactly
 * matches the real PolicyAnalyzer → ReviewAgent output contract so the UI and
 * admin portal render identically in both modes.
 *
 * Based on a realistic Indian family-floater health policy (Star Health Family
 * Health Optima, ₹5L cover). Numbers, dates, and clauses are illustrative.
 */

export type Severity = 'high' | 'medium' | 'low';

export interface ReportCitation {
  page: number;
  section_label: string;
  quoted_text: string;
}

export interface CoverageItem {
  name: string;
  status: 'covered' | 'covered_with_conditions' | 'not_covered';
  note: string;
  citation: ReportCitation;
}

export interface Exclusion {
  text: string;
  plain_language: string;
  is_surprising: boolean;
  citation: ReportCitation;
}

export interface WaitingPeriod {
  condition: string;
  wait_days: number;
  active_until: string;
  notes?: string;
  citation: ReportCitation;
}

export interface SubLimit {
  name: string;
  cap_text: string;
  consequence: string;
  citation: ReportCitation;
}

export interface RedFlag {
  title: string;
  why_it_matters: string;
  evidence: string;
  severity: Severity;
  action?: string;
  citation: ReportCitation;
}

export interface ReadinessComponents {
  coverage_adequacy: number;
  exclusions_and_gaps: number;
  waiting_period_clearance: number;
  nominee_accuracy: number;
  documentation_completeness: number;
}

export interface AnalysisReport {
  version: number;
  generated_at: string;
  locale: string;
  confidence_overall: number;
  readiness_score: number;
  readiness_components: ReadinessComponents;
  readiness_narrative: string;

  quick_summary: string;

  basic_facts: {
    insurer_name: string;
    plan_name: string;
    policy_number: string;
    family_type: string;
    plan_type: string;
    sum_insured_rupees: number;
    premium_rupees: number;
    period_start: string;
    period_end: string;
    members: Array<{ relation: string; age: number; pre_existing: string[] }>;
    nominee_name: string | null;
    nominee_relation: string | null;
    network_hospital_count: number | null;
  };

  covered: CoverageItem[];
  excluded: Exclusion[];
  waiting_periods: WaitingPeriod[];
  sub_limits: SubLimit[];
  copay: {
    voluntary_percentage: number | null;
    mandatory_percentage: number | null;
    age_triggered: { from_age: number; percentage: number } | null;
    deductible_rupees: number | null;
    explanation: string;
  };
  red_flags: RedFlag[];
  what_to_do_now: Array<{
    title: string;
    why: string;
    how: string;
    urgency: 'do_today' | 'do_this_month' | 'optional';
  }>;
  disclaimer: string;
}

export const DEMO_REPORT_EN: AnalysisReport = {
  version: 1,
  generated_at: new Date().toISOString(),
  locale: 'en',
  confidence_overall: 0.86,
  readiness_score: 72,
  readiness_components: {
    coverage_adequacy: 65,
    exclusions_and_gaps: 70,
    waiting_period_clearance: 85,
    nominee_accuracy: 100,
    documentation_completeness: 60,
  },
  readiness_narrative:
    "Your 72 score is typical for Indian family floaters. The biggest drags are the 1% room-rent sub-limit and an incomplete list of declared pre-existing conditions. Fix those two and your score jumps to the mid-80s.",

  quick_summary:
    "This is a ₹5 lakh family floater from Star Health covering you, your spouse, and two children. It covers standard hospitalisation well but has three things you should know: a 3-year wait for diabetes-related claims, a tight room-rent cap at 1% of sum assured (₹5,000/day), and day-care procedures capped at ₹50,000.",

  basic_facts: {
    insurer_name: 'Star Health & Allied Insurance',
    plan_name: 'Family Health Optima',
    policy_number: 'P/12345/2025',
    family_type: 'floater',
    plan_type: 'base',
    sum_insured_rupees: 500000,
    premium_rupees: 22450,
    period_start: '2025-04-01',
    period_end: '2026-03-31',
    members: [
      { relation: 'self', age: 42, pre_existing: ['hypertension'] },
      { relation: 'spouse', age: 39, pre_existing: [] },
      { relation: 'child', age: 12, pre_existing: [] },
      { relation: 'child', age: 8, pre_existing: [] },
    ],
    nominee_name: '••••• Kumar',
    nominee_relation: 'spouse',
    network_hospital_count: 14030,
  },

  covered: [
    {
      name: 'In-patient hospitalisation (>24h)',
      status: 'covered',
      note: 'Room, boarding, nursing, surgeon, anaesthesia, blood, oxygen, medicines, diagnostics all covered up to sum assured.',
      citation: { page: 4, section_label: '§ 2.1', quoted_text: 'Covers expenses incurred on inpatient treatment including room rent, ICU, ...' },
    },
    {
      name: 'Pre-hospitalisation',
      status: 'covered',
      note: 'Up to 60 days before admission.',
      citation: { page: 4, section_label: '§ 2.2', quoted_text: 'Medical expenses incurred 60 days prior to hospitalisation...' },
    },
    {
      name: 'Post-hospitalisation',
      status: 'covered',
      note: 'Up to 90 days after discharge.',
      citation: { page: 4, section_label: '§ 2.3', quoted_text: 'Medical expenses up to 90 days after discharge...' },
    },
    {
      name: 'Day-care procedures',
      status: 'covered_with_conditions',
      note: 'Day-care list covers 101 procedures but capped at ₹50,000 per policy year.',
      citation: { page: 5, section_label: '§ 2.5', quoted_text: 'Day-care procedures from the list attached... subject to ₹50,000 cap.' },
    },
    {
      name: 'Road ambulance',
      status: 'covered_with_conditions',
      note: 'Up to ₹2,000 per hospitalisation event. Only from a registered medical ambulance.',
      citation: { page: 5, section_label: '§ 2.6', quoted_text: 'Expenses on road ambulance subject to ₹2,000 limit...' },
    },
    {
      name: 'AYUSH (Ayurveda/Yoga/Unani/Siddha/Homoeopathy)',
      status: 'covered_with_conditions',
      note: 'Only at govt-recognised AYUSH hospitals. In-patient only.',
      citation: { page: 5, section_label: '§ 2.7', quoted_text: 'AYUSH inpatient treatment in government-recognised hospitals...' },
    },
    {
      name: 'Maternity benefit',
      status: 'not_covered',
      note: 'Not included in this plan. Upgrade or rider required.',
      citation: { page: 6, section_label: '§ 2.8', quoted_text: 'Maternity benefit not included unless opted in.' },
    },
    {
      name: 'Organ donor expenses',
      status: 'covered',
      note: 'Harvesting expenses for organ donor covered up to sum assured.',
      citation: { page: 6, section_label: '§ 2.9', quoted_text: 'Covers medical expenses of organ donor during harvesting...' },
    },
  ],

  excluded: [
    {
      text: 'Cosmetic and aesthetic treatment unless medically necessary',
      plain_language: 'Plastic surgery and aesthetic procedures are not covered unless your doctor certifies they were medically required.',
      is_surprising: false,
      citation: { page: 8, section_label: '§ 3.1', quoted_text: 'Cosmetic, plastic and aesthetic treatment unless medically necessary...' },
    },
    {
      text: 'External congenital diseases',
      plain_language: 'Birth defects that are externally visible (like a cleft lip) are not covered. Internal congenital conditions are covered.',
      is_surprising: true,
      citation: { page: 8, section_label: '§ 3.2', quoted_text: 'External congenital diseases not covered...' },
    },
    {
      text: 'Consumables — gloves, syringes, housekeeping items',
      plain_language: 'Hospitals charge ₹3,000–10,000 in "consumables" that the policy will NOT reimburse. You pay these out of pocket even if the rest of the bill is settled.',
      is_surprising: true,
      citation: { page: 8, section_label: '§ 3.7', quoted_text: 'Consumables including gloves, syringes, PPE kits, housekeeping...' },
    },
    {
      text: 'Dental treatment unless due to accident',
      plain_language: 'Dental procedures are excluded unless arising from a road/work accident.',
      is_surprising: false,
      citation: { page: 9, section_label: '§ 3.10', quoted_text: 'Dental treatment except due to accident...' },
    },
    {
      text: 'Self-inflicted injury, suicide attempt, alcohol/drug abuse',
      plain_language: 'Standard exclusion — injuries caused by substance abuse or self-harm are not covered.',
      is_surprising: false,
      citation: { page: 9, section_label: '§ 3.11', quoted_text: 'Self-inflicted injury, suicide, alcohol/drug abuse...' },
    },
    {
      text: 'Treatment outside India',
      plain_language: 'This policy does not cover treatment taken outside India. Add an international-cover rider if you travel.',
      is_surprising: false,
      citation: { page: 9, section_label: '§ 3.14', quoted_text: 'Treatment outside India is not covered...' },
    },
  ],

  waiting_periods: [
    {
      condition: 'Accidental injury',
      wait_days: 0,
      active_until: '2025-04-01',
      notes: 'Covered from Day 1.',
      citation: { page: 10, section_label: '§ 4.1', quoted_text: 'Accidents covered from the policy inception date.' },
    },
    {
      condition: 'Standard illnesses',
      wait_days: 30,
      active_until: '2025-05-01',
      notes: 'All illnesses other than accident covered after 30 days from inception.',
      citation: { page: 10, section_label: '§ 4.2', quoted_text: 'Illness-based claims except for accidents... 30 day waiting period.' },
    },
    {
      condition: 'Specified conditions — cataract, hernia, ENT, joint replacement',
      wait_days: 365,
      active_until: '2026-04-01',
      notes: 'One-year wait from inception. Covers first-year enrolments; does not reset on renewal.',
      citation: { page: 10, section_label: '§ 4.3', quoted_text: '1 year waiting period for cataract, hernia, ENT...' },
    },
    {
      condition: 'Specified conditions — ENT stones, gastric ulcer, varicose veins',
      wait_days: 730,
      active_until: '2027-04-01',
      notes: 'Two-year wait.',
      citation: { page: 10, section_label: '§ 4.4', quoted_text: '2 year waiting period for specified conditions list...' },
    },
    {
      condition: 'Pre-existing: Hypertension (declared, self)',
      wait_days: 1095,
      active_until: '2028-04-01',
      notes: 'Declared at inception. Coverage begins 1 April 2028. Until then, hypertension-related claims will be declined.',
      citation: { page: 11, section_label: '§ 4.5', quoted_text: 'Pre-existing diseases covered after 36 months of continuous coverage...' },
    },
  ],

  sub_limits: [
    {
      name: 'Room rent',
      cap_text: '1% of sum assured = ₹5,000/day',
      consequence:
        'Bengaluru private single rooms typically charge ₹8,000–10,000/day. Excess room rent triggers PROPORTIONATE deduction across the ENTIRE bill — not just the room bill. A 40% room-rent gap can reduce your payout by ~40%.',
      citation: { page: 13, section_label: '§ 5.1', quoted_text: 'Room rent limited to 1% of sum assured per day. Proportionate deduction applies...' },
    },
    {
      name: 'ICU',
      cap_text: '2% of sum assured = ₹10,000/day',
      consequence: 'Mumbai/Bengaluru ICU rates ₹15,000–25,000/day — similar proportionate risk.',
      citation: { page: 13, section_label: '§ 5.2', quoted_text: 'ICU expenses limited to 2% per day...' },
    },
    {
      name: 'Cataract surgery',
      cap_text: '₹40,000 per eye',
      consequence: 'Premium IOL (intraocular lens) procedures frequently exceed this; balance is out-of-pocket.',
      citation: { page: 13, section_label: '§ 5.3', quoted_text: 'Cataract surgery limited to ₹40,000 per eye...' },
    },
    {
      name: 'Ambulance',
      cap_text: '₹2,000 per hospitalisation',
      consequence: 'Critical care ambulances and long-distance transfers frequently exceed this.',
      citation: { page: 13, section_label: '§ 5.4', quoted_text: 'Ambulance expenses limited to ₹2,000 per hospitalisation event.' },
    },
    {
      name: 'Modern treatments (robotic, stem cell, etc.)',
      cap_text: '50% of sum assured = ₹2,50,000 per claim',
      consequence: 'Procedures using modern treatment methods are capped at half the cover amount.',
      citation: { page: 14, section_label: '§ 5.6', quoted_text: 'Modern treatment methods limited to 50% of sum assured...' },
    },
  ],

  copay: {
    voluntary_percentage: null,
    mandatory_percentage: null,
    age_triggered: { from_age: 60, percentage: 10 },
    deductible_rupees: null,
    explanation:
      'No standard co-pay while primary insured is under 60. Once primary insured turns 60, a 10% co-pay applies to every claim. Every ₹1,00,000 approved claim pays out ₹90,000; you pay the ₹10,000.',
  },

  red_flags: [
    {
      title: '1% room-rent cap + proportionate-deduction clause',
      why_it_matters:
        "This is the single biggest payout-shrinker in Indian health insurance. If your room costs more than ₹5,000/day, the insurer doesn't just deny the extra room cost — it reduces EVERY other bill line by the same ratio. A 40% room gap can cut your total payout by 40%.",
      evidence: '"Room rent limited to 1% of sum assured per day. Proportionate deduction applies."',
      severity: 'high',
      action:
        'Either upgrade to a room-rent-waiver rider if your insurer offers one, OR explicitly ask to be admitted to a shared/semi-private room that fits within ₹5,000/day.',
      citation: { page: 13, section_label: '§ 5.1', quoted_text: 'Room rent limited to 1% of sum assured per day. Proportionate deduction applies...' },
    },
    {
      title: '10% co-pay kicks in when primary insured turns 60',
      why_it_matters:
        "Your policy says that once the primary insured turns 60, every claim has 10% deducted. At age 42, you're 18 years away, but this also applies if you add your 70+ parent under a floater.",
      evidence: '"From the policy year in which the insured completes 60 years, co-pay of 10% applies to all claims..."',
      severity: 'medium',
      action: 'Plan accordingly at renewal age 60. Consider a separate senior-citizen policy for parents over 60.',
      citation: { page: 15, section_label: '§ 6.1', quoted_text: '10% co-pay for insured aged 60+' },
    },
    {
      title: 'Consumables are excluded — expect a ₹3–10k out-of-pocket even on a cashless claim',
      why_it_matters:
        "Even when the insurer approves the claim, gloves, syringes, PPE, and 'housekeeping' items are excluded. Hospitals itemise these explicitly, and you pay these at discharge. Budget ₹3,000–10,000 per hospitalisation.",
      evidence: '"Consumables including gloves, syringes, PPE kits, housekeeping, administrative items not covered."',
      severity: 'medium',
      citation: { page: 8, section_label: '§ 3.7', quoted_text: 'Consumables including gloves, syringes, PPE kits, housekeeping...' },
    },
    {
      title: 'Hypertension claim coverage does not begin until 1 April 2028',
      why_it_matters:
        "You declared hypertension at inception. Any hypertension-related hospitalisation before April 2028 will be declined citing the pre-existing waiting period.",
      evidence: '"Pre-existing diseases covered after 36 months of continuous coverage."',
      severity: 'high',
      action:
        'Maintain continuous renewal — a single lapsed renewal resets the waiting-period clock.',
      citation: { page: 11, section_label: '§ 4.5', quoted_text: 'Pre-existing diseases covered after 36 months of continuous coverage...' },
    },
  ],

  what_to_do_now: [
    {
      title: 'Ask Star Health about a room-rent-waiver add-on',
      why: "The 1% / ₹5,000 room cap is your policy's biggest leak. A waiver add-on (typically ₹1,500–3,000/year extra premium) removes the proportionate-deduction risk entirely.",
      how: "Call Star Health's customer service (1800-425-2255) and ask to add the 'Rent Waiver' rider at the next renewal.",
      urgency: 'do_this_month',
    },
    {
      title: 'Verify your nominee details',
      why: "Out-of-date nominee is a leading cause of death-claim disputes. We detected a nominee name but couldn't verify it's current.",
      how: "Log in at starhealth.in and confirm the nominee name + relation + contact. Update if stale.",
      urgency: 'do_today',
    },
    {
      title: 'If you plan to add parents — consider a separate policy',
      why: "Adding a 60+ parent to this floater triggers the age-based 10% co-pay on every claim — including yours. A separate senior-specific policy avoids this contamination.",
      how: 'Run a quote for a Senior Health Insurance policy (same insurer or different). Cross-check against PM-JAY if the parent is 70+ — they auto-qualify for ₹5 lakh free cover.',
      urgency: 'optional',
    },
    {
      title: 'Save your policy PDF on your phone + share with your spouse',
      why: "At 2 AM in a medical emergency, nobody can find the policy. Save as a shareable note/link on both phones.",
      how: 'Use the Download-as-PDF on this report. Share the link via WhatsApp with your spouse. Also save this share URL — it expires in 7 days but gives you + family quick access meanwhile.',
      urgency: 'do_today',
    },
  ],

  disclaimer:
    "Suraksha Saathi is an AI-powered independent policy analyser. Every fact above cites the specific clause in your uploaded policy. Verify critical details (especially anything involving a sum of money or a future claim) with your insurer before acting. We are not your legal or financial advisor, and we receive no commission from your insurer.",
};

/**
 * The same report structure translated — stub only supplies Hindi and Kannada
 * variants of the narrative fields. Numeric data + citations stay identical.
 */
export const DEMO_REPORT_HI: AnalysisReport = {
  ...DEMO_REPORT_EN,
  locale: 'hi',
  readiness_narrative:
    'आपका 72 स्कोर भारतीय फैमिली फ्लोटर के लिए सामान्य है। सबसे बड़ी कमियाँ 1% रूम-रेंट सब-लिमिट और अधूरी पूर्व-मौजूदा स्थिति की घोषणा हैं। इन दोनों को ठीक करें और स्कोर मध्य-80 में आ जाएगा।',
  quick_summary:
    'यह Star Health का ₹5 लाख फैमिली फ्लोटर है जो आप, आपके जीवनसाथी और दो बच्चों को कवर करता है। मानक अस्पताल भर्ती अच्छी तरह कवर है, लेकिन तीन बातें जानें: मधुमेह के लिए 3 साल की प्रतीक्षा, 1% रूम-रेंट कैप (₹5,000/दिन), और डे-केयर प्रक्रियाएँ ₹50,000 पर सीमित।',
};

export const DEMO_REPORT_KN: AnalysisReport = {
  ...DEMO_REPORT_EN,
  locale: 'kn',
  readiness_narrative:
    'ನಿಮ್ಮ 72 ಸ್ಕೋರ್ ಭಾರತೀಯ ಫ್ಯಾಮಿಲಿ ಫ್ಲೋಟರ್‌ಗೆ ಸಾಧಾರಣ. ದೊಡ್ಡ ಕೊರತೆಗಳು 1% ಕೋಣೆ ಬಾಡಿಗೆ ಸಬ್-ಲಿಮಿಟ್ ಮತ್ತು ಅಪೂರ್ಣ ಮುನ್ಚಿತ ರೋಗ ಘೋಷಣೆ. ಈ ಎರಡನ್ನೂ ಸರಿಪಡಿಸಿ, ಸ್ಕೋರ್ 80 ನಂತರ ಬರುತ್ತದೆ.',
  quick_summary:
    'ಇದು Star Health ನ ₹5 ಲಕ್ಷ ಫ್ಯಾಮಿಲಿ ಫ್ಲೋಟರ್ — ನೀವು, ನಿಮ್ಮ ಸಂಗಾತಿ, ಇಬ್ಬರು ಮಕ್ಕಳನ್ನು ಒಳಗೊಂಡಿದೆ. ಸಾಮಾನ್ಯ ಆಸ್ಪತ್ರೆ ದಾಖಲಾತಿ ಚೆನ್ನಾಗಿ ಕವರ್ ಆಗಿದೆ. ಮೂರು ವಿಷಯ: ಮಧುಮೇಹಕ್ಕೆ 3 ವರ್ಷ ಕಾಯುವ ಅವಧಿ, 1% ಕೋಣೆ ಬಾಡಿಗೆ ಮಿತಿ (₹5,000/ದಿನ), ಡೇ-ಕೇರ್ ₹50,000 ಮಿತಿ.',
};

export function demoReportFor(locale: string): AnalysisReport {
  if (locale === 'hi') return DEMO_REPORT_HI;
  if (locale === 'kn') return DEMO_REPORT_KN;
  return DEMO_REPORT_EN;
}
