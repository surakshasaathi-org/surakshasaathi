/**
 * Landing-page moments, organised by Before / During / After chapter.
 *
 * A "moment" is a specific thing that happens to a user that leads them to us.
 * Moments are what the user thinks about; modules are how we deliver. Each
 * moment deep-links to a module's detail page.
 *
 * This structure replaces the 8-tool feature grid with a lifecycle-organised
 * platform narrative (per feedback_platform_positioning.md, 2026-04-18).
 *
 * Adding a new moment: append to the correct chapter. Moments are independent
 * of module `status` — a single module can provide multiple moments, some
 * live today and others coming soon.
 */
import type { Locale } from '@suraksha/types';

export type Chapter = 'before' | 'during' | 'after';

export type MomentStatus = 'live' | 'beta' | 'comingSoon';

export interface Moment {
  id: string;
  chapter: Chapter;
  /** Primary module this moment belongs to — used to route to its detail page. */
  moduleSlug: string;
  /** Icon slug, from @/lib/icon-map. */
  iconSlug: string;
  status: MomentStatus;
  /** Short title — "I want to …" style from the user's POV. */
  titleI18n: Record<Locale, string>;
  /** One-line body — the promise. */
  bodyI18n: Record<Locale, string>;
  /** Optional direct deep-link (overrides the module detail page). */
  href?: string;
}

