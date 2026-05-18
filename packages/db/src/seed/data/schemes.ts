/**
 * Government scheme definitions — used by the DB seed AND by the customer app's
 * dev-mode data fallback (when DATABASE_URL isn't set).
 *
 * Source of truth: docs/SurakshaSaathi_GovtScheme_Navigator_Reference.docx (April 2026).
 *
 * Eligibility rules use a small JSON DSL that the matcher evaluates:
 *   { all_of: [...rule] }  — every subrule must match
 *   { any_of: [...rule] }  — at least one subrule must match
 *   { not: rule }          — rule must NOT match
 *   { age_gte: N }         — user's age >= N
 *   { age_lte: N }         — user's age <= N
 *   { age_between: [A,B] } — A <= age <= B
 *   { income_lte_lakh: N } — household income <= N lakh/year
 *   { state_in: [...] }    — user's state code in list
 *   { occupation_in: [...] } — occupation slug in list
 *   { secc_deprived: true } — user marked as SECC 2011 deprivation category
 *   { has_bank_account: true }
 *   { consent_to_auto_debit: true }
 *   { employed_in_covered_establishment: true }
 *   { central_govt_employee: true }
 *   { ex_serviceman: true }
 *   { gender: 'female' }   — if needed
 *
 * The matcher returns one of: "eligible" | "possibly_eligible" | "not_eligible".
 * "possibly_eligible" is for rules we can't fully evaluate from the inputs we have.
 */

export interface SchemeSeed {
  id: string;
  slug: string;
  level: 'central' | 'state';
  stateCode: string | null;
  nameI18n: Record<string, string>;
  summaryI18n: Record<string, string>;
  eligibilityRules: Record<string, unknown>;
  coveragePaise: number | null;
  lineIds: string[];
  applicationChannels: string[];
  helplines: string[];
  portals: string[];
  version: number;
  effectiveFrom: string; // YYYY-MM-DD
  deprecatedFrom: string | null;
}

