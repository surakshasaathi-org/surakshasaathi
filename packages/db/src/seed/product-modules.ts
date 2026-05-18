import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';
import type * as schema from '../schema';

type Db = NodePgDatabase<typeof schema>;

/**
 * The 8 product modules. All visible Day 1; backend readiness varies (status field).
 * See docs/PRODUCT_STRATEGY.md for the source-of-truth definitions.
 *
 * Adding a 9th module = append to this array (or, post-launch, insert via admin portal).
 */
export async function seedProductModules(db: Db, s: typeof schema) {
  const rows = [
    {
      id: 'claims-advocacy',
      cluster: 'claims' as const,
      nameI18n: { en: 'Claims Advocacy', hi: 'दावा सहायता', kn: 'ಕ್ಲೈಮ್ ಸಹಾಯ' },
      taglineI18n: {
        en: 'Your claim was rejected. We fight back.',
        hi: 'आपका दावा खारिज कर दिया गया। हम आपकी लड़ाई लड़ेंगे।',
        kn: 'ನಿಮ್ಮ ಕ್ಲೈಮ್ ತಿರಸ್ಕರಿಸಲಾಗಿದೆಯೆ? ನಾವು ಹೋರಾಡುತ್ತೇವೆ.',
      },
      heroHeadlineI18n: {
        en: 'India\'s claim rejection crisis. One partner who takes it on for you.',
        hi: 'भारत में दावा अस्वीकृति संकट। एक साथी जो आपके लिए लड़ता है।',
        kn: 'ಭಾರತದ ಕ್ಲೈಮ್ ತಿರಸ್ಕಾರ ಬಿಕ್ಕಟ್ಟು. ನಿಮಗಾಗಿ ಹೋರಾಡುವ ಒಬ್ಬ ಪಾಲುದಾರ.',
      },
      heroSubheadI18n: {
        en: 'Upload your rejection letter. In 24 hours you\'ll get a classification, an escalation letter, and the fastest path to a win.',
        hi: 'अपना अस्वीकृति पत्र अपलोड करें। 24 घंटे में वर्गीकरण, एस्केलेशन पत्र और जीत का सबसे तेज़ रास्ता प्राप्त करें।',
        kn: 'ನಿಮ್ಮ ತಿರಸ್ಕಾರ ಪತ್ರವನ್ನು ಅಪ್ಲೋಡ್ ಮಾಡಿ. 24 ಗಂಟೆಯೊಳಗೆ ವರ್ಗೀಕರಣ, ಏರಿಕೆ ಪತ್ರ ಮತ್ತು ಗೆಲುವಿನ ವೇಗದ ದಾರಿ.',
      },
      landingRoute: '/claims-advocacy',
      pricingModel: 'success_fee' as const,
      authRequired: 'registered' as const,
      launchLocales: ['en', 'hi', 'kn'],
      status: 'beta' as const,
      intakeFlowId: 'claims-advocacy-v1',
      // No live agents yet — full rejection-letter pipeline (intake → document
      // → rejection-classifier → escalation-drafter → deadline-watcher) is
      // human-in-loop until backend lands. Add to this list as each agent is
      // wired into a runtime call site.
      agentDefinitionIds: [],
      orderIndex: 10,
      iconSlug: 'shield-check',
    },
    {
      id: 'policy-health-score',
      cluster: 'advisory' as const,
      nameI18n: { en: 'Policy Health Score', hi: 'पॉलिसी हेल्थ स्कोर', kn: 'ಪಾಲಿಸಿ ಹೆಲ್ತ್ ಸ್ಕೋರ್' },
      taglineI18n: {
        en: 'Every aggregator optimized for the sale. We own the 3 years after.',
        hi: 'हर एग्रीगेटर बिक्री पर केंद्रित है। हम अगले 3 साल आपके साथ हैं।',
        kn: 'ಮಾರಾಟದ ನಂತರ ನಿಮ್ಮ ಜೊತೆ ಇರುವ ಏಕೈಕ ಪಾಲಕ.',
      },
      heroHeadlineI18n: {
        en: 'A CIBIL score for your family\'s insurance adequacy.',
        hi: 'आपके परिवार की बीमा पर्याप्तता के लिए एक CIBIL स्कोर।',
        kn: 'ನಿಮ್ಮ ಕುಟುಂಬದ ವಿಮಾ ಪರಿಪೂರ್ಣತೆಗೆ CIBIL ಸ್ಕೋರ್.',
      },
      heroSubheadI18n: {
        en: 'Link your policies. Get a 0–100 score across coverage, overlap, nominees, renewals, and gaps. Updated every time your life changes.',
        hi: 'अपनी पॉलिसियों को लिंक करें। कवरेज, ओवरलैप, नॉमिनी, रिन्यूअल और कमियों पर 0–100 स्कोर प्राप्त करें।',
        kn: 'ನಿಮ್ಮ ಪಾಲಿಸಿಗಳನ್ನು ಲಿಂಕ್ ಮಾಡಿ. ಕವರೇಜ್, ಪುನರಾವರ್ತನೆ, ನಾಮಿನಿ, ನವೀಕರಣ ಹಾಗೂ ಕಂದಕಗಳ 0–100 ಸ್ಕೋರ್.',
      },
      landingRoute: '/policy-health-score',
      pricingModel: 'freemium' as const,
      authRequired: 'registered' as const,
      launchLocales: ['en', 'hi', 'kn'],
      status: 'skeleton' as const,
      intakeFlowId: null,
      agentDefinitionIds: [
        // Analyse-My-Policy chain (Before chapter — see docs/prd/01a-analyse-my-policy.md)
        // Stage-0 vision pass: PDF/image → faithful markdown. Every downstream
        // agent in this chain consumes the digitizer's output as text.
        'policy-digitizer',
        'policy-intake-classifier',
        'policy-extractor',
        'policy-coverage',
        // Deterministic 0–100 readiness score (rules-tier agent — see /scoring/rules)
        'policy-scorer',
        // Follow-up chat on the report
        'customer-explainer',
        // NOTE: coverage-predictor is intentionally omitted — its server pipeline
        // exists at apps/web-customer/src/server/analyse/coverage-pipeline.ts but
        // no UI page invokes it yet. Add back when the "Will my claim be covered?"
        // entry point ships.
      ],
      orderIndex: 20,
      iconSlug: 'activity',
    },
    {
      id: 'govt-scheme-navigator',
      cluster: 'advisory' as const,
      nameI18n: { en: 'Govt Scheme Navigator', hi: 'सरकारी योजना गाइड', kn: 'ಸರ್ಕಾರಿ ಯೋಜನೆ ಮಾರ್ಗದರ್ಶಿ' },
      taglineI18n: {
        en: 'The government built the safety net. We built the door.',
        hi: 'सरकार ने सुरक्षा जाल बनाया। हमने उसका दरवाज़ा।',
        kn: 'ಸರ್ಕಾರ ಸುರಕ್ಷಿತ ಜಾಲ ಕಟ್ಟಿದೆ. ಬಾಗಿಲನ್ನು ನಾವು ಮಾಡಿದ್ದೇವೆ.',
      },
      heroHeadlineI18n: {
        en: '70% of eligible families never enrolled. Check in 2 minutes.',
        hi: '70% पात्र परिवारों ने कभी नामांकन नहीं कराया। 2 मिनट में जाँचें।',
        kn: '70% ಅರ್ಹ ಕುಟುಂಬಗಳು ನೋಂದಾಯಿಸಿಲ್ಲ. 2 ನಿಮಿಷದಲ್ಲಿ ಪರಿಶೀಲಿಸಿ.',
      },
      heroSubheadI18n: {
        en: 'PM-JAY, PMSBY, PMJJBY, and 20+ state schemes. Find what you qualify for. Free, anonymous, no Aadhaar required to check.',
        hi: 'PM-JAY, PMSBY, PMJJBY और 20+ राज्य योजनाएं। पता करें आप किसके पात्र हैं। मुफ्त, गुमनाम, जाँच के लिए आधार ज़रूरी नहीं।',
        kn: 'PM-JAY, PMSBY, PMJJBY ಮತ್ತು 20+ ರಾಜ್ಯ ಯೋಜನೆಗಳು. ಉಚಿತ, ಅನಾಮಧೇಯ, ಪರಿಶೀಲನೆಗೆ ಆಧಾರ್ ಅಗತ್ಯವಿಲ್ಲ.',
      },
      landingRoute: '/govt-scheme-navigator',
      pricingModel: 'free' as const,
      authRequired: 'anonymous' as const,
      launchLocales: ['en', 'hi', 'kn'],
      status: 'beta' as const,
      intakeFlowId: 'scheme-eligibility-v1',
      // scheme-explainer is defined but not yet wired into a runtime call site
      // — add back when the explainer step lands in /server/schemes.
      agentDefinitionIds: ['scheme-matcher'],
      orderIndex: 30,
      iconSlug: 'map-pin',
    },
    {
      id: 'family-insurance-os',
      cluster: 'advisory' as const,
      nameI18n: { en: 'Family Insurance OS', hi: 'परिवार बीमा OS', kn: 'ಕುಟುಂಬ ವಿಮಾ OS' },
      taglineI18n: {
        en: 'Your policies are scattered across 6 places. One source of truth.',
        hi: 'आपकी पॉलिसियाँ 6 जगहों पर बिखरी हैं। एक ही जगह पर सच्चाई।',
        kn: 'ನಿಮ್ಮ ಪಾಲಿಸಿಗಳು 6 ಕಡೆ ಹರಡಿವೆ. ಒಂದೇ ಸತ್ಯದ ಮೂಲ.',
      },
      heroHeadlineI18n: {
        en: 'Every policy, every renewal, every nominee — one dashboard.',
        hi: 'हर पॉलिसी, हर रिन्यूअल, हर नॉमिनी — एक डैशबोर्ड।',
        kn: 'ಪ್ರತಿ ಪಾಲಿಸಿ, ನವೀಕರಣ, ನಾಮಿನಿ — ಒಂದೇ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್.',
      },
      heroSubheadI18n: {
        en: 'Upload your family\'s policies. We build the living map of what\'s covered, what\'s missing, and what renews next.',
        hi: 'अपने परिवार की पॉलिसियाँ अपलोड करें। हम कवरेज का एक जीवंत नक्शा बनाते हैं।',
        kn: 'ನಿಮ್ಮ ಕುಟುಂಬದ ಪಾಲಿಸಿಗಳನ್ನು ಅಪ್ಲೋಡ್ ಮಾಡಿ. ನಾವು ಜೀವಂತ ನಕ್ಷೆ ತಯಾರಿಸುತ್ತೇವೆ.',
      },
      landingRoute: '/family-insurance-os',
      pricingModel: 'subscription' as const,
      authRequired: 'registered' as const,
      launchLocales: ['en', 'hi', 'kn'],
      status: 'skeleton' as const,
      intakeFlowId: null,
      agentDefinitionIds: ['document-agent', 'policy-health-scorer', 'gap-finder'],
      orderIndex: 40,
      iconSlug: 'users',
    },
    {
      id: 'vernacular-portal',
      cluster: 'new_segment' as const,
      nameI18n: { en: 'Tier 2/3 Vernacular Portal', hi: 'स्थानीय भाषा पोर्टल', kn: 'ಪ್ರಾದೇಶಿಕ ಭಾಷಾ ಪೋರ್ಟಲ್' },
      taglineI18n: {
        en: 'Bima Sugam solved the backend. We build the human-first frontend.',
        hi: 'बीमा सुगम ने बैकएंड हल किया। हम मानव-प्रथम फ्रंटएंड बनाते हैं।',
        kn: 'ಬೀಮಾ ಸುಗಮ್ ಬ್ಯಾಕೆಂಡ್ ಬಗೆಹರಿಸಿದೆ. ನಾವು ಮನುಷ್ಯ-ಪ್ರಥಮ ಫ್ರಂಟೆಂಡ್ ನಿರ್ಮಿಸುತ್ತೇವೆ.',
      },
      heroHeadlineI18n: {
        en: 'Insurance in your language. Explained, not sold.',
        hi: 'आपकी भाषा में बीमा। समझाया गया, बेचा नहीं गया।',
        kn: 'ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ವಿಮೆ. ಮಾರಾಟವಲ್ಲ, ವಿವರಣೆ.',
      },
      heroSubheadI18n: {
        en: 'WhatsApp-first education, video advisor callbacks, and honest pricing. Never a hidden sales pitch.',
        hi: 'WhatsApp पर शिक्षा, वीडियो सलाहकार कॉलबैक, ईमानदार कीमत।',
        kn: 'WhatsApp ಶಿಕ್ಷಣ, ವೀಡಿಯೋ ಸಲಹೆಗಾರ ಕಾಲ್-ಬ್ಯಾಕ್, ನಿಖರ ಬೆಲೆ.',
      },
      landingRoute: '/vernacular-portal',
      pricingModel: 'affiliate' as const,
      authRequired: 'anonymous' as const,
      launchLocales: ['en', 'hi', 'kn'],
      status: 'skeleton' as const,
      intakeFlowId: null,
      agentDefinitionIds: ['intake-agent', 'translation-agent', 'scheme-explainer'],
      orderIndex: 50,
      iconSlug: 'languages',
    },
    {
      id: 'msme-navigator',
      cluster: 'new_segment' as const,
      nameI18n: { en: 'MSME Insurance Navigator', hi: 'MSME बीमा गाइड', kn: 'MSME ವಿಮಾ ಮಾರ್ಗದರ್ಶಿ' },
      taglineI18n: {
        en: '62 million businesses. 97% uninsured. Zero quality advisors.',
        hi: '6.2 करोड़ व्यवसाय। 97% अबीमित। कोई गुणवत्तापूर्ण सलाहकार नहीं।',
        kn: '6.2 ಕೋಟಿ ವ್ಯವಹಾರಗಳು. 97% ವಿಮಾ ಇಲ್ಲ. ಗುಣಮಟ್ಟದ ಸಲಹೆಗಾರ ಶೂನ್ಯ.',
      },
      heroHeadlineI18n: {
        en: 'Your business risk, audited in 20 minutes by an expert.',
        hi: '20 मिनट में विशेषज्ञ द्वारा व्यवसाय जोखिम ऑडिट।',
        kn: '20 ನಿಮಿಷದಲ್ಲಿ ವ್ಯಾಪಾರ ಅಪಾಯದ ಪರಿಣತ ಆಡಿಟ್.',
      },
      heroSubheadI18n: {
        en: 'Sector-specific risk templates for textile, pharma, food, retail, IT. Prioritized recommendations. Annual review retainer.',
        hi: 'कपड़ा, दवा, खाद्य, खुदरा, IT के लिए क्षेत्र-विशिष्ट जोखिम टेम्पलेट।',
        kn: 'ಜವಳಿ, ಫಾರ್ಮಾ, ಆಹಾರ, ಚಿಲ್ಲರೆ, IT ವಲಯಕ್ಕೆ ಅಪಾಯ ಟೆಂಪ್ಲೇಟ್‌ಗಳು.',
      },
      landingRoute: '/msme-navigator',
      pricingModel: 'freemium' as const,
      authRequired: 'registered' as const,
      launchLocales: ['en', 'hi', 'kn'],
      status: 'skeleton' as const,
      intakeFlowId: null,
      agentDefinitionIds: ['msme-risk-auditor', 'document-agent'],
      orderIndex: 60,
      iconSlug: 'briefcase',
    },
    {
      id: 'senior-citizen-portal',
      cluster: 'new_segment' as const,
      nameI18n: { en: 'Senior Citizen Protection', hi: 'वरिष्ठ नागरिक सुरक्षा', kn: 'ಹಿರಿಯ ನಾಗರಿಕ ಸುರಕ್ಷೆ' },
      taglineI18n: {
        en: 'India\'s elderly are systematically mis-sold. Their children are the buyers.',
        hi: 'बुज़ुर्गों को व्यवस्थित तरीके से ग़लत पॉलिसी बेची जा रही है।',
        kn: 'ಹಿರಿಯರಿಗೆ ತಪ್ಪು ಪಾಲಿಸಿ ವ್ಯವಸ್ಥಿತವಾಗಿ ಮಾರಾಟ.',
      },
      heroHeadlineI18n: {
        en: 'Protect your parents. Scan their policies for mis-selling. Enrol them in PM-JAY.',
        hi: 'अपने माता-पिता की रक्षा करें। उनकी पॉलिसियों को स्कैन करें। PM-JAY में नामांकित करें।',
        kn: 'ನಿಮ್ಮ ಪೋಷಕರನ್ನು ರಕ್ಷಿಸಿ. ಪಾಲಿಸಿಗಳನ್ನು ಸ್ಕ್ಯಾನ್ ಮಾಡಿ. PM-JAY ನೋಂದಣಿ.',
      },
      heroSubheadI18n: {
        en: 'ULIP mis-selling detection, PM-JAY enrolment, family caretaker dashboard. One subscription covers both parents.',
        hi: 'ULIP मिस-सेलिंग डिटेक्शन, PM-JAY नामांकन, फैमिली केयरटेकर डैशबोर्ड।',
        kn: 'ULIP ತಪ್ಪು-ಮಾರಾಟ ಪತ್ತೆಹಚ್ಚುವಿಕೆ, PM-JAY ನೋಂದಣಿ, ಕಾಳಜಿ ವಹಿಸುವ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್.',
      },
      landingRoute: '/senior-citizen-portal',
      pricingModel: 'subscription' as const,
      authRequired: 'registered' as const,
      launchLocales: ['en', 'hi', 'kn'],
      status: 'skeleton' as const,
      intakeFlowId: null,
      agentDefinitionIds: ['mis-selling-detector', 'scheme-matcher', 'document-agent'],
      orderIndex: 70,
      iconSlug: 'heart',
    },
    {
      id: 'life-mis-selling-recovery',
      cluster: 'claims' as const,
      nameI18n: { en: 'Life Mis-selling Recovery', hi: 'जीवन बीमा मिस-सेलिंग रिकवरी', kn: 'ಜೀವ ವಿಮೆ ತಪ್ಪು-ಮಾರಾಟ ಮರುಪಡೆಯಿಕೆ' },
      taglineI18n: {
        en: '₹40,000 crore locked in wrong policies. IRDAI named it "alarming".',
        hi: '₹40,000 करोड़ गलत पॉलिसियों में फंसे हैं। IRDAI ने इसे "खतरनाक" कहा।',
        kn: '₹40,000 ಕೋಟಿ ತಪ್ಪು ಪಾಲಿಸಿಗಳಲ್ಲಿ ಸಿಲುಕಿವೆ. IRDAI ಇದನ್ನು "ಅಪಾಯಕಾರಿ" ಎಂದಿದೆ.',
      },
      heroHeadlineI18n: {
        en: 'Sold a ULIP as a "guaranteed FD"? There\'s a way out.',
        hi: 'क्या आपको "गारंटीड FD" कहकर ULIP बेचा गया? निकलने का रास्ता है।',
        kn: '"ಗ್ಯಾರಂಟೀಡ್ FD" ಹೆಸರಿನಲ್ಲಿ ULIP ಮಾರಾಟ ಮಾಡಿದರೆ? ಮಾರ್ಗವಿದೆ.',
      },
      heroSubheadI18n: {
        en: 'Upload your policy and bank statement. We detect mis-selling signals, draft your complaint, and fight for refund.',
        hi: 'अपनी पॉलिसी और बैंक स्टेटमेंट अपलोड करें। हम मिस-सेलिंग संकेतों का पता लगाते हैं और शिकायत दर्ज कराते हैं।',
        kn: 'ನಿಮ್ಮ ಪಾಲಿಸಿ ಮತ್ತು ಬ್ಯಾಂಕ್ ಹೇಳಿಕೆ ಅಪ್ಲೋಡ್ ಮಾಡಿ. ತಪ್ಪು-ಮಾರಾಟ ಸೂಚಕಗಳನ್ನು ಪತ್ತೆಹಚ್ಚಿ ದೂರು ಸಲ್ಲಿಸುತ್ತೇವೆ.',
      },
      landingRoute: '/life-mis-selling-recovery',
      pricingModel: 'success_fee' as const,
      authRequired: 'registered' as const,
      launchLocales: ['en', 'hi', 'kn'],
      status: 'skeleton' as const,
      intakeFlowId: null,
      agentDefinitionIds: ['document-agent', 'mis-selling-detector', 'escalation-drafter', 'deadline-watcher'],
      orderIndex: 80,
      iconSlug: 'file-warning',
    },
  ];
  await db.insert(s.productModule).values(rows).onConflictDoNothing();

  // Upsert the agent roster on every re-seed. The unique key blocks
  // onConflictDoNothing from updating, but agent membership is config we want
  // to keep in lock-step with this file (admin Product hub reads from here).
  for (const row of rows) {
    await db
      .update(s.productModule)
      .set({ agentDefinitionIds: row.agentDefinitionIds })
      .where(eq(s.productModule.id, row.id));
  }

  console.log(`[seed] product modules: ${rows.length}`);
}