export const MOMENTS: Moment[] = [
  /* ───────── BEFORE — prepare, understand, prevent ───────── */
  {
    id: 'analyse-my-policy',
    chapter: 'before',
    moduleSlug: 'policy-health-score',
    iconSlug: 'shield-check',
    status: 'beta',
    titleI18n: {
      en: 'Analyse my policy deeply',
      hi: 'मेरी पॉलिसी गहराई से जाँचें',
      kn: 'ನನ್ನ ಪಾಲಿಸಿಯನ್ನು ಆಳವಾಗಿ ವಿಶ್ಲೇಷಿಸಿ',
    } as Partial<Record<Locale, string>> as Record<Locale, string>,
    bodyI18n: {
      en: "Upload your health policy. Get a plain-language report of exclusions, waiting periods, sub-limits, and red flags you missed.",
      hi: 'स्वास्थ्य पॉलिसी अपलोड करें। अपवर्जन, प्रतीक्षा अवधि, सब-लिमिट और चूकी हुई बारीकियों की सरल रिपोर्ट पाएं।',
      kn: 'ಆರೋಗ್ಯ ಪಾಲಿಸಿ ಅಪ್ಲೋಡ್ ಮಾಡಿ. ಹೊರಗಿಡುವಿಕೆ, ಕಾಯುವ ಅವಧಿ, ಸಬ್-ಲಿಮಿಟ್ ಮತ್ತು ಸೂಕ್ಷ್ಮ ಅಂಶಗಳ ಸರಳ ವರದಿ.',
    } as Record<Locale, string>,
  },
  {
    id: 'will-my-claim-be-covered',
    chapter: 'before',
    moduleSlug: 'policy-health-score',
    iconSlug: 'activity',
    status: 'beta',
    titleI18n: {
      en: 'Check if my next claim will be covered',
      hi: 'मेरा अगला दावा कवर होगा या नहीं',
      kn: 'ನನ್ನ ಮುಂದಿನ ಕ್ಲೈಮ್ ಕವರ್ ಆಗುತ್ತದೆಯೇ',
    } as Record<Locale, string>,
    bodyI18n: {
      en: "Describe your situation — condition, hospital, amount, timing. AI predicts green / amber / red with exact clauses.",
      hi: 'स्थिति बताएं — बीमारी, अस्पताल, राशि, समय। AI हरा/पीला/लाल भविष्यवाणी सटीक क्लॉज़ के साथ।',
      kn: 'ಸನ್ನಿವೇಶ ತಿಳಿಸಿ — ರೋಗ, ಆಸ್ಪತ್ರೆ, ಮೊತ್ತ, ಸಮಯ. AI ನಿಖರ ಷರತ್ತುಗಳೊಂದಿಗೆ ಹಸಿರು/ಅಂಬರ್/ಕೆಂಪು ಊಹೆ.',
    } as Record<Locale, string>,
  },
  {
    id: 'schemes-my-family-qualifies-for',
    chapter: 'before',
    moduleSlug: 'govt-scheme-navigator',
    iconSlug: 'map-pin',
    status: 'beta',
    titleI18n: {
      en: 'Find schemes my family qualifies for',
      hi: 'मेरे परिवार के लिए पात्र योजनाएँ खोजें',
      kn: 'ನನ್ನ ಕುಟುಂಬಕ್ಕೆ ಅರ್ಹ ಯೋಜನೆಗಳು',
    } as Record<Locale, string>,
    bodyI18n: {
      en: "PM-JAY, PMSBY, PMJJBY, and 14 state schemes. 2-minute check. Free and anonymous. No Aadhaar to check.",
      hi: 'PM-JAY, PMSBY, PMJJBY और 14 राज्य योजनाएँ। 2 मिनट। मुफ्त और गुमनाम। आधार की ज़रूरत नहीं।',
      kn: 'PM-JAY, PMSBY, PMJJBY ಮತ್ತು 14 ರಾಜ್ಯ ಯೋಜನೆಗಳು. 2 ನಿಮಿಷ. ಆಧಾರ್ ಅಗತ್ಯವಿಲ್ಲ.',
    } as Record<Locale, string>,
  },
  {
    id: 'score-my-insurance-adequacy',
    chapter: 'before',
    moduleSlug: 'policy-health-score',
    iconSlug: 'activity',
    status: 'comingSoon',
    titleI18n: {
      en: "Score my family's insurance adequacy",
      hi: 'परिवार की बीमा पर्याप्तता का स्कोर',
      kn: 'ಕುಟುಂಬದ ವಿಮಾ ಪರಿಪೂರ್ಣತೆಯ ಸ್ಕೋರ್',
    } as Record<Locale, string>,
    bodyI18n: {
      en: "Link every policy. Get one 0–100 score across coverage, overlap, nominees, and gaps. Updated on life events.",
      hi: 'हर पॉलिसी लिंक करें। कवरेज, ओवरलैप, नॉमिनी पर 0–100 स्कोर।',
      kn: 'ಪ್ರತಿ ಪಾಲಿಸಿ ಲಿಂಕ್ ಮಾಡಿ. 0–100 ಸ್ಕೋರ್.',
    } as Record<Locale, string>,
  },
  {
    id: 'build-family-dashboard',
    chapter: 'before',
    moduleSlug: 'family-insurance-os',
    iconSlug: 'users',
    status: 'comingSoon',
    titleI18n: {
      en: 'Build my family insurance dashboard',
      hi: 'परिवार बीमा डैशबोर्ड बनाएँ',
      kn: 'ಕುಟುಂಬ ವಿಮಾ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್',
    } as Record<Locale, string>,
    bodyI18n: {
      en: "Every policy, every renewal, every nominee — one dashboard with emergency-access for any family member.",
      hi: 'हर पॉलिसी, रिन्यूअल, नॉमिनी — एक डैशबोर्ड। परिवार के किसी भी सदस्य के लिए आपातकालीन पहुँच।',
      kn: 'ಪ್ರತಿ ಪಾಲಿಸಿ, ನವೀಕರಣ, ನಾಮಿನಿ — ಒಂದೇ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್. ತುರ್ತು ಪ್ರವೇಶ.',
    } as Record<Locale, string>,
  },
  {
    id: 'scan-parents-policies',
    chapter: 'before',
    moduleSlug: 'senior-citizen-portal',
    iconSlug: 'heart',
    status: 'comingSoon',
    titleI18n: {
      en: "Scan my parents' policies for mis-selling",
      hi: 'माता-पिता की पॉलिसियों की मिस-सेलिंग जाँच',
      kn: 'ಪೋಷಕರ ಪಾಲಿಸಿಗಳ ತಪ್ಪು-ಮಾರಾಟ ಪರಿಶೀಲನೆ',
    } as Record<Locale, string>,
    bodyI18n: {
      en: "Detect ULIPs sold as FDs, pressure sales, and senior-unfriendly products. Enrol them in PM-JAY if they're 70+.",
      hi: 'FD कहकर बेचे गए ULIP, दबाव बिक्री, और अनुपयुक्त उत्पाद पहचानें। 70+ को PM-JAY में नामांकित करें।',
      kn: 'FD ಎಂದು ಮಾರಿದ ULIP, ಒತ್ತಡ ಮಾರಾಟ ಪತ್ತೆ. 70+ ಗೆ PM-JAY ನೋಂದಣಿ.',
    } as Record<Locale, string>,
  },
  {
    id: 'learn-insurance-in-my-language',
    chapter: 'before',
    moduleSlug: 'vernacular-portal',
    iconSlug: 'languages',
    status: 'comingSoon',
    titleI18n: {
      en: 'Learn insurance in my language, on WhatsApp',
      hi: 'अपनी भाषा में बीमा सीखें — WhatsApp पर',
      kn: 'ನನ್ನ ಭಾಷೆಯಲ್ಲಿ ವಿಮೆ ಕಲಿಯಿರಿ — WhatsApp ನಲ್ಲಿ',
    } as Record<Locale, string>,
    bodyI18n: {
      en: "Plain-language insurance education in Hindi, Kannada, Tamil, Telugu, Bengali. Voice-supported. Advisor callback on demand.",
      hi: 'सरल भाषा में बीमा शिक्षा — हिंदी, कन्नड़, तमिल, तेलुगु, बंगाली। आवाज़ समर्थन। माँग पर सलाहकार कॉलबैक।',
      kn: 'ಸರಳ ಭಾಷೆಯಲ್ಲಿ ವಿಮಾ ಶಿಕ್ಷಣ. ಧ್ವನಿ ಬೆಂಬಲ. ಸಲಹೆಗಾರ ಕಾಲ್-ಬ್ಯಾಕ್.',
    } as Record<Locale, string>,
  },

  /* ───────── DURING — the moment, real-time help ───────── */
  {
    id: 'hospital-refused-pmjay',
    chapter: 'during',
    moduleSlug: 'govt-scheme-navigator',
    iconSlug: 'shield-check',
    status: 'comingSoon',
    titleI18n: {
      en: 'A hospital refused my PM-JAY card',
      hi: 'अस्पताल ने मेरा PM-JAY कार्ड स्वीकार नहीं किया',
      kn: 'ಆಸ್ಪತ್ರೆ ನನ್ನ PM-JAY ಕಾರ್ಡ್ ಒಪ್ಪಲಿಲ್ಲ',
    } as Record<Locale, string>,
    bodyI18n: {
      en: "A step-by-step emergency script: call 14555, get written refusal, file CGRMS, escalate to DGNO. All in your language.",
      hi: 'आपातकालीन स्क्रिप्ट: 14555 कॉल, लिखित अस्वीकृति, CGRMS फाइल, DGNO एस्केलेशन।',
      kn: 'ತುರ್ತು ಸ್ಕ್ರಿಪ್ಟ್: 14555 ಕಾಲ್, ಲಿಖಿತ ನಿರಾಕರಣೆ, CGRMS ಸಲ್ಲಿಕೆ, DGNO ಏರಿಕೆ.',
    } as Record<Locale, string>,
  },
  {
    id: 'audit-business-risk',
    chapter: 'during',
    moduleSlug: 'msme-navigator',
    iconSlug: 'briefcase',
    status: 'comingSoon',
    titleI18n: {
      en: "Audit my business's insurance risk",
      hi: 'मेरे व्यवसाय के बीमा जोखिम का ऑडिट',
      kn: 'ನನ್ನ ವ್ಯಾಪಾರದ ವಿಮಾ ಅಪಾಯ ಆಡಿಟ್',
    } as Record<Locale, string>,
    bodyI18n: {
      en: "Sector-specific risk audit for your MSME. Prioritised coverage stack. Claim support when a business event happens.",
      hi: 'MSME के लिए क्षेत्र-विशिष्ट जोखिम ऑडिट। प्राथमिकता कवरेज। व्यावसायिक घटना में दावा सहायता।',
      kn: 'MSME ವಲಯ-ನಿರ್ದಿಷ್ಟ ಆಡಿಟ್. ಆದ್ಯತೆಯ ಕವರೇಜ್. ಕ್ಲೈಮ್ ಬೆಂಬಲ.',
    } as Record<Locale, string>,
  },

  /* ───────── AFTER — recovery of what's owed ───────── */
  {
    id: 'recover-deceased-relative-benefits',
    chapter: 'after',
    moduleSlug: 'govt-scheme-navigator',
    iconSlug: 'heart',
    status: 'comingSoon',
    titleI18n: {
      en: "Recover a deceased family member's benefits",
      hi: 'दिवंगत परिवार सदस्य के लाभ वसूलें',
      kn: 'ಮೃತ ಕುಟುಂಬ ಸದಸ್ಯರ ಲಾಭ ಮರುಪಡೆಯಿಕೆ',
    } as Record<Locale, string>,
    bodyI18n: {
      en: "PMJJBY, PMSBY, and unclaimed life insurance worth thousands of crores. We show you how to check and how to claim.",
      hi: 'PMJJBY, PMSBY, और हज़ारों करोड़ का अनक्लेम्ड जीवन बीमा। कैसे जाँचें और दावा करें — हम बताते हैं।',
      kn: 'PMJJBY, PMSBY, ಅನ್‌ಕ್ಲೈಮ್ಡ್ ಜೀವ ವಿಮೆ. ಹೇಗೆ ಪರಿಶೀಲಿಸಬೇಕು + ಕ್ಲೈಮ್ ಮಾಡಬೇಕು — ನಾವು ತೋರಿಸುತ್ತೇವೆ.',
    } as Record<Locale, string>,
  },
  {
    id: 'recover-missold-ulip',
    chapter: 'after',
    moduleSlug: 'life-mis-selling-recovery',
    iconSlug: 'file-warning',
    status: 'comingSoon',
    titleI18n: {
      en: 'Recover premiums from a mis-sold ULIP',
      hi: 'गलत बेचे गए ULIP से प्रीमियम वसूलें',
      kn: 'ತಪ್ಪಾಗಿ ಮಾರಿದ ULIP ನಿಂದ ಪ್ರೀಮಿಯಂ ಮರುಪಡೆಯಿಕೆ',
    } as Record<Locale, string>,
    bodyI18n: {
      en: "Sold a ULIP as an FD? IRDAI mandates full refund in proven mis-selling cases. We detect the signals and draft the complaint.",
      hi: 'FD कहकर ULIP बेचा? IRDAI सिद्ध मामलों में पूरा रिफंड देता है। हम संकेत पकड़ते हैं और शिकायत ड्राफ्ट करते हैं।',
      kn: 'FD ಎಂದು ULIP ಮಾರಿದರೇ? IRDAI ಸಾಬೀತಾದ ಪ್ರಕರಣಗಳಲ್ಲಿ ಪೂರ್ಣ ಮರುಪಾವತಿ. ಸೂಚಕ + ದೂರು ಡ್ರಾಫ್ಟ್.',
    } as Record<Locale, string>,
  },
  {
    id: 'fight-rejected-claim',
    chapter: 'after',
    moduleSlug: 'claims-advocacy',
    iconSlug: 'shield-check',
    status: 'comingSoon',
    titleI18n: {
      en: 'Fight a rejected claim through the Ombudsman',
      hi: 'अस्वीकृत दावे की लोकपाल के ज़रिए लड़ाई',
      kn: 'ತಿರಸ್ಕೃತ ಕ್ಲೈಮ್‌ಗಾಗಿ ಲೋಕಪಾಲ ಮೂಲಕ ಹೋರಾಟ',
    } as Record<Locale, string>,
    bodyI18n: {
      en: "70% of Ombudsman cases go the policyholder's way. We draft the escalation, track the 14-day SLA, and carry it to the Ombudsman.",
      hi: '70% लोकपाल मामले पॉलिसीधारक के पक्ष में। हम एस्केलेशन ड्राफ्ट करते हैं, 14-दिन SLA ट्रैक करते हैं।',
      kn: '70% ಲೋಕಪಾಲ ಪ್ರಕರಣಗಳು ಪಾಲಿಸಿದಾರರ ಪರ. ಏರಿಕೆ ಡ್ರಾಫ್ಟ್ + 14-ದಿನ SLA ಟ್ರ್ಯಾಕಿಂಗ್.',
    } as Record<Locale, string>,
  },
];

export function momentsByChapter(chapter: Chapter): Moment[] {
  return MOMENTS.filter((m) => m.chapter === chapter);
}