export const SCHEMES: SchemeSeed[] = [
  /* ═══════════════════════ CENTRAL SCHEMES ═══════════════════════ */

  {
    id: 'pm-jay@v2',
    slug: 'pm-jay',
    level: 'central',
    stateCode: null,
    nameI18n: {
      en: 'Ayushman Bharat PM-JAY',
      hi: 'आयुष्मान भारत PM-JAY',
      kn: 'ಆಯುಷ್ಮಾನ್ ಭಾರತ PM-JAY',
    },
    summaryI18n: {
      en: 'Cashless secondary and tertiary hospitalisation up to ₹5 lakh per family per year. No cap on family size. Pre-existing diseases covered from Day 1. All Indians aged 70+ auto-eligible since October 2024. Portable across states.',
      hi: 'प्रति परिवार प्रति वर्ष ₹5 लाख तक कैशलेस अस्पताल भर्ती। परिवार के आकार की कोई सीमा नहीं। पूर्व-मौजूदा रोग Day 1 से कवर। अक्टूबर 2024 से सभी 70+ भारतीयों के लिए स्वचालित पात्रता।',
      kn: 'ಪ್ರತಿ ಕುಟುಂಬಕ್ಕೆ ವರ್ಷಕ್ಕೆ ₹5 ಲಕ್ಷದವರೆಗೆ ನಗದು-ರಹಿತ ಆಸ್ಪತ್ರೆ ದಾಖಲಾತಿ. ಕುಟುಂಬದ ಗಾತ್ರ ಮಿತಿ ಇಲ್ಲ. ಮುನ್ಚಿತ ರೋಗಗಳು Day 1 ರಿಂದ. ಅಕ್ಟೋಬರ್ 2024 ರಿಂದ 70+ ಸ್ವಯಂ-ಅರ್ಹ.',
    },
    eligibilityRules: {
      any_of: [
        { age_gte: 70 }, // Auto-eligible Oct 2024+
        { secc_deprived: true },
        { occupation_in: ['rag_picker', 'domestic_worker', 'street_vendor', 'construction_worker', 'security_guard', 'sanitation_worker', 'home_based_worker', 'transport_worker', 'shop_assistant', 'electrician', 'washerman', 'beggar', 'migrant_worker'] },
        { state_scheme_beneficiary: true },
      ],
    },
    coveragePaise: 50000000, // ₹5 lakh in paise
    lineIds: ['health'],
    applicationChannels: ['beneficiary.nha.gov.in', 'ayushman-bharat-app', 'csc', 'bank_branch', 'ayushman-mitra-desk', 'sms-14555'],
    helplines: ['14555', '1800-111-565'],
    portals: ['pmjay.gov.in', 'beneficiary.nha.gov.in', 'cgrms.pmjay.gov.in'],
    version: 2,
    effectiveFrom: '2024-10-29',
    deprecatedFrom: null,
  },

  {
    id: 'pmsby@v2',
    slug: 'pmsby',
    level: 'central',
    stateCode: null,
    nameI18n: {
      en: 'Pradhan Mantri Suraksha Bima Yojana',
      hi: 'प्रधानमंत्री सुरक्षा बीमा योजना',
      kn: 'ಪ್ರಧಾನ ಮಂತ್ರಿ ಸುರಕ್ಷಾ ಬೀಮಾ ಯೋಜನೆ',
    },
    summaryI18n: {
      en: '₹2 lakh accidental death / total disability cover; ₹1 lakh partial. Annual premium ₹20 auto-debited on or before 1 June. Age 18–70 with any savings bank or post-office account. Does NOT cover natural death or suicide.',
      hi: 'आकस्मिक मृत्यु/पूर्ण विकलांगता पर ₹2 लाख, आंशिक पर ₹1 लाख। वार्षिक प्रीमियम ₹20, 1 जून से पहले ऑटो-डेबिट। 18–70 वर्ष, बचत बैंक या डाकघर खाता। प्राकृतिक मृत्यु और आत्महत्या कवर नहीं।',
      kn: 'ಅಪಘಾತ ಸಾವು/ಪೂರ್ಣ ಅಂಗವೈಕಲ್ಯಕ್ಕೆ ₹2 ಲಕ್ಷ, ಭಾಗಶಃ ಅಂಗವೈಕಲ್ಯಕ್ಕೆ ₹1 ಲಕ್ಷ. ವಾರ್ಷಿಕ ಪ್ರೀಮಿಯಂ ₹20, ಜೂನ್ 1 ಒಳಗೆ ಸ್ವಯಂ-ಡೆಬಿಟ್. 18–70 ವಯಸ್ಸು, ಉಳಿತಾಯ ಬ್ಯಾಂಕ್/ಅಂಚೆ ಖಾತೆ.',
    },
    eligibilityRules: {
      all_of: [
        { age_between: [18, 70] },
        { has_bank_account: true },
        { consent_to_auto_debit: true },
      ],
    },
    coveragePaise: 20000000,
    lineIds: ['life'],
    applicationChannels: ['bank_branch', 'net_banking', 'jansuraksha.gov.in'],
    helplines: [],
    portals: ['jansuraksha.gov.in', 'myscheme.gov.in/schemes/pmsby'],
    version: 2,
    effectiveFrom: '2015-05-09',
    deprecatedFrom: null,
  },

  {
    id: 'pmjjby@v2',
    slug: 'pmjjby',
    level: 'central',
    stateCode: null,
    nameI18n: {
      en: 'Pradhan Mantri Jeevan Jyoti Bima Yojana',
      hi: 'प्रधानमंत्री जीवन ज्योति बीमा योजना',
      kn: 'ಪ್ರಧಾನ ಮಂತ್ರಿ ಜೀವನ್ ಜ್ಯೋತಿ ಬೀಮಾ ಯೋಜನೆ',
    },
    summaryI18n: {
      en: '₹2 lakh life cover — death from ANY cause (natural, accidental, disease). Annual premium ₹436. Age 18–50 to join, continue to age 55. NO physical policy document issued — many families never claim. Check your bank statement for annual ₹436 debit.',
      hi: '₹2 लाख जीवन कवर — किसी भी कारण से मृत्यु। वार्षिक प्रीमियम ₹436। 18–50 वर्ष में जुड़ें, 55 तक जारी। कोई दस्तावेज़ नहीं — कई परिवार दावा नहीं करते। बैंक स्टेटमेंट में ₹436 डेबिट देखें।',
      kn: '₹2 ಲಕ್ಷ ಜೀವ ಕವರ್ — ಯಾವುದೇ ಕಾರಣದಿಂದ ಸಾವು. ವಾರ್ಷಿಕ ಪ್ರೀಮಿಯಂ ₹436. 18–50 ವಯಸ್ಸಿನಲ್ಲಿ ಸೇರಿ, 55 ವರೆಗೂ ಮುಂದುವರಿಕೆ. ಪಾಲಿಸಿ ದಾಖಲೆ ಇಲ್ಲ — ಅನೇಕ ಕುಟುಂಬಗಳು ಕ್ಲೈಮ್ ಮಾಡುವುದಿಲ್ಲ.',
    },
    eligibilityRules: {
      all_of: [
        { age_between: [18, 50] },
        { has_bank_account: true },
        { consent_to_auto_debit: true },
      ],
    },
    coveragePaise: 20000000,
    lineIds: ['life'],
    applicationChannels: ['bank_branch', 'net_banking', 'post-office', 'jansuraksha.gov.in'],
    helplines: [],
    portals: ['jansuraksha.gov.in', 'myscheme.gov.in/schemes/pmjjby', 'financialservices.gov.in/beta/en/pmjjby'],
    version: 2,
    effectiveFrom: '2015-05-09',
    deprecatedFrom: null,
  },

  {
    id: 'cghs@v1',
    slug: 'cghs',
    level: 'central',
    stateCode: null,
    nameI18n: {
      en: 'Central Government Health Scheme (CGHS)',
      hi: 'केंद्र सरकार स्वास्थ्य योजना (CGHS)',
      kn: 'ಕೇಂದ್ರ ಸರ್ಕಾರಿ ಆರೋಗ್ಯ ಯೋಜನೆ (CGHS)',
    },
    summaryI18n: {
      en: 'Comprehensive healthcare (OPD + hospitalisation + medicines + diagnostics + AYUSH) for central govt employees, pensioners, MPs, SC/HC judges. Monthly contribution ₹250–1000 slab-based. 80 cities, 2,486 empanelled private hospitals.',
      hi: 'केंद्र सरकार के कर्मचारियों, पेंशनरों, सांसदों, SC/HC न्यायाधीशों के लिए व्यापक स्वास्थ्य सेवा। मासिक अंशदान ₹250–1000। 80 शहर, 2,486 एम्पैनल्ड निजी अस्पताल।',
      kn: 'ಕೇಂದ್ರ ಸರ್ಕಾರಿ ಉದ್ಯೋಗಿಗಳು, ಪಿಂಚಣಿದಾರರು, ಸಂಸದರಿಗೆ ಸಮಗ್ರ ಆರೋಗ್ಯ ಸೇವೆ. ಮಾಸಿಕ ಶುಲ್ಕ ₹250–1000. 80 ನಗರಗಳು, 2,486 ಖಾಸಗಿ ಆಸ್ಪತ್ರೆಗಳು.',
    },
    eligibilityRules: {
      any_of: [
        { central_govt_employee: true },
        { central_govt_pensioner: true },
        { mp_or_judge: true },
      ],
    },
    coveragePaise: null,
    lineIds: ['health'],
    applicationChannels: ['cghs-wellness-centre', 'cghs.mohfw.gov.in'],
    helplines: [],
    portals: ['cghs.mohfw.gov.in'],
    version: 1,
    effectiveFrom: '1954-07-01',
    deprecatedFrom: null,
  },

  {
    id: 'esic@v1',
    slug: 'esic',
    level: 'central',
    stateCode: null,
    nameI18n: {
      en: 'Employee State Insurance (ESI)',
      hi: 'कर्मचारी राज्य बीमा (ESI)',
      kn: 'ಉದ್ಯೋಗಿ ರಾಜ್ಯ ವಿಮಾ (ESI)',
    },
    summaryI18n: {
      en: 'Medical care from Day 1 + cash benefits (sickness 70% wages 91 days, maternity 100% wages 26 weeks, disability 90%, funeral ₹15,000) for employees earning up to ₹21,000/month in covered establishments. Contribution: 0.75% employee + 3.25% employer.',
      hi: 'कवर्ड प्रतिष्ठानों में ₹21,000/माह तक कमाने वाले कर्मचारियों को Day 1 से चिकित्सा सेवा और नकद लाभ। अंशदान: 0.75% कर्मचारी + 3.25% नियोक्ता।',
      kn: '₹21,000/ತಿಂಗಳವರೆಗೆ ಆದಾಯ ಇರುವ ಉದ್ಯೋಗಿಗಳಿಗೆ Day 1 ರಿಂದ ವೈದ್ಯಕೀಯ ಸೇವೆ ಮತ್ತು ನಗದು ಲಾಭಗಳು. ಶುಲ್ಕ: 0.75% ಉದ್ಯೋಗಿ + 3.25% ಉದ್ಯೋಗದಾತ.',
    },
    eligibilityRules: {
      all_of: [
        { employed_in_covered_establishment: true },
        { income_lte_monthly: 21000 },
      ],
    },
    coveragePaise: null,
    lineIds: ['health', 'life'],
    applicationChannels: ['employer-registration', 'esic.gov.in'],
    helplines: ['011-27552237'],
    portals: ['esic.gov.in', 'shramsuvidha.gov.in'],
    version: 1,
    effectiveFrom: '1952-02-24',
    deprecatedFrom: null,
  },

  {
    id: 'echs@v1',
    slug: 'echs',
    level: 'central',
    stateCode: null,
    nameI18n: {
      en: 'Ex-Servicemen Contributory Health Scheme (ECHS)',
      hi: 'पूर्व-सैनिक अंशदायी स्वास्थ्य योजना (ECHS)',
      kn: 'ಮಾಜಿ-ಸೈನಿಕ ಆರೋಗ್ಯ ಯೋಜನೆ (ECHS)',
    },
    summaryI18n: {
      en: 'Cashless healthcare for ex-servicemen and families at 426 polyclinics + 14,000+ empanelled hospitals. One-time contribution ₹30,000–1,20,000 based on rank.',
      hi: '426 पॉलीक्लिनिक और 14,000+ एम्पैनल्ड अस्पतालों पर पूर्व-सैनिकों और परिवारों के लिए कैशलेस स्वास्थ्य सेवा। एक बार का अंशदान ₹30,000–1,20,000।',
      kn: '426 ಪಾಲಿಕ್ಲಿನಿಕ್, 14,000+ ಆಸ್ಪತ್ರೆಗಳಲ್ಲಿ ಮಾಜಿ-ಸೈನಿಕರಿಗೆ ನಗದು-ರಹಿತ ಸೇವೆ. ಒಂದು-ಬಾರಿ ಶುಲ್ಕ ₹30,000–1,20,000.',
    },
    eligibilityRules: { ex_serviceman: true },
    coveragePaise: null,
    lineIds: ['health'],
    applicationChannels: ['echs-polyclinic'],
    helplines: [],
    portals: ['echs.gov.in'],
    version: 1,
    effectiveFrom: '2003-04-01',
    deprecatedFrom: null,
  },

  {
    id: 'vaya-vandana@v1',
    slug: 'vaya-vandana',
    level: 'central',
    stateCode: null,
    nameI18n: {
      en: 'Ayushman Vay Vandana (Seniors 70+)',
      hi: 'आयुष्मान वय वंदना (70+ वरिष्ठ)',
      kn: 'ಆಯುಷ್ಮಾನ್ ವಯ ವಂದನಾ (70+)',
    },
    summaryI18n: {
      en: '₹5 lakh additional cover exclusively for senior citizens aged 70+, from October 2024. Does NOT merge with the PM-JAY family floater — it stacks on top. 47 lakh cards issued by Feb 2025.',
      hi: '70+ वरिष्ठ नागरिकों के लिए अलग से ₹5 लाख कवर, अक्टूबर 2024 से। PM-JAY परिवार फ्लोटर के साथ विलीन नहीं होता — इसके ऊपर स्टैक होता है।',
      kn: '70+ ಹಿರಿಯರಿಗೆ ₹5 ಲಕ್ಷ ಅಧಿಕ ಕವರ್, ಅಕ್ಟೋಬರ್ 2024 ರಿಂದ. PM-JAY ಕುಟುಂಬ ಫ್ಲೋಟರ್‌ನೊಂದಿಗೆ ವಿಲೀನವಾಗುವುದಿಲ್ಲ.',
    },
    eligibilityRules: { age_gte: 70 },
    coveragePaise: 50000000,
    lineIds: ['health'],
    applicationChannels: ['beneficiary.nha.gov.in', 'ayushman-bharat-app', 'csc'],
    helplines: ['14555'],
    portals: ['beneficiary.nha.gov.in'],
    version: 1,
    effectiveFrom: '2024-10-29',
    deprecatedFrom: null,
  },

  /* ═══════════════════════ STATE SCHEMES ═══════════════════════ */

  {
    id: 'mjpjay-mh@v1',
    slug: 'mjpjay',
    level: 'state',
    stateCode: 'MH',
    nameI18n: {
      en: 'Mahatma Jyotiba Phule Jan Arogya Yojana (Maharashtra)',
      hi: 'महात्मा ज्योतिबा फुले जन आरोग्य योजना',
      kn: 'ಮಹಾತ್ಮಾ ಜ್ಯೋತಿಬಾ ಫುಲೆ ಜನ ಆರೋಗ್ಯ ಯೋಜನೆ (MH)',
    },
    summaryI18n: {
      en: '₹5 lakh cover for BPL families + farmers in Maharashtra. 1,209 treatments across 34 specialities. No waiting period for pre-existing diseases.',
      hi: 'महाराष्ट्र के BPL परिवारों और किसानों के लिए ₹5 लाख कवर। 34 विशेषताओं में 1,209 उपचार।',
      kn: 'ಮಹಾರಾಷ್ಟ್ರದ BPL ಕುಟುಂಬಗಳು ಮತ್ತು ರೈತರಿಗೆ ₹5 ಲಕ್ಷ. 34 ವಿಭಾಗಗಳಲ್ಲಿ 1,209 ಚಿಕಿತ್ಸೆಗಳು.',
    },
    eligibilityRules: {
      all_of: [
        { state_in: ['MH'] },
        { any_of: [{ bpl: true }, { farmer: true }, { secc_deprived: true }] },
      ],
    },
    coveragePaise: 50000000,
    lineIds: ['health'],
    applicationChannels: ['jeevandayee.gov.in', 'district-hospital'],
    helplines: ['155388', '18002332200'],
    portals: ['jeevandayee.gov.in'],
    version: 1,
    effectiveFrom: '2017-04-01',
    deprecatedFrom: null,
  },

  {
    id: 'cmchis-tn@v1',
    slug: 'cmchis',
    level: 'state',
    stateCode: 'TN',
    nameI18n: {
      en: "Chief Minister's Comprehensive Health Insurance (Tamil Nadu)",
      hi: 'मुख्यमंत्री समग्र स्वास्थ्य बीमा योजना (TN)',
      kn: 'ಮುಖ್ಯಮಂತ್ರಿ ಸಮಗ್ರ ಆರೋಗ್ಯ ವಿಮೆ (TN)',
    },
    summaryI18n: {
      en: '₹5 lakh cover for families with income under ₹1.2 lakh/year in Tamil Nadu. 1,090+ procedures. Underwritten by United India Insurance. Pre-existing covered from Day 1.',
      hi: 'तमिलनाडु में ₹1.2 लाख/वर्ष से कम आय वाले परिवारों को ₹5 लाख कवर। 1,090+ प्रक्रियाएं।',
      kn: 'ತಮಿಳುನಾಡಿನಲ್ಲಿ ವರ್ಷಕ್ಕೆ ₹1.2 ಲಕ್ಷಕ್ಕಿಂತ ಕಡಿಮೆ ಆದಾಯದ ಕುಟುಂಬಗಳಿಗೆ ₹5 ಲಕ್ಷ. 1,090+ ಪ್ರಕ್ರಿಯೆಗಳು.',
    },
    eligibilityRules: {
      all_of: [
        { state_in: ['TN'] },
        { income_lte_lakh: 1.2 },
      ],
    },
    coveragePaise: 50000000,
    lineIds: ['health'],
    applicationChannels: ['cmchistn.com', 'ration-shop', 'district-hospital'],
    helplines: ['18004252253'],
    portals: ['cmchistn.com'],
    version: 1,
    effectiveFrom: '2012-01-01',
    deprecatedFrom: null,
  },

  {
    id: 'aarogyasri-ap@v1',
    slug: 'aarogyasri-ap',
    level: 'state',
    stateCode: 'AP',
    nameI18n: {
      en: 'Dr. NTR Vaidya Seva (Andhra Pradesh, formerly YSR Aarogyasri)',
      hi: 'डॉ. NTR वैद्य सेवा (AP)',
      kn: 'ಡಾ. NTR ವೈದ್ಯ ಸೇವೆ (AP)',
    },
    summaryI18n: {
      en: '₹5 lakh cover for AP residents with income below ₹5 lakh/year. 3,257 in-patient treatments across 31 categories. Free screening + OPD consultations.',
      hi: 'AP में ₹5 लाख/वर्ष से कम आय वालों को ₹5 लाख कवर। 31 श्रेणियों में 3,257 उपचार।',
      kn: 'ಆಂಧ್ರ ಪ್ರದೇಶದಲ್ಲಿ ವರ್ಷಕ್ಕೆ ₹5 ಲಕ್ಷಕ್ಕಿಂತ ಕಡಿಮೆ ಆದಾಯದವರಿಗೆ ₹5 ಲಕ್ಷ. 31 ವಿಭಾಗಗಳಲ್ಲಿ 3,257 ಚಿಕಿತ್ಸೆಗಳು.',
    },
    eligibilityRules: {
      all_of: [
        { state_in: ['AP'] },
        { income_lte_lakh: 5 },
      ],
    },
    coveragePaise: 50000000,
    lineIds: ['health'],
    applicationChannels: ['ntrvaidyaseva.ap.gov.in'],
    helplines: ['104'],
    portals: ['ntrvaidyaseva.ap.gov.in'],
    version: 1,
    effectiveFrom: '2007-04-01',
    deprecatedFrom: null,
  },

  {
    id: 'aarogyasri-ts@v1',
    slug: 'aarogyasri-ts',
    level: 'state',
    stateCode: 'TG',
    nameI18n: {
      en: 'Telangana Aarogyasri',
      hi: 'तेलंगाना आरोग्यश्री',
      kn: 'ತೆಲಂಗಾಣ ಆರೋಗ್ಯಶ್ರೀ',
    },
    summaryI18n: {
      en: '₹5 lakh cover for low-income Telangana families. Also Employee Health Scheme for state govt employees. Cashless at govt and private empanelled hospitals.',
      hi: 'तेलंगाना के कम आय वाले परिवारों को ₹5 लाख कवर।',
      kn: 'ತೆಲಂಗಾಣದ ಕಡಿಮೆ ಆದಾಯದ ಕುಟುಂಬಗಳಿಗೆ ₹5 ಲಕ್ಷ.',
    },
    eligibilityRules: {
      all_of: [
        { state_in: ['TG'] },
        { any_of: [{ bpl: true }, { income_lte_lakh: 2 }] },
      ],
    },
    coveragePaise: 50000000,
    lineIds: ['health'],
    applicationChannels: ['aarogyasri.telangana.gov.in'],
    helplines: ['104'],
    portals: ['aarogyasri.telangana.gov.in'],
    version: 1,
    effectiveFrom: '2007-04-01',
    deprecatedFrom: null,
  },

  {
    id: 'swasthya-sathi-wb@v1',
    slug: 'swasthya-sathi',
    level: 'state',
    stateCode: 'WB',
    nameI18n: {
      en: 'Swasthya Sathi (West Bengal)',
      hi: 'स्वास्थ्य साथी (WB)',
      kn: 'ಸ್ವಸ್ಥ್ಯ ಸಾಥಿ (WB)',
    },
    summaryI18n: {
      en: '₹5 lakh family floater for West Bengal residents. West Bengal opted out of PM-JAY — this is the state-only alternative, NOT portable outside WB. Transport support included.',
      hi: 'WB निवासियों के लिए ₹5 लाख फैमिली फ्लोटर। WB PM-JAY से बाहर — यह केवल राज्य का विकल्प है, WB के बाहर पोर्टेबल नहीं।',
      kn: 'WB ನಿವಾಸಿಗಳಿಗೆ ₹5 ಲಕ್ಷ ಫ್ಯಾಮಿಲಿ ಫ್ಲೋಟರ್. WB PM-JAY ಹೊರತಾಗಿದೆ — ರಾಜ್ಯದ ಹೊರಗೆ ಪೋರ್ಟಬಲ್ ಅಲ್ಲ.',
    },
    eligibilityRules: { state_in: ['WB'] },
    coveragePaise: 50000000,
    lineIds: ['health'],
    applicationChannels: ['swasthyasathi.gov.in'],
    helplines: ['18003455384'],
    portals: ['swasthyasathi.gov.in'],
    version: 1,
    effectiveFrom: '2016-12-30',
    deprecatedFrom: null,
  },

  {
    id: 'bsky-od@v1',
    slug: 'bsky',
    level: 'state',
    stateCode: 'OD',
    nameI18n: {
      en: 'Biju Swasthya Kalyan Yojana (Odisha)',
      hi: 'बीजू स्वास्थ्य कल्याण योजना (OD)',
      kn: 'ಬಿಜು ಸ್ವಸ್ಥ್ಯ ಕಲ್ಯಾಣ ಯೋಜನೆ (OD)',
    },
    summaryI18n: {
      en: '₹5 lakh cover for Odisha residents; ₹10 lakh exclusively for women in the family. No income restriction. One of the highest state cover amounts in India.',
      hi: 'ओडिशा निवासियों को ₹5 लाख; परिवार की महिलाओं को ₹10 लाख। कोई आय प्रतिबंध नहीं।',
      kn: 'ಒಡಿಶಾ ನಿವಾಸಿಗಳಿಗೆ ₹5 ಲಕ್ಷ; ಮಹಿಳೆಯರಿಗೆ ₹10 ಲಕ್ಷ. ಆದಾಯ ಮಿತಿ ಇಲ್ಲ.',
    },
    eligibilityRules: { state_in: ['OD'] },
    coveragePaise: 50000000,
    lineIds: ['health'],
    applicationChannels: ['bsky.odisha.gov.in', 'district-hospital'],
    helplines: ['104'],
    portals: ['bsky.odisha.gov.in'],
    version: 1,
    effectiveFrom: '2018-08-15',
    deprecatedFrom: null,
  },

  {
    id: 'chiranjeevi-rj@v1',
    slug: 'chiranjeevi',
    level: 'state',
    stateCode: 'RJ',
    nameI18n: {
      en: 'Chiranjeevi Health Insurance Scheme (Rajasthan)',
      hi: 'चिरंजीवी स्वास्थ्य बीमा योजना (RJ)',
      kn: 'ಚಿರಂಜೀವಿ ಆರೋಗ್ಯ ವಿಮೆ (RJ)',
    },
    summaryI18n: {
      en: '₹5 lakh family floater for ALL Rajasthan residents — no income restriction. 1,573+ packages. Universal scheme.',
      hi: 'राजस्थान के सभी निवासियों को ₹5 लाख — कोई आय प्रतिबंध नहीं। 1,573+ पैकेज।',
      kn: 'ರಾಜಸ್ಥಾನದ ಎಲ್ಲಾ ನಿವಾಸಿಗಳಿಗೆ ₹5 ಲಕ್ಷ — ಆದಾಯ ಮಿತಿ ಇಲ್ಲ. 1,573+ ಪ್ಯಾಕೇಜ್‌ಗಳು.',
    },
    eligibilityRules: { state_in: ['RJ'] },
    coveragePaise: 50000000,
    lineIds: ['health'],
    applicationChannels: ['chiranjeevi.rajasthan.gov.in', 'district-hospital'],
    helplines: ['181'],
    portals: ['chiranjeevi.rajasthan.gov.in'],
    version: 1,
    effectiveFrom: '2021-05-01',
    deprecatedFrom: null,
  },

  {
    id: 'kasp-kl@v1',
    slug: 'kasp',
    level: 'state',
    stateCode: 'KL',
    nameI18n: {
      en: 'Karunya Arogya Suraksha Padhathi (Kerala)',
      hi: 'करुण्य आरोग्य सुरक्षा पद्धति (KL)',
      kn: 'ಕರುಣ್ಯ ಆರೋಗ್ಯ ಸುರಕ್ಷಾ (KL)',
    },
    summaryI18n: {
      en: 'Kerala scheme for BPL and low-income families focused on serious illness — cancer, kidney disease, heart conditions. Post-treatment support included.',
      hi: 'केरल की BPL/कम आय वाले परिवारों के लिए गंभीर बीमारी योजना — कैंसर, किडनी, हृदय।',
      kn: 'ಕೇರಳದ BPL/ಕಡಿಮೆ ಆದಾಯ ಕುಟುಂಬಗಳಿಗೆ ಗಂಭೀರ ರೋಗ ಯೋಜನೆ — ಕ್ಯಾನ್ಸರ್, ಕಿಡ್ನಿ, ಹೃದಯ.',
    },
    eligibilityRules: {
      all_of: [
        { state_in: ['KL'] },
        { any_of: [{ bpl: true }, { income_lte_lakh: 3 }] },
      ],
    },
    coveragePaise: null,
    lineIds: ['health'],
    applicationChannels: ['sha.kerala.gov.in'],
    helplines: ['0471-2303123'],
    portals: ['sha.kerala.gov.in'],
    version: 1,
    effectiveFrom: '2018-09-23',
    deprecatedFrom: null,
  },

  {
    id: 'arogya-ka@v1',
    slug: 'arogya-karnataka',
    level: 'state',
    stateCode: 'KA',
    nameI18n: {
      en: 'Ayushman Bharat — Arogya Karnataka (Karnataka)',
      hi: 'आयुष्मान भारत — आरोग्य कर्नाटक',
      kn: 'ಆಯುಷ್ಮಾನ್ ಭಾರತ — ಆರೋಗ್ಯ ಕರ್ನಾಟಕ',
    },
    summaryI18n: {
      en: '₹5 lakh cover for Karnataka — merged with PM-JAY in most districts. SECC + state expansion. Also: Yeshasvini (farmers), Jyothi Sanjeevini (state govt employees).',
      hi: 'कर्नाटक में ₹5 लाख कवर — अधिकांश जिलों में PM-JAY के साथ विलय। साथ ही Yeshasvini और Jyothi Sanjeevini।',
      kn: 'ಕರ್ನಾಟಕದಲ್ಲಿ ₹5 ಲಕ್ಷ — ಹೆಚ್ಚಿನ ಜಿಲ್ಲೆಗಳಲ್ಲಿ PM-JAY ಜೊತೆ ವಿಲೀನ. ಯಶಸ್ವಿನಿ, ಜ್ಯೋತಿ ಸಂಜೀವಿನಿ ಸಹ.',
    },
    eligibilityRules: {
      all_of: [
        { state_in: ['KA'] },
        { any_of: [{ secc_deprived: true }, { income_lte_lakh: 5 }] },
      ],
    },
    coveragePaise: 50000000,
    lineIds: ['health'],
    applicationChannels: ['sastkarnataka.karnataka.gov.in', 'district-hospital'],
    helplines: ['104'],
    portals: ['sastkarnataka.karnataka.gov.in'],
    version: 1,
    effectiveFrom: '2018-03-02',
    deprecatedFrom: null,
  },

  {
    id: 'may-gj@v1',
    slug: 'mukhyamantri-amrutum',
    level: 'state',
    stateCode: 'GJ',
    nameI18n: {
      en: 'Mukhyamantri Amrutum Yojana (Gujarat)',
      hi: 'मुख्यमंत्री अमृतम योजना (GJ)',
      kn: 'ಮುಖ್ಯಮಂತ್ರಿ ಅಮೃತಂ ಯೋಜನೆ (GJ)',
    },
    summaryI18n: {
      en: '₹5 lakh cover for Gujarat BPL families. Stacked with PM-JAY in Gujarat — beneficiaries receive both. Covers major surgeries and critical illnesses.',
      hi: 'गुजरात के BPL परिवारों को ₹5 लाख। PM-JAY के साथ स्टैक — लाभार्थियों को दोनों मिलते हैं।',
      kn: 'ಗುಜರಾತ್ BPL ಕುಟುಂಬಗಳಿಗೆ ₹5 ಲಕ್ಷ. PM-JAY ಜೊತೆಗೆ ಸ್ಟ್ಯಾಕ್.',
    },
    eligibilityRules: {
      all_of: [
        { state_in: ['GJ'] },
        { bpl: true },
      ],
    },
    coveragePaise: 50000000,
    lineIds: ['health'],
    applicationChannels: ['magujarat.com'],
    helplines: ['18002331022'],
    portals: ['magujarat.com'],
    version: 1,
    effectiveFrom: '2012-09-04',
    deprecatedFrom: null,
  },

  {
    id: 'ssby-pb@v1',
    slug: 'sarbat-sehat',
    level: 'state',
    stateCode: 'PB',
    nameI18n: {
      en: 'Sarbat Sehat Bima Yojana (Punjab)',
      hi: 'सरबत सेहत बीमा योजना (PB)',
      kn: 'ಸರ್ಬತ್ ಸೆಹತ್ ಬೀಮಾ ಯೋಜನೆ (PB)',
    },
    summaryI18n: {
      en: '₹5 lakh cover for Punjab — PM-JAY aligned + state expansion. Additional beneficiary categories.',
      hi: 'पंजाब के लिए ₹5 लाख — PM-JAY संरेखित + राज्य विस्तार।',
      kn: 'ಪಂಜಾಬ್‌ಗೆ ₹5 ಲಕ್ಷ — PM-JAY ಜೊತೆಗೂಡಿ ವಿಸ್ತರಣೆ.',
    },
    eligibilityRules: {
      all_of: [
        { state_in: ['PB'] },
        { any_of: [{ secc_deprived: true }, { farmer: true }, { construction_worker: true }] },
      ],
    },
    coveragePaise: 50000000,
    lineIds: ['health'],
    applicationChannels: ['shapunjab.in'],
    helplines: ['104'],
    portals: ['shapunjab.in'],
    version: 1,
    effectiveFrom: '2019-08-20',
    deprecatedFrom: null,
  },

  {
    id: 'himcare-hp@v1',
    slug: 'himcare',
    level: 'state',
    stateCode: 'HP',
    nameI18n: {
      en: 'HIMCARE (Himachal Pradesh)',
      hi: 'HIMCARE (HP)',
      kn: 'HIMCARE (HP)',
    },
    summaryI18n: {
      en: '₹5 lakh cover top-up for Himachal Pradesh residents NOT covered by PM-JAY. Enrolment-based. Designed to fill the gap above SECC eligibility.',
      hi: 'HP के उन निवासियों के लिए ₹5 लाख टॉप-अप जो PM-JAY में नहीं हैं। नामांकन-आधारित।',
      kn: 'PM-JAY ನಲ್ಲಿಲ್ಲದ HP ನಿವಾಸಿಗಳಿಗೆ ₹5 ಲಕ್ಷ ಟಾಪ್-ಅಪ್. ನೋಂದಣಿ-ಆಧಾರಿತ.',
    },
    eligibilityRules: {
      all_of: [
        { state_in: ['HP'] },
        { not: { secc_deprived: true } }, // Exclusion-style rule — user must NOT be PM-JAY eligible
      ],
    },
    coveragePaise: 50000000,
    lineIds: ['health'],
    applicationChannels: ['hpsbys.in'],
    helplines: [],
    portals: ['hpsbys.in'],
    version: 1,
    effectiveFrom: '2019-01-01',
    deprecatedFrom: null,
  },

  {
    id: 'ddssy-ga@v1',
    slug: 'deen-dayal-ga',
    level: 'state',
    stateCode: 'GA',
    nameI18n: {
      en: 'Deen Dayal Swasthya Seva Yojana (Goa)',
      hi: 'दीन दयाल स्वास्थ्य सेवा योजना (Goa)',
      kn: 'ದೀನ್ ದಯಾಲ್ ಸ್ವಸ್ಥ್ಯ ಸೇವಾ ಯೋಜನೆ (Goa)',
    },
    summaryI18n: {
      en: '₹2.5–4 lakh cover for all Goa residents. No income limit. Government employees get a higher slab.',
      hi: 'गोवा के सभी निवासियों को ₹2.5–4 लाख। कोई आय सीमा नहीं।',
      kn: 'ಗೋವಾ ಎಲ್ಲಾ ನಿವಾಸಿಗಳಿಗೆ ₹2.5–4 ಲಕ್ಷ. ಆದಾಯ ಮಿತಿ ಇಲ್ಲ.',
    },
    eligibilityRules: { state_in: ['GA'] },
    coveragePaise: 40000000,
    lineIds: ['health'],
    applicationChannels: ['ddssy.goa.gov.in'],
    helplines: [],
    portals: ['ddssy.goa.gov.in'],
    version: 1,
    effectiveFrom: '2016-10-02',
    deprecatedFrom: null,
  },

  {
    id: 'pm-jay-dl@v1',
    slug: 'pm-jay-delhi',
    level: 'state',
    stateCode: 'DL',
    nameI18n: {
      en: 'Delhi PM-JAY (joined April 2025)',
      hi: 'दिल्ली PM-JAY (अप्रैल 2025)',
      kn: 'ದೆಹಲಿ PM-JAY (ಏಪ್ರಿಲ್ 2025)',
    },
    summaryI18n: {
      en: 'Delhi signed MoU with NHA in April 2025, bringing PM-JAY to Delhi. SECC-eligible Delhi residents now get the national ₹5 lakh cover.',
      hi: 'दिल्ली ने अप्रैल 2025 में NHA के साथ MoU किया — PM-JAY दिल्ली में लागू।',
      kn: 'ಏಪ್ರಿಲ್ 2025 ರಲ್ಲಿ ದೆಹಲಿಯು NHA ಜೊತೆ MoU ಮಾಡಿತು — PM-JAY ದೆಹಲಿಯಲ್ಲಿ ಲಭ್ಯ.',
    },
    eligibilityRules: {
      all_of: [
        { state_in: ['DL'] },
        { secc_deprived: true },
      ],
    },
    coveragePaise: 50000000,
    lineIds: ['health'],
    applicationChannels: ['beneficiary.nha.gov.in', 'csc'],
    helplines: ['14555'],
    portals: ['beneficiary.nha.gov.in'],
    version: 1,
    effectiveFrom: '2025-04-01',
    deprecatedFrom: null,
  },

  {
    id: 'mhis-ml@v1',
    slug: 'mhis-phase5',
    level: 'state',
    stateCode: 'ML',
    nameI18n: {
      en: 'MHIS Phase V (Meghalaya — stacked with PM-JAY)',
      hi: 'MHIS चरण V (मेघालय)',
      kn: 'MHIS Phase V (ಮೇಘಾಲಯ)',
    },
    summaryI18n: {
      en: '₹5 lakh + ₹30,000 additional top-up for Meghalaya residents (all except state/central govt employees). Stacks on top of PM-JAY.',
      hi: 'मेघालय निवासियों को ₹5 लाख + ₹30,000 टॉप-अप।',
      kn: 'ಮೇಘಾಲಯ ನಿವಾಸಿಗಳಿಗೆ ₹5 ಲಕ್ಷ + ₹30,000 ಟಾಪ್-ಅಪ್.',
    },
    eligibilityRules: {
      all_of: [
        { state_in: ['ML'] },
        { not: { govt_employee: true } },
      ],
    },
    coveragePaise: 50000000,
    lineIds: ['health'],
    applicationChannels: ['mhis.meghalaya.gov.in'],
    helplines: [],
    portals: ['mhis.meghalaya.gov.in'],
    version: 1,
    effectiveFrom: '2024-04-01',
    deprecatedFrom: null,
  },
];
