import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../schema';

type Db = NodePgDatabase<typeof schema>;

/**
 * Seed of Phase-1 government schemes. Full coverage is an ongoing content-team effort.
 * These are the three central schemes that every Idea-3 Eligibility-Check response touches.
 */
export async function seedSchemes(db: Db, s: typeof schema) {
  const rows = [
    {
      id: 'pm-jay@v1',
      slug: 'pm-jay',
      level: 'central' as const,
      stateCode: null,
      nameI18n: {
        en: 'Ayushman Bharat PM-JAY',
        hi: 'आयुष्मान भारत PM-JAY',
        kn: 'ಆಯುಷ್ಮಾನ್ ಭಾರತ PM-JAY',
      },
      summaryI18n: {
        en: 'Cashless secondary and tertiary hospitalization up to ₹5 lakh per family per year. Auto-entitled for all Indians aged 70+ since October 2024.',
        hi: '₹5 लाख प्रति परिवार प्रति वर्ष तक कैशलेस अस्पताल भर्ती। अक्टूबर 2024 से सभी 70+ भारतीयों के लिए स्वचालित पात्रता।',
        kn: 'ಪ್ರತಿ ಕುಟುಂಬಕ್ಕೆ ವರ್ಷಕ್ಕೆ ₹5 ಲಕ್ಷದವರೆಗೆ ನಗದು-ರಹಿತ ಆಸ್ಪತ್ರೆ ದಾಖಲಾತಿ. 70+ ಭಾರತೀಯರಿಗೆ ಸ್ವಯಂ-ಅರ್ಹ.',
      },
      eligibilityRules: {
        any_of: [
          { senior: { age_gte: 70 } },
          { secc_deprived: true },
          { state_scheme_beneficiary: true },
        ],
      },
      coveragePaise: 50000000,
      lineIds: ['health'],
      applicationChannels: ['csc', 'bank_branch', 'mera.pmjay.gov.in'],
      version: 1,
      effectiveFrom: '2024-10-01',
      deprecatedFrom: null,
    },
    {
      id: 'pmsby@v1',
      slug: 'pmsby',
      level: 'central' as const,
      stateCode: null,
      nameI18n: {
        en: 'Pradhan Mantri Suraksha Bima Yojana',
        hi: 'प्रधानमंत्री सुरक्षा बीमा योजना',
        kn: 'ಪ್ರಧಾನ ಮಂತ್ರಿ ಸುರಕ್ಷಾ ಬೀಮಾ ಯೋಜನೆ',
      },
      summaryI18n: {
        en: '₹2 lakh accidental-death and disability cover. Annual premium ₹20. Any Indian aged 18–70 with a bank account.',
        hi: '₹2 लाख आकस्मिक मृत्यु और विकलांगता कवर। वार्षिक प्रीमियम ₹20। 18–70 वर्ष के बैंक खाताधारी भारतीय।',
        kn: '₹2 ಲಕ್ಷ ಅಪಘಾತ ಸಾವು ಮತ್ತು ಅಂಗವೈಕಲ್ಯ ಕವರ್. ವಾರ್ಷಿಕ ಪ್ರೀಮಿಯಂ ₹20. 18–70 ವಯಸ್ಸಿನ ಬ್ಯಾಂಕ್ ಖಾತೆದಾರರಿಗೆ.',
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
      applicationChannels: ['bank_branch', 'net_banking'],
      version: 1,
      effectiveFrom: '2015-05-01',
      deprecatedFrom: null,
    },
    {
      id: 'pmjjby@v1',
      slug: 'pmjjby',
      level: 'central' as const,
      stateCode: null,
      nameI18n: {
        en: 'Pradhan Mantri Jeevan Jyoti Bima Yojana',
        hi: 'प्रधानमंत्री जीवन ज्योति बीमा योजना',
        kn: 'ಪ್ರಧಾನ ಮಂತ್ರಿ ಜೀವನ್ ಜ್ಯೋತಿ ಬೀಮಾ ಯೋಜನೆ',
      },
      summaryI18n: {
        en: '₹2 lakh term life cover. Annual premium ₹436. Any Indian aged 18–50 (renewable to 55) with a bank account.',
        hi: '₹2 लाख टर्म लाइफ कवर। वार्षिक प्रीमियम ₹436। 18–50 वर्ष (55 तक नवीकरणीय) के बैंक खाताधारी भारतीय।',
        kn: '₹2 ಲಕ್ಷ ಟರ್ಮ್ ಲೈಫ್ ಕವರ್. ವಾರ್ಷಿಕ ಪ್ರೀಮಿಯಂ ₹436. 18–50 (55ವರೆಗೆ ನವೀಕರಣ) ವಯಸ್ಸಿನವರಿಗೆ.',
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
      applicationChannels: ['bank_branch', 'net_banking'],
      version: 1,
      effectiveFrom: '2015-05-01',
      deprecatedFrom: null,
    },
  ];
  await db.insert(s.scheme).values(rows).onConflictDoNothing();
  console.log(`[seed] schemes: ${rows.length}`);
}
