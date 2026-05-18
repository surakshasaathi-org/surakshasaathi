/**
 * Long-form marketing copy per module per locale. Used by the module detail
 * page at /[locale]/[moduleSlug].
 *
 * Kept inline (not in i18n JSON) because the sections are tightly coupled to
 * the page layout and evolve together. When a module graduates from skeleton
 * to live, we replace `launchNote` with the real CTA text and wire the
 * primary button.
 */
export interface ModulePageCopy {
  problem: string[];               // 3 bullets — "what's broken"
  whatYoullGet: string[];          // 3–5 bullets — "what we'll do"
  howItWorks: { heading: string; body: string }[]; // exactly 3 steps
  whoItsFor: { title: string; body: string }[];    // 2–3 personas
  launchNote: string;              // 1 line about timing / 'live now'
  faqs: { q: string; a: string }[];
}

type ByLocale = Record<'en' | 'hi' | 'kn', ModulePageCopy>;

export const MODULE_PAGES: Record<string, ByLocale> = {
  'claims-advocacy': {
    en: {
      problem: [
        '₹26,000 crore in health claims rejected last year — a 19% rise year-on-year.',
        'Only 25% of policyholders get a clean approval. 33% get questionable partial approvals.',
        "Most people never read their policy's fine print — they learn the exclusions only when a claim is denied.",
      ],
      whatYoullGet: [
        'Upload your health policy (PDF or photo). Our AI reads every page — exclusions, waiting periods, co-pay clauses, room-rent limits, sub-limits.',
        'A plain-language report in your language: what\'s covered, what\'s not, the surprises nobody told you about.',
        'A Claim Readiness Score (0–100) with specific actions to improve it before hospitalisation.',
        'Scenario check: "I might be hospitalised for knee surgery in 3 months — will it be covered?" We predict green / amber / red and tell you why.',
      ],
      howItWorks: [
        { heading: 'Upload your policy', body: 'Drop the PDF or snap a photo. No account, no payment. Your document is auto-deleted after 7 days.' },
        { heading: 'Get your deep-dive report', body: 'Our AI reads the whole policy and produces a plain-language summary + exclusions list + waiting-period timeline in minutes.' },
        { heading: 'Check any claim scenario', body: 'Describe what might happen — the condition, hospital, cost band, timing. We predict whether your policy will cover it, and why.' },
      ],
      whoItsFor: [
        { title: 'The first-time health-insurance buyer', body: 'You bought a policy because an agent recommended it. You want to know what you actually signed up for — before a medical emergency teaches you the hard way.' },
        { title: 'The family planner', body: 'Your parents\' policy renews next month. You want to know whether the diabetes diagnosis from last year is still a blocker, and whether the cover is sufficient.' },
        { title: 'The just-diagnosed patient', body: 'You have 3 months until the surgery. You need to know right now whether this policy will pay, and if not, what to do in those 3 months.' },
      ],
      launchNote: 'The free policy analyser launches in beta shortly. Join the waitlist — early users get priority feedback access + first look at the coverage-prediction tool.',
      faqs: [
        { q: 'Is this really free?', a: 'Yes. Policy analysis and coverage prediction are always free. We may add a paid letter-drafting service later for users whose claims are rejected, but the core analysis will stay free forever.' },
        { q: 'Do you store my policy document?', a: 'Only for 7 days, on Indian servers (Supabase India, AWS Mumbai), so you can return to the report via your share link. After 7 days it is deleted automatically. You can delete it sooner from the report page.' },
        { q: 'Will this work for my old policy from a small insurer?', a: 'Yes — our AI reads the document itself rather than relying on insurer APIs. If your policy is a standard Indian health-insurance policy from any IRDAI-registered insurer, we can analyse it.' },
        { q: 'Can the prediction be wrong?', a: 'Yes. Our prediction is based on the policy wording; the actual claim outcome depends on how the insurer interprets it, documentation, pre-authorisation, and sometimes luck. We show our confidence level and always tell you to verify important details with your insurer before acting.' },
      ],
    },
    hi: {
      problem: [
        'पिछले साल ₹26,000 करोड़ के स्वास्थ्य दावे अस्वीकृत हुए — 19% वार्षिक वृद्धि।',
        'केवल 25% पॉलिसीधारकों को बिना परेशानी मंजूरी मिलती है। 33% को संदिग्ध आंशिक मंजूरी।',
        'ज़्यादातर लोग पॉलिसी की बारीकियाँ कभी नहीं पढ़ते — अपवर्जन तब पता चलते हैं जब दावा खारिज हो जाता है।',
      ],
      whatYoullGet: [
        'अपनी स्वास्थ्य पॉलिसी (PDF या फोटो) अपलोड करें। हमारा AI हर पन्ना पढ़ता है — अपवर्जन, प्रतीक्षा अवधि, को-पे क्लॉज़, रूम-रेंट सीमा, सब-लिमिट।',
        'आपकी भाषा में एक सरल रिपोर्ट: क्या कवर है, क्या नहीं, वे सरप्राइज़ जो किसी ने नहीं बताए।',
        'क्लेम रेडीनेस स्कोर (0–100) — अस्पताल जाने से पहले इसे सुधारने के विशेष तरीके।',
        'परिदृश्य जाँच: "शायद 3 महीने में घुटने की सर्जरी — क्या कवर होगा?" हम हरा/पीला/लाल भविष्यवाणी और कारण बताते हैं।',
      ],
      howItWorks: [
        { heading: 'पॉलिसी अपलोड करें', body: 'PDF डालें या फोटो खींचें। कोई खाता नहीं, कोई भुगतान नहीं। 7 दिनों बाद दस्तावेज़ अपने आप हटा दिया जाता है।' },
        { heading: 'गहरी रिपोर्ट पाएं', body: 'AI पूरी पॉलिसी पढ़कर सरल भाषा में सारांश + अपवर्जन सूची + प्रतीक्षा अवधि टाइमलाइन बनाता है।' },
        { heading: 'किसी भी दावे का परिदृश्य जाँचें', body: 'बीमारी, अस्पताल, लागत, समय बताएं। क्या पॉलिसी कवर करेगी, और क्यों — हम बताते हैं।' },
      ],
      whoItsFor: [
        { title: 'पहली बार स्वास्थ्य बीमा खरीदने वाला', body: 'एजेंट की सलाह से पॉलिसी ली। अब जानना चाहते हैं कि असल में क्या साइन किया — मेडिकल इमरजेंसी से पहले।' },
        { title: 'परिवार योजनाकार', body: 'माता-पिता की पॉलिसी अगले महीने रिन्यू होगी। पिछले साल का मधुमेह निदान अब भी रुकावट है या नहीं?' },
        { title: 'हाल ही में निदान', body: 'सर्जरी में 3 महीने हैं। अभी जानना चाहते हैं कि पॉलिसी भुगतान करेगी या नहीं।' },
      ],
      launchNote: 'मुफ्त पॉलिसी विश्लेषक जल्द ही बीटा में लॉन्च होगा। वेटलिस्ट में जुड़ें — शुरुआती उपयोगकर्ताओं को प्राथमिकता।',
      faqs: [
        { q: 'क्या यह सच में मुफ्त है?', a: 'हाँ। पॉलिसी विश्लेषण और कवरेज भविष्यवाणी हमेशा मुफ्त हैं। बाद में पत्र-ड्राफ्टिंग सशुल्क हो सकती है, लेकिन मुख्य विश्लेषण हमेशा मुफ्त रहेगा।' },
        { q: 'क्या आप मेरा दस्तावेज़ स्टोर करते हैं?', a: 'केवल 7 दिन, भारतीय सर्वर पर (AWS Mumbai)। इसके बाद अपने आप हट जाता है। आप पहले भी हटा सकते हैं।' },
        { q: 'क्या यह पुरानी पॉलिसी पर काम करेगा?', a: 'हाँ — हमारा AI दस्तावेज़ को सीधे पढ़ता है, बीमा कंपनी के API पर निर्भर नहीं। कोई भी IRDAI-पंजीकृत भारतीय स्वास्थ्य बीमा पॉलिसी।' },
        { q: 'क्या भविष्यवाणी गलत हो सकती है?', a: 'हाँ। हमारी भविष्यवाणी पॉलिसी के शब्दों पर आधारित है; असली परिणाम बीमा कंपनी की व्याख्या पर निर्भर। हम अपनी confidence level दिखाते हैं और हमेशा कहते हैं कि बीमा कंपनी से सत्यापित करें।' },
      ],
    },
    kn: {
      problem: [
        'ಕಳೆದ ವರ್ಷ ₹26,000 ಕೋಟಿ ಆರೋಗ್ಯ ಕ್ಲೈಮ್‌ಗಳು ತಿರಸ್ಕೃತ — 19% ವಾರ್ಷಿಕ ಏರಿಕೆ.',
        'ಕೇವಲ 25% ಪಾಲಿಸಿದಾರರಿಗೆ ಶುದ್ಧ ಅನುಮೋದನೆ. 33% ಗೆ ಸಂದೇಹಾಸ್ಪದ ಭಾಗಶಃ ಅನುಮೋದನೆ.',
        'ಹೆಚ್ಚಿನವರು ಪಾಲಿಸಿಯ ಸೂಕ್ಷ್ಮ ಅಂಶಗಳನ್ನು ಓದುವುದಿಲ್ಲ — ಹೊರಗಿಡುವಿಕೆಗಳು ಕ್ಲೈಮ್ ತಿರಸ್ಕೃತವಾದಾಗ ಮಾತ್ರ ತಿಳಿಯುತ್ತವೆ.',
      ],
      whatYoullGet: [
        'ನಿಮ್ಮ ಪಾಲಿಸಿ (PDF ಅಥವಾ ಫೋಟೋ) ಅಪ್ಲೋಡ್ ಮಾಡಿ. AI ಪ್ರತಿ ಪುಟ ಓದುತ್ತದೆ — ಹೊರಗಿಡುವಿಕೆ, ಕಾಯುವ ಅವಧಿ, ಕೋ-ಪೇ, ಕೋಣೆ ಬಾಡಿಗೆ ಮಿತಿ, ಸಬ್-ಲಿಮಿಟ್.',
        'ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಸರಳ ವರದಿ: ಏನು ಕವರ್, ಏನು ಅಲ್ಲ, ಯಾರೂ ಹೇಳದ ಅಚ್ಚರಿಗಳು.',
        'ಕ್ಲೈಮ್ ಸಿದ್ಧತೆ ಸ್ಕೋರ್ (0–100) — ಆಸ್ಪತ್ರೆಗೆ ಮೊದಲು ಸುಧಾರಿಸಲು ನಿರ್ದಿಷ್ಟ ಕ್ರಮಗಳು.',
        'ಸನ್ನಿವೇಶ ಪರಿಶೀಲನೆ: "3 ತಿಂಗಳಲ್ಲಿ ಮೊಣಕಾಲು ಶಸ್ತ್ರಚಿಕಿತ್ಸೆ — ಕವರ್ ಆಗುತ್ತದೆಯೇ?" ಹಸಿರು/ಅಂಬರ್/ಕೆಂಪು ಊಹೆ.',
      ],
      howItWorks: [
        { heading: 'ಪಾಲಿಸಿ ಅಪ್ಲೋಡ್ ಮಾಡಿ', body: 'PDF ಅಥವಾ ಫೋಟೋ. ಖಾತೆ ಇಲ್ಲ, ಪಾವತಿ ಇಲ್ಲ. 7 ದಿನಗಳ ನಂತರ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಅಳಿಸಲಾಗುತ್ತದೆ.' },
        { heading: 'ಆಳವಾದ ವರದಿ ಪಡೆಯಿರಿ', body: 'AI ಪೂರ್ಣ ಪಾಲಿಸಿ ಓದಿ ಸರಳ ಸಾರಾಂಶ + ಹೊರಗಿಡುವ ಪಟ್ಟಿ + ಕಾಯುವ ಅವಧಿ ಟೈಮ್‌ಲೈನ್.' },
        { heading: 'ಯಾವುದೇ ಕ್ಲೈಮ್ ಸನ್ನಿವೇಶ ಪರಿಶೀಲಿಸಿ', body: 'ರೋಗ, ಆಸ್ಪತ್ರೆ, ವೆಚ್ಚ, ಸಮಯ — ಪಾಲಿಸಿ ಕವರ್ ಆಗುತ್ತದೆಯೇ, ಏಕೆ.' },
      ],
      whoItsFor: [
        { title: 'ಮೊದಲ ಬಾರಿ ಆರೋಗ್ಯ ವಿಮೆ ಖರೀದಿಸಿದವರು', body: 'ಏಜೆಂಟ್ ಶಿಫಾರಸಿನ ಮೇಲೆ ಪಾಲಿಸಿ ಖರೀದಿಸಿದ್ದೀರಿ. ಏನು ಸಹಿ ಮಾಡಿದ್ದೀರಿ ಎಂದು ತಿಳಿಯಬೇಕು.' },
        { title: 'ಕುಟುಂಬ ಯೋಜಕ', body: 'ಪೋಷಕರ ಪಾಲಿಸಿ ಮುಂದಿನ ತಿಂಗಳು ನವೀಕರಣ. ಕಳೆದ ವರ್ಷದ ಮಧುಮೇಹ ಇನ್ನೂ ಅಡ್ಡಿಯೇ?' },
        { title: 'ಹೊಸ ರೋಗನಿರ್ಣಯ', body: 'ಶಸ್ತ್ರಚಿಕಿತ್ಸೆಗೆ 3 ತಿಂಗಳು. ಪಾಲಿಸಿ ಪಾವತಿಸುತ್ತದೆಯೇ ಎಂದು ಈಗಲೇ ತಿಳಿಯಬೇಕು.' },
      ],
      launchNote: 'ಉಚಿತ ಪಾಲಿಸಿ ವಿಶ್ಲೇಷಕ ಶೀಘ್ರದಲ್ಲೇ ಬೀಟಾ. ವೇಟ್‌ಲಿಸ್ಟ್ ಸೇರಿ — ಆರಂಭಿಕ ಬಳಕೆದಾರರಿಗೆ ಆದ್ಯತೆ.',
      faqs: [
        { q: 'ಇದು ನಿಜವಾಗಿಯೂ ಉಚಿತವೇ?', a: 'ಹೌದು. ವಿಶ್ಲೇಷಣೆ ಮತ್ತು ಕವರೇಜ್ ಊಹೆ ಯಾವಾಗಲೂ ಉಚಿತ. ಪತ್ರ-ಡ್ರಾಫ್ಟಿಂಗ್ ನಂತರ ಪಾವತಿಯಾಗಬಹುದು, ಮುಖ್ಯ ವಿಶ್ಲೇಷಣೆ ಯಾವಾಗಲೂ ಉಚಿತ.' },
        { q: 'ನೀವು ನನ್ನ ದಸ್ತಾವೇಜನ್ನು ಸಂಗ್ರಹಿಸುತ್ತೀರಾ?', a: '7 ದಿನಗಳ ಮಾತ್ರ, ಭಾರತೀಯ ಸರ್ವರ್‌ಗಳಲ್ಲಿ (AWS Mumbai). ನಂತರ ಸ್ವಯಂಚಾಲಿತವಾಗಿ ಅಳಿಸಲಾಗುತ್ತದೆ.' },
        { q: 'ಹಳೆಯ ಪಾಲಿಸಿಗೆ ಕೆಲಸ ಮಾಡುತ್ತದೆಯೇ?', a: 'ಹೌದು — ನಮ್ಮ AI ದಸ್ತಾವೇಜನ್ನು ನೇರವಾಗಿ ಓದುತ್ತದೆ. ಯಾವುದೇ IRDAI-ನೋಂದಾಯಿತ ಪಾಲಿಸಿ.' },
        { q: 'ಊಹೆ ತಪ್ಪಾಗಿರಬಹುದೇ?', a: 'ಹೌದು. ಪಾಲಿಸಿ ಪದಗಳ ಮೇಲೆ ಆಧಾರಿತ; ನಿಜವಾದ ಫಲಿತಾಂಶ ಕಂಪನಿಯ ವ್ಯಾಖ್ಯಾನದ ಮೇಲೆ. confidence level ತೋರಿಸುತ್ತೇವೆ.' },
      ],
    },
  },

  'govt-scheme-navigator': {
    en: {
      problem: [
        '70% of eligible Indian families are aware of PM-JAY. Only 16% are enrolled.',
        '₹14,000 crore sits in unclaimed life and health insurance — largely because families never knew the cover existed.',
        'Every Indian aged 70+ is automatically eligible for PM-JAY since October 2024. Almost nobody knows.',
      ],
      whatYoullGet: [
        'A 2-minute eligibility check across PM-JAY, PMSBY, PMJJBY, CGHS, ESI, and 14 state schemes.',
        'Results grouped by family member — "Your father (72) qualifies for Vaya Vandana + PM-JAY automatically."',
        'Step-by-step enrolment guide per scheme — online portal, CSC, bank branch, or SMS 14555.',
        'A self-serve guide for when a hospital refuses to honour your PM-JAY card.',
        'A self-serve guide for claiming an unclaimed PMJJBY/PMSBY death benefit from a deceased family member.',
      ],
      howItWorks: [
        { heading: 'Tell us about your household', body: 'State, age, income band, occupation. Add family members. Takes under 2 minutes. No Aadhaar required.' },
        { heading: 'See what your family qualifies for', body: 'All schemes checked at once. Green auto-eligible, amber possibly eligible, red not eligible — with a reason for each.' },
        { heading: 'Act on it', body: 'For each match, a step-by-step enrolment guide in your language. Direct deep-links to official portals.' },
      ],
      whoItsFor: [
        { title: 'The adult child in Bengaluru', body: 'Your parents live in a Tier-2 town. You want to know whether they qualify for PM-JAY or Vaya Vandana before the next hospital visit.' },
        { title: 'The construction worker in Mumbai', body: 'You\'re one of the 11 urban occupational categories auto-eligible for PM-JAY — but nobody told you. 2 minutes from now, you could have a ₹5 lakh cover.' },
        { title: 'The recently-bereaved family', body: 'A family member passed away. You suspect they had PMJJBY through their bank, but no policy document exists. We show you how to recover the ₹2 lakh.' },
      ],
      launchNote: 'Eligibility check launches in beta shortly. The 21-scheme database, hospital-refusal guide, and unclaimed-recovery guide are under review — join the waitlist for early access.',
      faqs: [
        { q: 'Is this really free?', a: 'Yes. The eligibility check is free forever. Scheme enrolment itself is on the government\'s official portal, also free. We never take a commission on a government scheme.' },
        { q: 'Do I need Aadhaar to check eligibility?', a: 'No. We don\'t ask for Aadhaar at all. You only need Aadhaar if you choose to enrol, and that happens on the government\'s own portal — not ours.' },
        { q: 'What if I live in West Bengal or Delhi?', a: 'West Bengal has its own Swasthya Sathi scheme (ran independently from PM-JAY). Delhi joined PM-JAY in April 2025. We cover both — and warn you about portability rules when a state-scheme beneficiary travels.' },
        { q: 'Can you enrol me directly?', a: 'Not at launch. We guide you to the right official portal with the right documents. A paid "assisted enrolment" tier may come later, but the free check + walkthrough stays free forever.' },
      ],
    },
    hi: {
      problem: [
        '70% पात्र भारतीय परिवार PM-JAY के बारे में जानते हैं। केवल 16% नामांकित हैं।',
        '₹14,000 करोड़ अनक्लेम्ड बीमा में पड़े हैं — ज्यादातर इसलिए कि परिवारों को कवर का पता ही नहीं था।',
        '70+ का हर भारतीय अक्टूबर 2024 से PM-JAY के लिए स्वचालित पात्र है। लगभग किसी को पता नहीं।',
      ],
      whatYoullGet: [
        'PM-JAY, PMSBY, PMJJBY, CGHS, ESI और 14 राज्य योजनाओं में 2 मिनट की पात्रता जाँच।',
        'परिवार के सदस्य के अनुसार परिणाम — "आपके पिता (72) PM-JAY + वय वंदना के लिए स्वचालित पात्र।"',
        'प्रत्येक योजना के लिए चरण-दर-चरण नामांकन गाइड।',
        'अस्पताल PM-JAY कार्ड न माने तो क्या करें — स्वयं-सहायता गाइड।',
        'मृतक परिवार सदस्य के अनक्लेम्ड PMJJBY/PMSBY को पाने की गाइड।',
      ],
      howItWorks: [
        { heading: 'परिवार के बारे में बताएं', body: 'राज्य, आयु, आय स्तर, व्यवसाय। सदस्य जोड़ें। 2 मिनट से कम। आधार की ज़रूरत नहीं।' },
        { heading: 'पात्रता देखें', body: 'सभी योजनाएँ एक साथ जाँची गईं। हरा स्वचालित पात्र, पीला संभवतः पात्र, लाल अपात्र — कारण सहित।' },
        { heading: 'कार्रवाई करें', body: 'आपकी भाषा में चरण-दर-चरण नामांकन गाइड। सरकारी पोर्टल पर सीधे लिंक।' },
      ],
      whoItsFor: [
        { title: 'बेंगलुरु का बेटा/बेटी', body: 'माता-पिता छोटे शहर में। जानना चाहते हैं कि वे PM-JAY या वय वंदना के पात्र हैं या नहीं।' },
        { title: 'मुंबई का निर्माण कर्मी', body: 'आप 11 शहरी व्यावसायिक श्रेणियों में से एक हैं — लेकिन किसी ने बताया नहीं। 2 मिनट में ₹5 लाख का कवर।' },
        { title: 'हाल में शोक संतप्त परिवार', body: 'परिवार सदस्य का निधन हुआ। बैंक के ज़रिए PMJJBY होने का शक। ₹2 लाख पाने का रास्ता।' },
      ],
      launchNote: 'पात्रता जाँच जल्द ही बीटा में। 21-योजना डेटाबेस और गाइड समीक्षाधीन — वेटलिस्ट में जुड़ें।',
      faqs: [
        { q: 'क्या यह सच में मुफ्त है?', a: 'हाँ। पात्रता जाँच हमेशा मुफ्त। सरकारी योजना नामांकन भी मुफ्त। हम सरकारी योजना पर कभी कमीशन नहीं लेते।' },
        { q: 'क्या पात्रता जाँच के लिए आधार चाहिए?', a: 'नहीं। हम आधार नहीं माँगते। आधार केवल नामांकन के समय चाहिए, और वह सरकारी पोर्टल पर होता है।' },
        { q: 'अगर मैं पश्चिम बंगाल या दिल्ली में रहता हूँ?', a: 'WB की स्वास्थ्य साथी अलग चलती है। दिल्ली अप्रैल 2025 में PM-JAY में शामिल। हम दोनों कवर करते हैं।' },
        { q: 'क्या आप मुझे सीधे नामांकित कर सकते हैं?', a: 'लॉन्च पर नहीं। हम सही सरकारी पोर्टल और दस्तावेज़ों तक गाइड करते हैं। बाद में सशुल्क सहायता हो सकती है।' },
      ],
    },
    kn: {
      problem: [
        '70% ಅರ್ಹ ಕುಟುಂಬಗಳಿಗೆ PM-JAY ಬಗ್ಗೆ ತಿಳಿದಿದೆ. ಕೇವಲ 16% ನೋಂದಾಯಿಸಿದ್ದಾರೆ.',
        '₹14,000 ಕೋಟಿ ಅನ್‌ಕ್ಲೈಮ್ಡ್ ವಿಮೆಯಲ್ಲಿದೆ — ಬಹಳಷ್ಟು ಕುಟುಂಬಗಳಿಗೆ ಕವರ್ ಗೊತ್ತಿರಲಿಲ್ಲ.',
        '70+ ಪ್ರತಿ ಭಾರತೀಯ ಅಕ್ಟೋಬರ್ 2024 ರಿಂದ PM-JAY ಸ್ವಯಂ-ಅರ್ಹ. ಹೆಚ್ಚಿನವರಿಗೆ ತಿಳಿಯದು.',
      ],
      whatYoullGet: [
        'PM-JAY, PMSBY, PMJJBY, CGHS, ESI ಮತ್ತು 14 ರಾಜ್ಯ ಯೋಜನೆಗಳಲ್ಲಿ 2-ನಿಮಿಷ ಅರ್ಹತೆ ಪರಿಶೀಲನೆ.',
        'ಕುಟುಂಬ ಸದಸ್ಯ ಪ್ರಕಾರ ಫಲಿತಾಂಶ — "ನಿಮ್ಮ ತಂದೆ (72) PM-JAY + ವಯ ವಂದನಾ ಸ್ವಯಂ-ಅರ್ಹ."',
        'ಪ್ರತಿ ಯೋಜನೆಗೆ ಹಂತ-ಹಂತದ ನೋಂದಣಿ ಮಾರ್ಗದರ್ಶಿ.',
        'ಆಸ್ಪತ್ರೆ PM-JAY ಕಾರ್ಡ್ ಒಪ್ಪದಿದ್ದರೆ ಸ್ವಯಂ-ಸಹಾಯ ಮಾರ್ಗದರ್ಶಿ.',
        'ಮೃತ ಕುಟುಂಬ ಸದಸ್ಯರ ಅನ್‌ಕ್ಲೈಮ್ಡ್ PMJJBY/PMSBY ಮರುಪಡೆಯಿಕೆ.',
      ],
      howItWorks: [
        { heading: 'ಕುಟುಂಬದ ಬಗ್ಗೆ ತಿಳಿಸಿ', body: 'ರಾಜ್ಯ, ವಯಸ್ಸು, ಆದಾಯ ಶ್ರೇಣಿ, ಉದ್ಯೋಗ. ಸದಸ್ಯರನ್ನು ಸೇರಿಸಿ. 2 ನಿಮಿಷಕ್ಕಿಂತ ಕಡಿಮೆ. ಆಧಾರ್ ಅಗತ್ಯವಿಲ್ಲ.' },
        { heading: 'ಅರ್ಹತೆ ನೋಡಿ', body: 'ಎಲ್ಲಾ ಯೋಜನೆಗಳು ಒಟ್ಟಿಗೆ ಪರಿಶೀಲಿಸಲಾಗಿದೆ. ಹಸಿರು ಸ್ವಯಂ-ಅರ್ಹ, ಅಂಬರ್ ಸಂಭವ, ಕೆಂಪು ಅಲ್ಲ — ಕಾರಣ ಸಹಿತ.' },
        { heading: 'ಕ್ರಮ ಕೈಗೊಳ್ಳಿ', body: 'ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಹಂತ-ಹಂತ ನೋಂದಣಿ. ಸರ್ಕಾರಿ ಪೋರ್ಟಲ್‌ಗೆ ನೇರ ಲಿಂಕ್.' },
      ],
      whoItsFor: [
        { title: 'ಬೆಂಗಳೂರಿನ ಮಗ/ಮಗಳು', body: 'ಪೋಷಕರು ಟೈರ್-2 ಪಟ್ಟಣದಲ್ಲಿ. PM-JAY ಅಥವಾ ವಯ ವಂದನಾ ಅರ್ಹತೆ ತಿಳಿಯಬೇಕು.' },
        { title: 'ಮುಂಬೈಯ ನಿರ್ಮಾಣ ಕಾರ್ಮಿಕ', body: '11 ಉದ್ಯೋಗ ವರ್ಗಗಳಲ್ಲಿ ಒಬ್ಬರು — ಯಾರೂ ಹೇಳಿಲ್ಲ. 2 ನಿಮಿಷದಲ್ಲಿ ₹5 ಲಕ್ಷ ಕವರ್.' },
        { title: 'ಇತ್ತೀಚಿನ ದುಃಖಿತ ಕುಟುಂಬ', body: 'ಕುಟುಂಬದ ಸದಸ್ಯ ಮೃತ. ಬ್ಯಾಂಕ್ ಮೂಲಕ PMJJBY ಇರಬಹುದು. ₹2 ಲಕ್ಷ ಪಡೆಯುವ ಮಾರ್ಗ.' },
      ],
      launchNote: 'ಅರ್ಹತೆ ಪರಿಶೀಲನೆ ಶೀಘ್ರದಲ್ಲೇ ಬೀಟಾ. 21-ಯೋಜನೆ ಡೇಟಾಬೇಸ್ ಪರಿಶೀಲನೆಯಲ್ಲಿ — ವೇಟ್‌ಲಿಸ್ಟ್ ಸೇರಿ.',
      faqs: [
        { q: 'ಇದು ನಿಜವಾಗಿಯೂ ಉಚಿತವೇ?', a: 'ಹೌದು. ಅರ್ಹತೆ ಪರಿಶೀಲನೆ ಯಾವಾಗಲೂ ಉಚಿತ. ಸರ್ಕಾರಿ ನೋಂದಣಿಯೂ ಉಚಿತ. ಸರ್ಕಾರಿ ಯೋಜನೆಯಲ್ಲಿ ಕಮಿಷನ್ ಸ್ವೀಕರಿಸುವುದಿಲ್ಲ.' },
        { q: 'ಅರ್ಹತೆ ಪರಿಶೀಲನೆಗೆ ಆಧಾರ್ ಬೇಕೇ?', a: 'ಇಲ್ಲ. ನಾವು ಆಧಾರ್ ಕೇಳುವುದಿಲ್ಲ. ನೋಂದಣಿಗೆ ಬೇಕು, ಅದು ಸರ್ಕಾರಿ ಪೋರ್ಟಲ್‌ನಲ್ಲಿ.' },
        { q: 'WB ಅಥವಾ ದೆಹಲಿಯಲ್ಲಿ ಇದ್ದರೆ?', a: 'WB ಗೆ ಸ್ವಸ್ಥ್ಯ ಸಾಥಿ ಪ್ರತ್ಯೇಕ. ದೆಹಲಿ ಏಪ್ರಿಲ್ 2025 ರಲ್ಲಿ PM-JAY ಸೇರಿದೆ. ನಾವು ಎರಡನ್ನೂ ಕವರ್ ಮಾಡುತ್ತೇವೆ.' },
        { q: 'ನೇರವಾಗಿ ನೋಂದಾಯಿಸುವಿರಾ?', a: 'ಲಾಂಚ್ ಸಮಯದಲ್ಲಿ ಇಲ್ಲ. ಸರಿಯಾದ ಪೋರ್ಟಲ್ + ದಸ್ತಾವೇಜುಗಳಿಗೆ ಮಾರ್ಗದರ್ಶನ. ನಂತರ ಪಾವತಿಯ ಸಹಾಯ ಬರಬಹುದು.' },
      ],
    },
  },

  'senior-citizen-portal': {
    en: {
      problem: [
        'Bank relationship managers sell ULIPs to senior citizens as "special FDs" — with 65% first-year commissions.',
        'Since October 2024, every Indian aged 70+ is automatically eligible for PM-JAY. Most seniors still don\'t know.',
        'The buyer and the user are different: the adult child wants to protect their parents, but the parents manage their own policies in a Tier-2 town.',
      ],
      whatYoullGet: [
        'Upload your parent\'s policies — we detect mis-selling signals (ULIP sold as FD, bank pressure, cognitive-decline signals).',
        'Automatic PM-JAY + Vaya Vandana eligibility check for your parent — they auto-qualify at 70+.',
        'A caretaker dashboard for the adult child: all parent\'s policies, renewal dates, nominee status, one-click emergency access.',
        'Guided mis-selling complaint filing with IRDAI for provable cases.',
      ],
      howItWorks: [
        { heading: 'Add your parents', body: 'Upload their policies, tell us their age and state. We auto-check every government scheme they qualify for.' },
        { heading: 'Scan for mis-selling', body: 'Our AI reads each policy looking for mis-sold ULIPs, policies sold under pressure, or products inappropriate for the senior\'s needs.' },
        { heading: 'Act as the family coordinator', body: 'See renewals, premium amounts, nominees, and one-click access to everything during an emergency.' },
      ],
      whoItsFor: [
        { title: 'The Bengaluru daughter', body: 'Your father in Hubli gets approached by his bank RM every year. You want visibility into what they\'re selling him.' },
        { title: 'The NRI son', body: 'Your parents are in Chennai. You can\'t drop in to help them with renewals, but you can run it from your laptop in the US.' },
        { title: 'The 72-year-old herself', body: 'You just want to know whether the policy the bank sold you was a good idea. And whether you qualify for the free PM-JAY cover everyone\'s talking about.' },
      ],
      launchNote: 'Launching in the next phase. Join the waitlist — we\'ll notify you when the policy scanner and caretaker dashboard go live.',
      faqs: [
        { q: 'Is this for the parent or the adult child?', a: 'Both. The primary buyer is usually the adult child; the primary user (for enrolments, hospitalisations) is the parent. The dashboard supports delegated access.' },
        { q: 'Can you actually recover premiums from a mis-sold ULIP?', a: 'Sometimes. IRDAI mandates a full refund in proven mis-selling cases. We analyse your policy and bank statement, give you a probability band, and help you file. Phase 2 of this product.' },
        { q: 'Does PM-JAY for 70+ cost anything?', a: 'Zero. Every Indian aged 70+ is automatically eligible regardless of income. Card issuance is free on beneficiary.nha.gov.in or via a CSC. We just help you do it.' },
      ],
    },
    hi: {
      problem: [
        'बैंक RM वरिष्ठ नागरिकों को ULIP "स्पेशल FD" कहकर बेचते हैं — 65% पहले साल के कमीशन पर।',
        'अक्टूबर 2024 से हर 70+ भारतीय PM-JAY के लिए स्वचालित पात्र। ज़्यादातर बुज़ुर्गों को पता नहीं।',
        'खरीदार और उपयोगकर्ता अलग हैं: बेटा/बेटी सुरक्षा चाहते हैं, माता-पिता खुद दूर रहते हैं।',
      ],
      whatYoullGet: [
        'माता-पिता की पॉलिसी अपलोड करें — मिस-सेलिंग संकेत (FD कहकर ULIP, बैंक दबाव) पहचानें।',
        'PM-JAY + वय वंदना की स्वचालित जाँच — 70+ पर स्वतः पात्र।',
        'बेटे/बेटी के लिए केयरटेकर डैशबोर्ड: सभी पॉलिसी, रिन्यूअल, नॉमिनी, इमरजेंसी एक-क्लिक पहुँच।',
        'सिद्ध मामलों के लिए IRDAI मिस-सेलिंग शिकायत दर्ज करवाना।',
      ],
      howItWorks: [
        { heading: 'माता-पिता जोड़ें', body: 'पॉलिसी अपलोड करें, आयु और राज्य बताएं। हर सरकारी योजना की स्वचालित जाँच।' },
        { heading: 'मिस-सेलिंग स्कैन', body: 'AI हर पॉलिसी पढ़कर ULIP या अनुचित उत्पाद पहचानता है।' },
        { heading: 'परिवार समन्वयक बनें', body: 'रिन्यूअल, प्रीमियम, नॉमिनी — एक जगह। आपातकाल में एक-क्लिक।' },
      ],
      whoItsFor: [
        { title: 'बेंगलुरु की बेटी', body: 'हुबली में रह रहे पिता को हर साल बैंक RM संपर्क करता है। आप देखना चाहती हैं क्या बिक रहा है।' },
        { title: 'NRI बेटा', body: 'माता-पिता चेन्नई में। आप US से लैपटॉप पर मदद करते हैं।' },
        { title: '72 साल की वह खुद', body: 'जानना चाहती हैं कि बैंक की पॉलिसी सही थी या नहीं। और मुफ्त PM-JAY की पात्रता।' },
      ],
      launchNote: 'अगले चरण में लॉन्च। वेटलिस्ट में जुड़ें।',
      faqs: [
        { q: 'क्या यह माता-पिता के लिए है या बेटे/बेटी के लिए?', a: 'दोनों। खरीदार आमतौर पर बेटा/बेटी, उपयोगकर्ता माता-पिता। डैशबोर्ड डेलीगेटेड एक्सेस देता है।' },
        { q: 'क्या मिस-सेलिंग प्रीमियम वापस मिल सकते हैं?', a: 'कभी-कभी। IRDAI प्रमाणित मामलों में पूरा रिफंड देता है। विश्लेषण + संभावना + फाइलिंग मदद।' },
        { q: '70+ के लिए PM-JAY का खर्च?', a: 'शून्य। हर 70+ भारतीय स्वचालित पात्र। कार्ड निःशुल्क beneficiary.nha.gov.in पर।' },
      ],
    },
    kn: {
      problem: [
        'ಬ್ಯಾಂಕ್ RM ಹಿರಿಯರಿಗೆ ULIP ಅನ್ನು "ವಿಶೇಷ FD" ಎಂದು ಮಾರುತ್ತಾರೆ — 65% ಮೊದಲ ವರ್ಷದ ಕಮಿಷನ್.',
        'ಅಕ್ಟೋಬರ್ 2024 ರಿಂದ ಪ್ರತಿ 70+ ಭಾರತೀಯ PM-JAY ಸ್ವಯಂ-ಅರ್ಹ. ಹೆಚ್ಚಿನವರಿಗೆ ತಿಳಿಯದು.',
        'ಖರೀದಿದಾರ ಮತ್ತು ಬಳಕೆದಾರ ಬೇರೆ: ಮಗ/ಮಗಳು ರಕ್ಷಣೆ ಬಯಸುತ್ತಾರೆ, ಪೋಷಕರು ದೂರ.',
      ],
      whatYoullGet: [
        'ಪೋಷಕರ ಪಾಲಿಸಿ ಅಪ್ಲೋಡ್ ಮಾಡಿ — ತಪ್ಪು-ಮಾರಾಟ ಸೂಚಕ (FD ಎಂದು ULIP) ಪತ್ತೆ.',
        'PM-JAY + ವಯ ವಂದನಾ ಸ್ವಯಂಚಾಲಿತ ಪರಿಶೀಲನೆ — 70+ ಸ್ವಯಂ-ಅರ್ಹ.',
        'ಮಗ/ಮಗಳಿಗೆ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್: ಎಲ್ಲಾ ಪಾಲಿಸಿ, ನವೀಕರಣ, ನಾಮಿನಿ, ತುರ್ತು ಪ್ರವೇಶ.',
        'ಸಾಬೀತಾದ ಪ್ರಕರಣಗಳಿಗೆ IRDAI ತಪ್ಪು-ಮಾರಾಟ ದೂರು.',
      ],
      howItWorks: [
        { heading: 'ಪೋಷಕರನ್ನು ಸೇರಿಸಿ', body: 'ಪಾಲಿಸಿ ಅಪ್ಲೋಡ್, ವಯಸ್ಸು+ರಾಜ್ಯ. ಎಲ್ಲಾ ಯೋಜನೆಗಳ ಸ್ವಯಂ ಪರಿಶೀಲನೆ.' },
        { heading: 'ತಪ್ಪು-ಮಾರಾಟ ಸ್ಕ್ಯಾನ್', body: 'AI ಪ್ರತಿ ಪಾಲಿಸಿ ಓದಿ ULIP ಅಥವಾ ಅನುಚಿತ ಉತ್ಪನ್ನ ಪತ್ತೆ.' },
        { heading: 'ಕುಟುಂಬ ಸಂಯೋಜಕ', body: 'ನವೀಕರಣ, ಪ್ರೀಮಿಯಂ, ನಾಮಿನಿ — ಒಂದೇ ಕಡೆ. ತುರ್ತಿನಲ್ಲಿ ಒಂದೇ ಕ್ಲಿಕ್.' },
      ],
      whoItsFor: [
        { title: 'ಬೆಂಗಳೂರಿನ ಮಗಳು', body: 'ಹುಬ್ಬಳ್ಳಿಯ ತಂದೆಯನ್ನು ಪ್ರತಿ ವರ್ಷ ಬ್ಯಾಂಕ್ RM ಸಂಪರ್ಕಿಸುತ್ತದೆ. ಏನು ಮಾರಾಟವಾಗುತ್ತಿದೆ ಎಂದು ನೋಡಬೇಕು.' },
        { title: 'NRI ಮಗ', body: 'ಪೋಷಕರು ಚೆನ್ನೈಯಲ್ಲಿ. USA ದಿಂದ ಲ್ಯಾಪ್‌ಟಾಪ್‌ನಲ್ಲಿ ಸಹಾಯ.' },
        { title: '72 ವರ್ಷದ ಸ್ವತಃ', body: 'ಬ್ಯಾಂಕಿನ ಪಾಲಿಸಿ ಸರಿ ಇತ್ತೇ ಎಂದು ತಿಳಿಯಬೇಕು. ಉಚಿತ PM-JAY ಅರ್ಹತೆ.' },
      ],
      launchNote: 'ಮುಂದಿನ ಹಂತದಲ್ಲಿ ಲಾಂಚ್. ವೇಟ್‌ಲಿಸ್ಟ್ ಸೇರಿ.',
      faqs: [
        { q: 'ಇದು ಪೋಷಕರಿಗೋ ಮಕ್ಕಳಿಗೋ?', a: 'ಇಬ್ಬರಿಗೂ. ಖರೀದಿದಾರ ಮಕ್ಕಳು, ಬಳಕೆದಾರ ಪೋಷಕರು. ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ delegated access ಕೊಡುತ್ತದೆ.' },
        { q: 'ತಪ್ಪು-ಮಾರಾಟ ಪ್ರೀಮಿಯಂ ಹಿಂಪಡೆಯಬಹುದೇ?', a: 'ಕೆಲವೊಮ್ಮೆ. IRDAI ಸಾಬೀತಾದ ಪ್ರಕರಣಗಳಲ್ಲಿ ಪೂರ್ಣ ಮರುಪಾವತಿ ಆದೇಶ. ವಿಶ್ಲೇಷಣೆ + ಸಂಭವ + ಫೈಲಿಂಗ್.' },
        { q: '70+ ಗೆ PM-JAY ವೆಚ್ಚ?', a: 'ಶೂನ್ಯ. ಪ್ರತಿ 70+ ಭಾರತೀಯ ಸ್ವಯಂ-ಅರ್ಹ. ಕಾರ್ಡ್ ಉಚಿತ.' },
      ],
    },
  },

  'life-mis-selling-recovery': {
    en: {
      problem: [
        'Banks distributed 33% of all new individual life insurance premiums in FY24 — up from 16% a decade ago.',
        'First-year commission on a ULIP is up to 65% of the premium. On a mutual fund it is ~1% annually.',
        "IRDAI has explicitly called mis-selling an 'alarming' level concern. Recovery through regulatory channels works — most policyholders don't file.",
      ],
      whatYoullGet: [
        'Upload your life-insurance policy + 2 years of bank statements. AI detects mis-selling signals — product-type mismatch, pressure-sale signals, cognitive-decline signals for seniors.',
        'A Mis-selling Probability Score (0–100) with the specific evidence — which sentences in the proposal, which debits in the bank statement.',
        'Drafted complaint letter for the insurer\'s grievance cell, IRDAI Bima Bharosa, and Banking Ombudsman — legally precise, ready to sign.',
        'Surrender analysis if mis-selling can\'t be proven — should you surrender now, hold until lock-in ends, or restructure?',
      ],
      howItWorks: [
        { heading: 'Upload the evidence', body: 'Policy PDF + bank statements showing premium debits. Nothing else — we never ask for Aadhaar or bank credentials.' },
        { heading: 'Get the analysis', body: 'Mis-selling probability + specific evidence + recommended next step (file / surrender / restructure).' },
        { heading: 'File the complaint', body: 'Phase 2 feature — we draft the complaint. You file, or we file on your behalf for a success fee.' },
      ],
      whoItsFor: [
        { title: 'The retiree with 3 ULIPs', body: 'Your bank RM sold you 3 ULIPs over 4 years, calling each "just like an FD but with better returns". Total premiums paid: ₹4.8 lakh. You want to know your options.' },
        { title: 'The executor of the will', body: 'A family member died. Their ULIPs are still in lock-in. You\'re deciding surrender vs hold — we help you see the math.' },
        { title: 'The angry young professional', body: 'You bought a ULIP at 28 because a bank RM promised 12% guaranteed returns. You\'re now 34 and realise you\'ve been had. We show you what\'s recoverable.' },
      ],
      launchNote: 'Launching in the next phase. Success-fee-based — 15% of recovered premiums, paid only on recovery. Join the waitlist.',
      faqs: [
        { q: 'How much can I actually recover?', a: 'Depends on the strength of the evidence. Clean mis-selling cases (proposal form didn\'t match what was verbally pitched, RM documented the pitch wrong) can recover 100% of premiums paid. Weaker cases recover partial, or force a restructure.' },
        { q: 'How long does this take?', a: 'IRDAI mandates 15 days for insurer response. If they refuse, Ombudsman typically resolves in 3–4 months. Total 3–6 months in most cases.' },
        { q: 'Is there a cost if I lose?', a: 'No — our fee is only on recovery. Phase 2 pricing: 15% of amount recovered, collected post-settlement.' },
      ],
    },
    hi: {
      problem: [
        'FY24 में बैंकों ने 33% नए व्यक्तिगत जीवन बीमा प्रीमियम बाँटे — दशक पहले 16% था।',
        'ULIP पर पहले साल का कमीशन प्रीमियम का 65% तक। म्यूचुअल फंड पर ~1% वार्षिक।',
        'IRDAI ने मिस-सेलिंग को "खतरनाक" कहा। नियामक चैनल काम करते हैं — ज़्यादातर फाइल नहीं करते।',
      ],
      whatYoullGet: [
        'जीवन बीमा पॉलिसी + 2 साल के बैंक स्टेटमेंट अपलोड करें। AI मिस-सेलिंग संकेत पहचानता है।',
        'मिस-सेलिंग संभावना स्कोर (0–100) + विशिष्ट सबूत।',
        'बीमा कंपनी, IRDAI Bima Bharosa, Banking Ombudsman को शिकायत ड्राफ्ट।',
        'अगर मिस-सेलिंग साबित नहीं — सरेंडर विश्लेषण।',
      ],
      howItWorks: [
        { heading: 'सबूत अपलोड करें', body: 'पॉलिसी PDF + बैंक स्टेटमेंट। कोई आधार नहीं माँगते।' },
        { heading: 'विश्लेषण पाएं', body: 'मिस-सेलिंग संभावना + सबूत + अगला कदम।' },
        { heading: 'शिकायत दर्ज करें', body: 'चरण 2 — हम शिकायत ड्राफ्ट करते हैं। आप दर्ज करें, या सक्सेस फी पर हम।' },
      ],
      whoItsFor: [
        { title: '3 ULIP वाला सेवानिवृत्त', body: 'बैंक RM ने 4 साल में 3 ULIP बेचे "FD जैसे" कहकर। कुल प्रीमियम ₹4.8 लाख। विकल्प जानें।' },
        { title: 'वसीयत निष्पादक', body: 'परिवार सदस्य का निधन। ULIP लॉक-इन में। सरेंडर बनाम होल्ड का गणित।' },
        { title: 'गुस्साया युवा', body: '28 साल में 12% गारंटी कहकर ULIP बेचा गया। 34 साल में एहसास। क्या वसूल हो सकता है।' },
      ],
      launchNote: 'अगले चरण में लॉन्च। वसूली का 15% — जीत पर ही। वेटलिस्ट में जुड़ें।',
      faqs: [
        { q: 'कितना वसूल हो सकता है?', a: 'सबूत की मज़बूती पर निर्भर। साफ मामले 100% प्रीमियम वापस। कमज़ोर मामले आंशिक।' },
        { q: 'कितना समय?', a: 'IRDAI 15 दिन जवाब ज़रूरी। लोकपाल 3-4 महीने। कुल 3-6 महीने।' },
        { q: 'अगर हार गया तो खर्च?', a: 'कोई नहीं — फीस केवल वसूली पर।' },
      ],
    },
    kn: {
      problem: [
        'FY24 ರಲ್ಲಿ ಬ್ಯಾಂಕುಗಳು 33% ಹೊಸ ವೈಯಕ್ತಿಕ ಜೀವ ವಿಮಾ ಪ್ರೀಮಿಯಂಗಳನ್ನು ವಿತರಿಸಿದವು.',
        'ULIP ಗೆ ಮೊದಲ ವರ್ಷದ ಕಮಿಷನ್ ಪ್ರೀಮಿಯಂನ 65% ವರೆಗೆ. ಮ್ಯೂಚುಯಲ್ ಫಂಡ್ ~1% ವಾರ್ಷಿಕ.',
        'IRDAI ತಪ್ಪು-ಮಾರಾಟವನ್ನು "ಅಪಾಯಕಾರಿ" ಎಂದಿದೆ. ನಿಯಂತ್ರಕ ಮಾರ್ಗಗಳು ಕೆಲಸ ಮಾಡುತ್ತವೆ.',
      ],
      whatYoullGet: [
        'ಜೀವ ವಿಮಾ ಪಾಲಿಸಿ + 2 ವರ್ಷಗಳ ಬ್ಯಾಂಕ್ ಹೇಳಿಕೆಗಳು. AI ತಪ್ಪು-ಮಾರಾಟ ಸೂಚಕ ಪತ್ತೆ.',
        'ತಪ್ಪು-ಮಾರಾಟ ಸಂಭವ ಸ್ಕೋರ್ (0–100) + ನಿರ್ದಿಷ್ಟ ಸಾಕ್ಷ್ಯ.',
        'ಕಂಪನಿ, IRDAI, Banking Ombudsman ಗೆ ದೂರು ಡ್ರಾಫ್ಟ್.',
        'ಸಾಬೀತಾಗದಿದ್ದರೆ — ಸರೆಂಡರ್ ವಿಶ್ಲೇಷಣೆ.',
      ],
      howItWorks: [
        { heading: 'ಸಾಕ್ಷ್ಯ ಅಪ್ಲೋಡ್', body: 'ಪಾಲಿಸಿ + ಬ್ಯಾಂಕ್ ಹೇಳಿಕೆ. ಆಧಾರ್ ಕೇಳುವುದಿಲ್ಲ.' },
        { heading: 'ವಿಶ್ಲೇಷಣೆ', body: 'ಸಂಭವ + ಸಾಕ್ಷ್ಯ + ಮುಂದಿನ ಹೆಜ್ಜೆ.' },
        { heading: 'ದೂರು ಸಲ್ಲಿಸಿ', body: 'ಹಂತ 2 — ನಾವು ಡ್ರಾಫ್ಟ್ ಮಾಡುತ್ತೇವೆ. ನೀವು ಸಲ್ಲಿಸಿ ಅಥವಾ ಯಶಸ್ಸಿನ ಶುಲ್ಕಕ್ಕೆ ನಾವು.' },
      ],
      whoItsFor: [
        { title: '3 ULIP ಹೊಂದಿರುವ ನಿವೃತ್ತ', body: 'ಬ್ಯಾಂಕ್ RM 4 ವರ್ಷಗಳಲ್ಲಿ 3 ULIP ಮಾರಿತು "FD ತರಹ" ಎಂದು. ಒಟ್ಟು ಪ್ರೀಮಿಯಂ ₹4.8 ಲಕ್ಷ.' },
        { title: 'ಉಯಿಲು ನಿರ್ವಾಹಕ', body: 'ಕುಟುಂಬ ಸದಸ್ಯ ಮೃತ. ULIP ಲಾಕ್-ಇನ್ ನಲ್ಲಿ. ಸರೆಂಡರ್ vs ಹೋಲ್ಡ್ ಲೆಕ್ಕ.' },
        { title: 'ಕೋಪಗೊಂಡ ಯುವಕ', body: '28 ಕ್ಕೆ 12% ಗ್ಯಾರಂಟಿ ಎಂದು ULIP ಮಾರಿದರು. 34 ಕ್ಕೆ ಅರಿವಾಯಿತು. ಮರುಪಡೆಯಬಹುದೇ?' },
      ],
      launchNote: 'ಮುಂದಿನ ಹಂತದಲ್ಲಿ ಲಾಂಚ್. ಮರುಪಡೆದ 15% — ಗೆಲುವಿಗೆ ಮಾತ್ರ. ವೇಟ್‌ಲಿಸ್ಟ್ ಸೇರಿ.',
      faqs: [
        { q: 'ಎಷ್ಟು ಮರುಪಡೆಯಬಹುದು?', a: 'ಸಾಕ್ಷ್ಯದ ಮೇಲೆ ಅವಲಂಬಿತ. ಸ್ಪಷ್ಟ ಪ್ರಕರಣಗಳು 100% ಪ್ರೀಮಿಯಂ ಹಿಂತಿರುಗಬಹುದು.' },
        { q: 'ಎಷ್ಟು ಸಮಯ?', a: 'IRDAI 15 ದಿನ. ಲೋಕಪಾಲ 3-4 ತಿಂಗಳು. ಒಟ್ಟು 3-6 ತಿಂಗಳು.' },
        { q: 'ಸೋತರೆ ವೆಚ್ಚ?', a: 'ಇಲ್ಲ — ಶುಲ್ಕ ಮರುಪಡೆಯಿಕೆ ಮೇಲೆ ಮಾತ್ರ.' },
      ],
    },
  },

  'policy-health-score': {
    en: {
      problem: [
        "India's insurance protection gap grows 4% annually — mostly because people buy a policy and never review it.",
        "Life changes — marriage, a child, a diagnosis, a property purchase — should trigger a coverage review. Almost never do.",
        'Bima Sugam is prohibited from storing customer data — so it cannot do longitudinal advisory. That gap is structural.',
      ],
      whatYoullGet: [
        'Link your family\'s policies. We compute a 0–100 Policy Health Score across five dimensions.',
        'Coverage adequacy, redundancy/overlap, nominee accuracy, renewal risk, gap alerts — scored separately + combined.',
        'Gap alerts with specific actions: "Your father is 72 — add him to your floater OR enrol him in Vaya Vandana."',
        'Life-event triggers: when you add a child, receive a diagnosis, change jobs — the score auto-updates with new alerts.',
      ],
      howItWorks: [
        { heading: 'Upload your family\'s policies', body: 'Manual upload; Bima Sugam API pull when available. OCR handles PDF + photo.' },
        { heading: 'Get your score', body: '0–100 score per person, per policy, per family. See which dimension is dragging you down.' },
        { heading: 'Act on the gaps', body: 'Specific, locale-appropriate actions — never a sales pitch. Link to official portals or insurer cross-sell via affiliate (our fee comes from the insurer, not you).' },
      ],
      whoItsFor: [
        { title: 'The newly-married couple', body: 'Two separate policies, no joint planning yet. One score shows where you overlap and where you have gaps.' },
        { title: 'The family with aging parents', body: 'Parents are on a 15-year-old floater. Coverage has not kept pace with medical inflation. The score shows exactly how behind.' },
        { title: 'The career-change professional', body: 'Job-provided group policy used to cover you. Now you\'re freelance. Do you have enough individual cover?' },
      ],
      launchNote: 'Launching in the next phase. The 5-dimension scoring engine + gap finder are in design. Join the waitlist.',
      faqs: [
        { q: 'How is this different from comparing plans on Policybazaar?', a: 'Policybazaar optimises the sale. We optimise the next 3 years. We don\'t sell policies — we tell you what you already have, what you\'re missing, and what to do.' },
        { q: 'Will this cost money?', a: 'Basic score is free. Premium tier (advisory, priority support, faster score re-runs on life events) is ₹299/year per family. We never charge on a policy placement.' },
      ],
    },
    hi: {
      problem: [
        'भारत का बीमा सुरक्षा गैप 4% वार्षिक बढ़ रहा है — ज्यादातर इसलिए कि लोग पॉलिसी खरीदकर कभी समीक्षा नहीं करते।',
        'जीवन बदलाव — विवाह, बच्चा, निदान, संपत्ति — कवरेज समीक्षा को ट्रिगर करने चाहिए। लगभग कभी नहीं करते।',
        'Bima Sugam ग्राहक डेटा स्टोर नहीं कर सकता — इसलिए longitudinal सलाह नहीं दे सकता।',
      ],
      whatYoullGet: [
        'परिवार की पॉलिसियाँ लिंक करें। 5 आयामों में 0–100 स्कोर।',
        'कवरेज पर्याप्तता, ओवरलैप, नॉमिनी, रिन्यूअल जोखिम, गैप अलर्ट।',
        'गैप अलर्ट: "आपके पिता 72 साल के हैं — फ्लोटर में जोड़ें या वय वंदना में नामांकित करें।"',
        'जीवन-ईवेंट ट्रिगर: बच्चा जोड़ें, निदान हो, नौकरी बदले — स्कोर अपने आप अपडेट।',
      ],
      howItWorks: [
        { heading: 'पॉलिसियाँ अपलोड करें', body: 'मैनुअल या Bima Sugam API (उपलब्ध होने पर)। OCR PDF + फोटो।' },
        { heading: 'स्कोर पाएं', body: 'व्यक्ति, पॉलिसी, परिवार के अनुसार 0–100। कौन सा आयाम खींच रहा है।' },
        { heading: 'कदम उठाएं', body: 'विशिष्ट क्रियाएँ। कभी sales pitch नहीं। हमारी फीस बीमा कंपनी से।' },
      ],
      whoItsFor: [
        { title: 'नवविवाहित जोड़ा', body: 'दो अलग पॉलिसियाँ, कोई जॉइंट प्लानिंग नहीं। एक स्कोर ओवरलैप और गैप दिखाता है।' },
        { title: 'बुज़ुर्ग माता-पिता वाला परिवार', body: 'माता-पिता 15 साल पुराने फ्लोटर पर। मेडिकल इन्फ्लेशन से पीछे।' },
        { title: 'करियर बदलने वाला पेशेवर', body: 'ग्रुप पॉलिसी कवर करती थी। अब फ्रीलांस। व्यक्तिगत कवर पर्याप्त है?' },
      ],
      launchNote: 'अगले चरण में लॉन्च। वेटलिस्ट में जुड़ें।',
      faqs: [
        { q: 'Policybazaar से कैसे अलग?', a: 'Policybazaar बिक्री को optimize करता है। हम अगले 3 साल को। हम बेचते नहीं — बताते हैं।' },
        { q: 'क्या यह सशुल्क है?', a: 'बेसिक स्कोर मुफ्त। प्रीमियम ₹299/वर्ष। पॉलिसी प्लेसमेंट पर कभी शुल्क नहीं।' },
      ],
    },
    kn: {
      problem: [
        'ಭಾರತದ ವಿಮಾ ರಕ್ಷಣೆ ಅಂತರ ವರ್ಷಕ್ಕೆ 4% ಬೆಳೆಯುತ್ತಿದೆ — ಹೆಚ್ಚಿನವರು ಖರೀದಿಸಿ ಪರಿಶೀಲಿಸುವುದಿಲ್ಲ.',
        'ಜೀವನ ಬದಲಾವಣೆಗಳು — ಮದುವೆ, ಮಗು, ರೋಗನಿರ್ಣಯ, ಆಸ್ತಿ — ಕವರೇಜ್ ಪರಿಶೀಲನೆಯನ್ನು ಪ್ರಚೋದಿಸಬೇಕು. ಮಾಡುವುದಿಲ್ಲ.',
        'Bima Sugam ಗ್ರಾಹಕ ಡೇಟಾ ಸಂಗ್ರಹಿಸಲಾಗುವುದಿಲ್ಲ — longitudinal ಸಲಹೆ ಸಾಧ್ಯವಿಲ್ಲ.',
      ],
      whatYoullGet: [
        'ಕುಟುಂಬ ಪಾಲಿಸಿಗಳನ್ನು ಲಿಂಕ್ ಮಾಡಿ. 5 ಆಯಾಮಗಳಲ್ಲಿ 0–100 ಸ್ಕೋರ್.',
        'ಕವರೇಜ್, ಓವರ್‌ಲ್ಯಾಪ್, ನಾಮಿನಿ, ನವೀಕರಣ ಅಪಾಯ, ಅಂತರ ಎಚ್ಚರಿಕೆ.',
        'ಅಂತರ ಎಚ್ಚರಿಕೆ: "ನಿಮ್ಮ ತಂದೆ 72 — ಫ್ಲೋಟರ್‌ಗೆ ಸೇರಿಸಿ ಅಥವಾ ವಯ ವಂದನಾ."',
        'ಜೀವನ-ಘಟನೆ ಪ್ರಚೋದಕಗಳು: ಮಗು, ರೋಗನಿರ್ಣಯ, ಉದ್ಯೋಗ ಬದಲಾವಣೆ — ಸ್ಕೋರ್ ಸ್ವಯಂ ಅಪ್‌ಡೇಟ್.',
      ],
      howItWorks: [
        { heading: 'ಪಾಲಿಸಿಗಳನ್ನು ಅಪ್ಲೋಡ್ ಮಾಡಿ', body: 'ಮ್ಯಾನುಯಲ್ ಅಥವಾ Bima Sugam API. OCR PDF + ಫೋಟೋ.' },
        { heading: 'ಸ್ಕೋರ್ ಪಡೆಯಿರಿ', body: 'ವ್ಯಕ್ತಿ, ಪಾಲಿಸಿ, ಕುಟುಂಬ ಪ್ರಕಾರ 0–100. ಯಾವ ಆಯಾಮ ಎಳೆಯುತ್ತಿದೆ.' },
        { heading: 'ಕ್ರಮ ಕೈಗೊಳ್ಳಿ', body: 'ನಿರ್ದಿಷ್ಟ ಕ್ರಿಯೆಗಳು. ಎಂದಿಗೂ sales pitch ಇಲ್ಲ.' },
      ],
      whoItsFor: [
        { title: 'ಹೊಸದಾಗಿ ಮದುವೆಯಾದ ಜೋಡಿ', body: 'ಎರಡು ಪ್ರತ್ಯೇಕ ಪಾಲಿಸಿ. ಒಂದು ಸ್ಕೋರ್ ಓವರ್‌ಲ್ಯಾಪ್ + ಅಂತರ.' },
        { title: 'ಹಿರಿಯ ಪೋಷಕರ ಕುಟುಂಬ', body: 'ಪೋಷಕರು 15 ವರ್ಷ ಹಳೆಯ ಫ್ಲೋಟರ್. ವೈದ್ಯಕೀಯ ಹಣದುಬ್ಬರ ಹಿಂದೆ ಇದೆ.' },
        { title: 'ವೃತ್ತಿ-ಬದಲಾವಣೆ', body: 'ಗುಂಪು ಪಾಲಿಸಿ ಕವರ್ ಆಗುತ್ತಿತ್ತು. ಈಗ ಸ್ವತಂತ್ರ. ವೈಯಕ್ತಿಕ ಕವರ್ ಸಾಕೇ?' },
      ],
      launchNote: 'ಮುಂದಿನ ಹಂತದಲ್ಲಿ ಲಾಂಚ್. ವೇಟ್‌ಲಿಸ್ಟ್ ಸೇರಿ.',
      faqs: [
        { q: 'Policybazaar ಗಿಂತ ಹೇಗೆ ಬೇರೆ?', a: 'Policybazaar ಮಾರಾಟ optimize ಮಾಡುತ್ತದೆ. ನಾವು ಮುಂದಿನ 3 ವರ್ಷ. ನಾವು ಮಾರಾಟ ಮಾಡುವುದಿಲ್ಲ — ತಿಳಿಸುತ್ತೇವೆ.' },
        { q: 'ಇದು ಪಾವತಿಯೇ?', a: 'ಮೂಲ ಸ್ಕೋರ್ ಉಚಿತ. ಪ್ರೀಮಿಯಂ ₹299/ವರ್ಷ. ಪಾಲಿಸಿ ಪ್ಲೇಸ್‌ಮೆಂಟ್ ಮೇಲೆ ಶುಲ್ಕ ಇಲ್ಲ.' },
      ],
    },
  },

  'family-insurance-os': {
    en: {
      problem: [
        'The average Indian middle-class family has 4–7 policies across multiple insurers, agents, banks, and employer plans.',
        'None talk to each other. The renewal calendar is mental; the nominee list is out of date.',
        'When a medical emergency happens at 2 AM, nobody can find the policy PDF in time.',
      ],
      whatYoullGet: [
        'Central dashboard: every family policy, every renewal date, every nominee, every premium amount — in one view.',
        'Renewal alerts at 60/30/7/1 day via WhatsApp + email.',
        'Nominee audit — flag outdated nominees (a leading cause of death-claim rejection).',
        'Emergency access: during a hospitalisation, any family member can pull up every policy from one URL.',
      ],
      howItWorks: [
        { heading: 'Upload your policies', body: 'Photo or PDF, one at a time or in bulk. OCR handles the rest.' },
        { heading: 'See the family map', body: 'Who is covered for what, where the holes are, what renews next.' },
        { heading: 'Stay on top of it', body: 'Proactive alerts on renewals, nominee changes, gap events. Zero effort once set up.' },
      ],
      whoItsFor: [
        { title: 'The financially-organised family', body: 'You track everything on spreadsheets. This is a better spreadsheet.' },
        { title: 'The newly-married couple', body: 'Combining two partial portfolios. See what you have, what overlaps, what\'s missing.' },
        { title: 'The NRI child', body: 'Your parents\' policies are scattered. You want visibility from abroad so you can help them navigate renewals and emergencies.' },
      ],
      launchNote: 'Launching in the next phase. Subscription-based — ₹399/year per family. Join the waitlist.',
      faqs: [
        { q: 'How is this different from a spreadsheet?', a: 'OCR reads the policy PDF and extracts all fields automatically. Alerts fire without you remembering. Emergency access works from any device. The insurer-stamp on nominee accuracy is validated automatically.' },
        { q: 'Do you store the policy documents?', a: 'Yes — encrypted at rest on Supabase India (AWS Mumbai). You can export or delete your vault at any time. DPDP Act 2023 compliant.' },
      ],
    },
    hi: {
      problem: [
        'औसत भारतीय परिवार के पास 4–7 पॉलिसियाँ विभिन्न जगह बिखरी।',
        'कोई एक-दूसरे से बात नहीं करती। रिन्यूअल कैलेंडर दिमाग में; नॉमिनी पुराने।',
        'रात 2 बजे इमरजेंसी हो तो पॉलिसी PDF नहीं मिलता।',
      ],
      whatYoullGet: [
        'एक डैशबोर्ड: हर पॉलिसी, रिन्यूअल, नॉमिनी, प्रीमियम।',
        '60/30/7/1 दिन पहले WhatsApp + ईमेल अलर्ट।',
        'नॉमिनी ऑडिट — पुराने नॉमिनी फ्लैग (दावा अस्वीकृति का प्रमुख कारण)।',
        'आपातकालीन पहुँच: अस्पताल में कोई भी सदस्य एक URL से सभी पॉलिसी देख सके।',
      ],
      howItWorks: [
        { heading: 'पॉलिसियाँ अपलोड', body: 'PDF या फोटो। OCR बाकी संभालता है।' },
        { heading: 'परिवार मैप', body: 'कौन कवर, कहाँ गैप, अगला रिन्यूअल कब।' },
        { heading: 'अद्यतन रहें', body: 'स्वचालित अलर्ट। एक बार सेट करें।' },
      ],
      whoItsFor: [
        { title: 'संगठित परिवार', body: 'आप स्प्रेडशीट पर सब रखते हैं। यह बेहतर स्प्रेडशीट।' },
        { title: 'नवविवाहित', body: 'दो पोर्टफोलियो मिलाएँ।' },
        { title: 'NRI बच्चा', body: 'माता-पिता की पॉलिसियाँ बिखरी। विदेश से दृश्यता।' },
      ],
      launchNote: 'अगले चरण में लॉन्च। ₹399/वर्ष। वेटलिस्ट में जुड़ें।',
      faqs: [
        { q: 'स्प्रेडशीट से अलग कैसे?', a: 'OCR पॉलिसी पढ़कर सब फ़ील्ड निकालता है। अलर्ट याद रखने की ज़रूरत नहीं। किसी भी डिवाइस से आपातकालीन पहुँच।' },
        { q: 'क्या आप दस्तावेज़ स्टोर करते हैं?', a: 'हाँ — भारतीय सर्वर पर एन्क्रिप्टेड। कभी भी एक्सपोर्ट/डिलीट। DPDP अनुरूप।' },
      ],
    },
    kn: {
      problem: [
        'ಸರಾಸರಿ ಭಾರತೀಯ ಕುಟುಂಬಕ್ಕೆ 4–7 ಪಾಲಿಸಿಗಳು ವಿವಿಧ ಕಡೆ.',
        'ಯಾವುದೂ ಪರಸ್ಪರ ಸಂವಹನ ಮಾಡುವುದಿಲ್ಲ. ನವೀಕರಣ ಕ್ಯಾಲೆಂಡರ್ ಮನಸ್ಸಿನಲ್ಲಿ; ನಾಮಿನಿ ಹಳೆಯದು.',
        'ರಾತ್ರಿ 2 ಗಂಟೆ ತುರ್ತು ಆದರೆ PDF ಸಿಗುವುದಿಲ್ಲ.',
      ],
      whatYoullGet: [
        'ಒಂದು ಡ್ಯಾಶ್‌ಬೋರ್ಡ್: ಪ್ರತಿ ಪಾಲಿಸಿ, ನವೀಕರಣ, ನಾಮಿನಿ, ಪ್ರೀಮಿಯಂ.',
        '60/30/7/1 ದಿನ WhatsApp + ಇಮೇಲ್ ಎಚ್ಚರಿಕೆ.',
        'ನಾಮಿನಿ ಆಡಿಟ್ — ಹಳೆಯ ನಾಮಿನಿ ಫ್ಲ್ಯಾಗ್.',
        'ತುರ್ತು ಪ್ರವೇಶ: ಯಾವುದೇ ಸದಸ್ಯ ಒಂದು URL ನಿಂದ ಎಲ್ಲಾ ಪಾಲಿಸಿ.',
      ],
      howItWorks: [
        { heading: 'ಪಾಲಿಸಿಗಳನ್ನು ಅಪ್ಲೋಡ್', body: 'PDF ಅಥವಾ ಫೋಟೋ. OCR ಉಳಿದದ್ದನ್ನು ನಿರ್ವಹಿಸುತ್ತದೆ.' },
        { heading: 'ಕುಟುಂಬ ನಕ್ಷೆ', body: 'ಯಾರು ಕವರ್, ಎಲ್ಲಿ ಅಂತರ, ಮುಂದಿನ ನವೀಕರಣ.' },
        { heading: 'ನವೀಕೃತ ಇರಿ', body: 'ಸ್ವಯಂ ಎಚ್ಚರಿಕೆ. ಒಮ್ಮೆ ಸೆಟ್ ಮಾಡಿ.' },
      ],
      whoItsFor: [
        { title: 'ಸಂಘಟಿತ ಕುಟುಂಬ', body: 'ನೀವು ಸ್ಪ್ರೆಡ್‌ಶೀಟ್‌ನಲ್ಲಿ ಇಡುತ್ತೀರಿ. ಇದು ಉತ್ತಮ ಸ್ಪ್ರೆಡ್‌ಶೀಟ್.' },
        { title: 'ಹೊಸ ಮದುವೆ', body: 'ಎರಡು ಭಾಗಶಃ ಪೋರ್ಟ್‌ಫೋಲಿಯೊ ಸೇರಿಸಿ.' },
        { title: 'NRI ಮಗ/ಮಗಳು', body: 'ಪೋಷಕರ ಪಾಲಿಸಿ ಚದುರಿದೆ. ವಿದೇಶದಿಂದ ಗೋಚರತೆ.' },
      ],
      launchNote: 'ಮುಂದಿನ ಹಂತ. ₹399/ವರ್ಷ. ವೇಟ್‌ಲಿಸ್ಟ್.',
      faqs: [
        { q: 'ಸ್ಪ್ರೆಡ್‌ಶೀಟ್‌ಗಿಂತ ಹೇಗೆ ಬೇರೆ?', a: 'OCR ಪಾಲಿಸಿ ಓದಿ ಕ್ಷೇತ್ರ ಹೊರತೆಗೆಯುತ್ತದೆ. ಎಚ್ಚರಿಕೆಗಳು ಸ್ವಯಂ. ಯಾವುದೇ ಸಾಧನದಿಂದ ತುರ್ತು ಪ್ರವೇಶ.' },
        { q: 'ದಸ್ತಾವೇಜುಗಳನ್ನು ಸಂಗ್ರಹಿಸುತ್ತೀರಾ?', a: 'ಹೌದು — ಭಾರತೀಯ ಸರ್ವರ್‌ನಲ್ಲಿ ಎನ್‌ಕ್ರಿಪ್ಟೆಡ್. ಯಾವಾಗಲೂ ರಫ್ತು/ಅಳಿಸಿ. DPDP ಅನುಸಾರ.' },
      ],
    },
  },

  'msme-navigator': {
    en: {
      problem: [
        "62 million MSMEs in India. 85% have no insurance cover per IRDAI data. Only 3% have any form of SME-specific insurance.",
        "MSMEs are too small for corporate brokers (Marsh, Aon) and too complex for comparison widgets — nobody serves the ₹1–10 crore revenue business owner.",
        "Cyber insurance growing at 28% CAGR. Digital exposure is outpacing coverage.",
      ],
      whatYoullGet: [
        'Sector-specific risk audit — textile, pharma, food processing, retail, IT services have distinct risk profiles.',
        'Prioritised coverage stack — which lines to buy in what order, estimated premium bands.',
        'Annual review retainer — trigger-based re-audits when you add machinery, employees, warehouses, or export contracts.',
        'Claim support for business events — fire documentation, liability dispute navigation, group-health-claim support.',
      ],
      howItWorks: [
        { heading: 'Take the 20-minute risk audit', body: 'Sector, revenue, headcount, assets, footprint. Structured questionnaire — expert-led, not automated.' },
        { heading: 'Get your coverage stack', body: 'Ranked list of risks + matched coverage + estimated premium ranges. We explain the reasoning.' },
        { heading: 'Renew annually', body: 'Every trigger event (new machine, new warehouse, new export contract) prompts a re-audit. One subscription covers it.' },
      ],
      whoItsFor: [
        { title: 'The 30-employee textile mill owner', body: 'You have a fire risk, an employee liability exposure, and a cyber risk on your GST filings. You don\'t know what to prioritise. We rank it for you.' },
        { title: 'The pharma distributor', body: 'Product liability is your biggest exposure, but nobody has explained what that means. We map the real risk + coverage.' },
        { title: 'The new SaaS startup', body: '10 employees, growing fast, cyber + D&O + key-man life are all in play. We help you sequence by exposure and budget.' },
      ],
      launchNote: 'Launching in the next phase. Risk audit ₹2,000–5,000 + annual review retainer ₹5,000–15,000. Join the waitlist.',
      faqs: [
        { q: 'Do you sell insurance?', a: 'No. We audit the risk, recommend the coverage stack, and refer you to the right insurer. You buy directly from the insurer; we never take a commission on a placement.' },
        { q: 'Is this worth ₹2,000?', a: 'For a 30-employee mill, the typical placement premium after an audit is ₹25–50 lakh. A 1% mis-spec on that is ₹25–50k lost. The audit pays for itself many times over.' },
      ],
    },
    hi: {
      problem: [
        'भारत में 6.2 करोड़ MSMEs। IRDAI के अनुसार 85% के पास कोई बीमा नहीं। केवल 3% के पास SME बीमा।',
        'MSMEs कॉर्पोरेट ब्रोकरों के लिए छोटे हैं, comparison widgets के लिए जटिल।',
        'साइबर बीमा 28% CAGR पर बढ़ रहा। डिजिटल एक्सपोजर कवर से तेज़ बढ़ रहा।',
      ],
      whatYoullGet: [
        'क्षेत्र-विशिष्ट जोखिम ऑडिट — कपड़ा, दवा, खाद्य, खुदरा, IT अलग प्रोफाइल।',
        'प्राथमिकता कवरेज स्टैक — कौन सी पॉलिसी, किस क्रम में, अनुमानित प्रीमियम।',
        'वार्षिक समीक्षा रिटेनर — नया मशीन/कर्मचारी/वेयरहाउस पर पुनः ऑडिट।',
        'व्यावसायिक घटनाओं के लिए दावा सहायता।',
      ],
      howItWorks: [
        { heading: '20-मिनट जोखिम ऑडिट', body: 'क्षेत्र, राजस्व, कर्मचारी, संपत्ति। विशेषज्ञ-प्रश्नावली।' },
        { heading: 'कवरेज स्टैक', body: 'रैंक किए गए जोखिम + मिलान कवरेज + प्रीमियम रेंज।' },
        { heading: 'वार्षिक नवीकरण', body: 'हर ट्रिगर पुनः ऑडिट। एक सब्सक्रिप्शन।' },
      ],
      whoItsFor: [
        { title: '30 कर्मचारी कपड़ा मिल मालिक', body: 'अग्नि, श्रम, साइबर जोखिम। प्राथमिकता नहीं पता। हम रैंक करते हैं।' },
        { title: 'दवा वितरक', body: 'प्रोडक्ट देयता सबसे बड़ा एक्सपोजर। जोखिम + कवरेज मैप।' },
        { title: 'नया SaaS स्टार्टअप', body: '10 कर्मचारी। साइबर + D&O + key-man life। क्रम हम देते हैं।' },
      ],
      launchNote: 'अगले चरण में लॉन्च। ऑडिट ₹2,000–5,000 + वार्षिक ₹5,000–15,000। वेटलिस्ट।',
      faqs: [
        { q: 'क्या आप बीमा बेचते हैं?', a: 'नहीं। जोखिम ऑडिट, कवरेज सिफारिश, सही बीमा कंपनी को रेफर। आप सीधे खरीदें, कमीशन नहीं लेते।' },
        { q: '₹2,000 की उपयोगिता?', a: '30 कर्मचारी मिल का प्रीमियम ₹25–50 लाख। 1% गलत स्पेसिफिकेशन ₹25–50k नुकसान। ऑडिट कई गुना वसूल होता है।' },
      ],
    },
    kn: {
      problem: [
        'ಭಾರತದಲ್ಲಿ 6.2 ಕೋಟಿ MSMEs. 85% ಕ್ಕೆ ವಿಮೆ ಇಲ್ಲ. ಕೇವಲ 3% ಗೆ SME ವಿಮೆ.',
        'MSMEs ಕಾರ್ಪೊರೇಟ್ ಬ್ರೋಕರ್‌ಗಳಿಗೆ ಚಿಕ್ಕ, ಹೋಲಿಕೆ widget ಗೆ ಸಂಕೀರ್ಣ.',
        'ಸೈಬರ್ ವಿಮೆ 28% CAGR. ಡಿಜಿಟಲ್ ಎಕ್ಸ್‌ಪೋಸರ್ ಕವರ್‌ಗಿಂತ ವೇಗವಾಗಿ.',
      ],
      whatYoullGet: [
        'ವಲಯ-ನಿರ್ದಿಷ್ಟ ಅಪಾಯ ಆಡಿಟ್ — ಜವಳಿ, ಫಾರ್ಮಾ, ಆಹಾರ, ಚಿಲ್ಲರೆ, IT.',
        'ಆದ್ಯತೆಯ ಕವರೇಜ್ ಸ್ಟ್ಯಾಕ್ — ಯಾವ ಪಾಲಿಸಿ, ಯಾವ ಕ್ರಮದಲ್ಲಿ, ಪ್ರೀಮಿಯಂ.',
        'ವಾರ್ಷಿಕ ವಿಮರ್ಶೆ — ಹೊಸ ಯಂತ್ರ/ಉದ್ಯೋಗಿ/ಗೋದಾಮಿನಲ್ಲಿ ಪುನಃ ಆಡಿಟ್.',
        'ವ್ಯವಹಾರ ಘಟನೆಗಳಿಗೆ ಕ್ಲೈಮ್ ಸಹಾಯ.',
      ],
      howItWorks: [
        { heading: '20-ನಿಮಿಷ ಆಡಿಟ್', body: 'ವಲಯ, ಆದಾಯ, ಸಿಬ್ಬಂದಿ, ಆಸ್ತಿ. ಪರಿಣತ-ಪ್ರಶ್ನಾವಳಿ.' },
        { heading: 'ಕವರೇಜ್ ಸ್ಟ್ಯಾಕ್', body: 'ಶ್ರೇಣಿ ಅಪಾಯ + ಕವರೇಜ್ + ಪ್ರೀಮಿಯಂ.' },
        { heading: 'ವಾರ್ಷಿಕ ನವೀಕರಣ', body: 'ಪ್ರತಿ ಪ್ರಚೋದಕದಲ್ಲಿ ಪುನಃ ಆಡಿಟ್.' },
      ],
      whoItsFor: [
        { title: '30 ಉದ್ಯೋಗಿ ಜವಳಿ ಮಾಲೀಕ', body: 'ಬೆಂಕಿ, ಕಾರ್ಮಿಕ, ಸೈಬರ್ ಅಪಾಯ. ಆದ್ಯತೆ ಗೊತ್ತಿಲ್ಲ. ನಾವು ಶ್ರೇಣೀಕರಿಸುತ್ತೇವೆ.' },
        { title: 'ಫಾರ್ಮಾ ವಿತರಕ', body: 'ಉತ್ಪನ್ನ ಹೊಣೆಗಾರಿಕೆ ದೊಡ್ಡ ಎಕ್ಸ್‌ಪೋಸರ್.' },
        { title: 'ಹೊಸ SaaS ಸ್ಟಾರ್ಟ್‌ಅಪ್', body: '10 ಉದ್ಯೋಗಿ. ಸೈಬರ್ + D&O + key-man.' },
      ],
      launchNote: 'ಮುಂದಿನ ಹಂತದಲ್ಲಿ ಲಾಂಚ್. ಆಡಿಟ್ ₹2,000–5,000 + ₹5,000–15,000 ವಾರ್ಷಿಕ.',
      faqs: [
        { q: 'ವಿಮೆ ಮಾರುವಿರಾ?', a: 'ಇಲ್ಲ. ಅಪಾಯ ಆಡಿಟ್, ಸರಿಯಾದ ಕಂಪನಿಗೆ ರೆಫರ್. ಕಮಿಷನ್ ಸ್ವೀಕರಿಸುವುದಿಲ್ಲ.' },
        { q: '₹2,000 ಉಪಯುಕ್ತವೇ?', a: '30 ಉದ್ಯೋಗಿ ಮಿಲ್ ಪ್ರೀಮಿಯಂ ₹25–50 ಲಕ್ಷ. 1% ತಪ್ಪು ₹25–50k ನಷ್ಟ.' },
      ],
    },
  },

  'vernacular-portal': {
    en: {
      problem: [
        'Only 23% of Indian adults demonstrate basic understanding of insurance products. Rural literacy drops below 15%.',
        'Policybazaar is built for digitally-fluent, English-comfortable users in the top 50 cities.',
        'The Tier 2/3 first-time buyer wants to UNDERSTAND — not compare. That\'s an education-first, human-assisted journey.',
      ],
      whatYoullGet: [
        'WhatsApp-first insurance education in Hindi, Kannada, Tamil, Telugu, Bengali — voice-supported for low-literacy users.',
        'Complex terms translated into plain-language examples: "Waiting period means if you get diabetes today, the policy won\'t pay for it for the next 3 years."',
        'One-click video call to a bilingual advisor when you\'re ready to make a decision — not a call centre.',
        'Phased buy flow: learn more → talk to advisor → decide. Not "buy now" as the CTA.',
      ],
      howItWorks: [
        { heading: 'Start on WhatsApp', body: 'Send a message. We reply in your language. Ask anything — no obligation, no sales.' },
        { heading: 'Learn at your pace', body: 'Short explainers, voice notes, example scenarios. Nothing pushy.' },
        { heading: 'Talk to an advisor when ready', body: 'Bilingual, local, trained. Not on commission. They help you decide; you transact on the insurer\'s portal.' },
      ],
      whoItsFor: [
        { title: 'The first-time health buyer in Hubli', body: 'Your brother-in-law said you should get insurance. You don\'t know where to start. We start at "what is insurance?"' },
        { title: 'The rural family', body: 'You speak Kannada, Tamil, Bengali. You need insurance in YOUR language, explained by a human when you want one.' },
        { title: 'The migrant worker', body: 'You\'re in Bengaluru but from West Bengal. PMSBY, PMJJBY, the new employment schemes — what applies to you? We explain.' },
      ],
      launchNote: 'Launching in the next phase. Advisor franchise network being recruited. Join the waitlist — especially if you\'d like to become a certified local advisor.',
      faqs: [
        { q: 'Is this free?', a: 'Education, video calls with advisors, scheme navigation — free. If you decide to buy a policy, we refer you to the insurer; we may get a small referral fee from them (not from you).' },
        { q: 'Can I get advice without being sold to?', a: 'Yes. That\'s the point. Our advisors are not on insurer commission; they\'re paid by us, based on quality not placement.' },
      ],
    },
    hi: {
      problem: [
        'केवल 23% भारतीय वयस्क बीमा की बुनियादी समझ रखते हैं। ग्रामीण साक्षरता 15% से कम।',
        'Policybazaar डिजिटल-धाराप्रवाह, अंग्रेज़ी-सहज टॉप 50 शहरों के लिए।',
        'Tier 2/3 पहली बार खरीदार समझना चाहता है — comparison नहीं।',
      ],
      whatYoullGet: [
        'WhatsApp पर हिंदी, कन्नड़, तमिल, तेलुगु, बंगाली शिक्षा — कम साक्षरता के लिए आवाज़ समर्थन।',
        'जटिल शब्दों का सरल अनुवाद: "प्रतीक्षा अवधि मतलब अगर आज मधुमेह हुआ, 3 साल तक पॉलिसी नहीं देगी।"',
        'निर्णय के समय एक-क्लिक द्विभाषी सलाहकार वीडियो कॉल — call centre नहीं।',
        'चरणबद्ध खरीद: सीखें → सलाहकार से बात → निर्णय।',
      ],
      howItWorks: [
        { heading: 'WhatsApp पर शुरू', body: 'संदेश भेजें। हम आपकी भाषा में जवाब देते हैं।' },
        { heading: 'अपनी गति से सीखें', body: 'छोटे explainers, voice notes।' },
        { heading: 'तैयार होने पर सलाहकार से बात', body: 'द्विभाषी, स्थानीय, प्रशिक्षित। कमीशन पर नहीं।' },
      ],
      whoItsFor: [
        { title: 'हुबली का पहली बार खरीदार', body: 'जीजा ने कहा बीमा लो। शुरू कहाँ करें? हम "बीमा क्या है?" से शुरू करते हैं।' },
        { title: 'ग्रामीण परिवार', body: 'आपकी भाषा में बीमा।' },
        { title: 'प्रवासी कर्मचारी', body: 'बेंगलुरु में, पश्चिम बंगाल से। कौन सी योजना लागू?' },
      ],
      launchNote: 'अगले चरण में लॉन्च। सलाहकार franchise network भर्ती। वेटलिस्ट।',
      faqs: [
        { q: 'क्या यह मुफ्त है?', a: 'शिक्षा, वीडियो कॉल, योजना navigation — मुफ्त। पॉलिसी खरीदें तो बीमा कंपनी से छोटी referral fee।' },
        { q: 'बिना बेचे सलाह मिल सकती है?', a: 'हाँ। यही बात है। सलाहकार बीमा कमीशन पर नहीं; हम उन्हें गुणवत्ता के लिए भुगतान करते हैं।' },
      ],
    },
    kn: {
      problem: [
        'ಕೇವಲ 23% ಭಾರತೀಯ ವಯಸ್ಕರಿಗೆ ವಿಮಾ ಮೂಲ ತಿಳಿವಳಿಕೆ. ಗ್ರಾಮೀಣ ಸಾಕ್ಷರತೆ 15% ಕಡಿಮೆ.',
        'Policybazaar ಟಾಪ್ 50 ನಗರಗಳ ಇಂಗ್ಲಿಷ್ ಸ್ನೇಹಿಗಳಿಗೆ.',
        'ಟೈರ್ 2/3 ಖರೀದಿದಾರ ಅರ್ಥ ಮಾಡಬೇಕು — ಹೋಲಿಕೆ ಅಲ್ಲ.',
      ],
      whatYoullGet: [
        'WhatsApp ನಲ್ಲಿ ಹಿಂದಿ, ಕನ್ನಡ, ತಮಿಳು, ತೆಲುಗು, ಬಂಗಾಳಿ ಶಿಕ್ಷಣ — ಧ್ವನಿ ಬೆಂಬಲ.',
        'ಸಂಕೀರ್ಣ ಪದಗಳ ಸರಳ ಅನುವಾದ: "ಕಾಯುವ ಅವಧಿ ಅಂದರೆ ಇಂದು ಮಧುಮೇಹ ಆದರೆ 3 ವರ್ಷ ಪಾಲಿಸಿ ಪಾವತಿಸುವುದಿಲ್ಲ."',
        'ಒಂದು-ಕ್ಲಿಕ್ ದ್ವಿಭಾಷಾ ಸಲಹೆಗಾರ ವೀಡಿಯೋ ಕಾಲ್.',
        'ಹಂತ-ಹಂತದ ಖರೀದಿ: ಕಲಿಯಿರಿ → ಸಲಹೆಗಾರರೊಂದಿಗೆ → ನಿರ್ಧಾರ.',
      ],
      howItWorks: [
        { heading: 'WhatsApp ನಲ್ಲಿ ಪ್ರಾರಂಭ', body: 'ಸಂದೇಶ ಕಳುಹಿಸಿ. ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ಉತ್ತರ.' },
        { heading: 'ನಿಮ್ಮ ವೇಗದಲ್ಲಿ ಕಲಿಯಿರಿ', body: 'ಚಿಕ್ಕ explainers, voice notes.' },
        { heading: 'ಸಿದ್ಧವಾದಾಗ ಸಲಹೆಗಾರ', body: 'ದ್ವಿಭಾಷಾ, ಸ್ಥಳೀಯ, ತರಬೇತಿ. ಕಮಿಷನ್ ಇಲ್ಲ.' },
      ],
      whoItsFor: [
        { title: 'ಹುಬ್ಬಳ್ಳಿಯ ಮೊದಲ ಖರೀದಿದಾರ', body: 'ಭಾವ ಹೇಳಿದರು ವಿಮೆ ಪಡೆಯಿರಿ. ಎಲ್ಲಿಂದ ಶುರು? "ವಿಮೆ ಎಂದರೇನು" ದಿಂದ.' },
        { title: 'ಗ್ರಾಮೀಣ ಕುಟುಂಬ', body: 'ನಿಮ್ಮ ಭಾಷೆಯಲ್ಲಿ ವಿಮೆ.' },
        { title: 'ವಲಸೆ ಕಾರ್ಮಿಕ', body: 'ಬೆಂಗಳೂರಿನಲ್ಲಿ, WB ನಿಂದ. ಯಾವ ಯೋಜನೆ ಅನ್ವಯ?' },
      ],
      launchNote: 'ಮುಂದಿನ ಹಂತದಲ್ಲಿ ಲಾಂಚ್. franchise ನೆಟ್‌ವರ್ಕ್ ನೇಮಕ. ವೇಟ್‌ಲಿಸ್ಟ್.',
      faqs: [
        { q: 'ಇದು ಉಚಿತವೇ?', a: 'ಶಿಕ್ಷಣ, ವೀಡಿಯೋ ಕಾಲ್, ಯೋಜನೆ navigation — ಉಚಿತ. ಖರೀದಿಸಿದರೆ ಕಂಪನಿಯಿಂದ ಚಿಕ್ಕ referral fee.' },
        { q: 'ಮಾರಾಟ ಇಲ್ಲದೆ ಸಲಹೆ?', a: 'ಹೌದು. ಸಲಹೆಗಾರರು ಕಮಿಷನ್ ಮೇಲೆ ಇಲ್ಲ; ಗುಣಮಟ್ಟಕ್ಕೆ ಪಾವತಿ.' },
      ],
    },
  },
};
