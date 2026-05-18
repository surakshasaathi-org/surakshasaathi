import type { Locale } from '@suraksha/types';

/**
 * Insurance-term glossary. Human-reviewed only.
 * See CLAUDE.md section 8: machine translation is NOT acceptable for insurance terminology.
 *
 * This file is the seed. The production glossary lives in the `glossary_entry` DB table
 * (when enabled) and is editable by content_editor role in the admin portal.
 *
 * Keys are English canonical terms. Use EXACT casing.
 */

export type GlossaryEntry = {
  term: string;
  category: 'health' | 'life' | 'auto' | 'scheme' | 'general' | 'claim' | 'regulatory';
  translations: Partial<Record<Locale, string>>;
  definition: Partial<Record<Locale, string>>;
};

export const GLOSSARY: GlossaryEntry[] = [
  {
    term: 'Waiting Period',
    category: 'health',
    translations: {
      en: 'Waiting Period',
      hi: 'प्रतीक्षा अवधि',
      kn: 'ಕಾಯುವ ಅವಧಿ',
    },
    definition: {
      en: 'The time between when your policy starts and when specific conditions are covered. For example, a 3-year waiting period for diabetes means the policy will not pay for diabetes treatment during the first 3 years.',
      hi: 'पॉलिसी शुरू होने और विशेष रोग कवर होने के बीच की अवधि। उदाहरण: मधुमेह पर 3 साल की प्रतीक्षा अवधि का मतलब है पहले 3 साल में मधुमेह का इलाज कवर नहीं होगा।',
      kn: 'ಪಾಲಿಸಿ ಪ್ರಾರಂಭ ಮತ್ತು ವಿಶೇಷ ರೋಗ ಕವರ್ ಆಗುವ ನಡುವಿನ ಸಮಯ. ಉದಾ: ಮಧುಮೇಹಕ್ಕೆ 3 ವರ್ಷ ಕಾಯುವ ಅವಧಿ ಎಂದರೆ ಮೊದಲ 3 ವರ್ಷ ಮಧುಮೇಹ ಚಿಕಿತ್ಸೆ ಕವರ್ ಆಗುವುದಿಲ್ಲ.',
    },
  },
  {
    term: 'Sum Assured',
    category: 'general',
    translations: { en: 'Sum Assured', hi: 'बीमा राशि', kn: 'ವಿಮಾ ಮೊತ್ತ' },
    definition: {
      en: 'The maximum amount the insurer will pay in a valid claim.',
      hi: 'वैध दावे में बीमा कंपनी द्वारा देय अधिकतम राशि।',
      kn: 'ಮಾನ್ಯ ಕ್ಲೈಮ್‌ಗೆ ವಿಮಾ ಕಂಪನಿ ನೀಡಬಹುದಾದ ಗರಿಷ್ಠ ಮೊತ್ತ.',
    },
  },
  {
    term: 'Claim Settlement Ratio',
    category: 'claim',
    translations: {
      en: 'Claim Settlement Ratio',
      hi: 'दावा निपटान अनुपात',
      kn: 'ಕ್ಲೈಮ್ ಇತ್ಯರ್ಥ ಅನುಪಾತ',
    },
    definition: {
      en: 'Percentage of claims an insurer settles out of the total claims received in a year.',
      hi: 'एक वर्ष में प्राप्त कुल दावों में से बीमा कंपनी द्वारा निपटाए गए दावों का प्रतिशत।',
      kn: 'ವರ್ಷದಲ್ಲಿ ಸ್ವೀಕೃತವಾದ ಒಟ್ಟು ಕ್ಲೈಮ್‌ಗಳಲ್ಲಿ ವಿಮಾ ಕಂಪನಿ ಇತ್ಯರ್ಥ ಪಡಿಸಿದ ಕ್ಲೈಮ್‌ಗಳ ಶೇಕಡಾವಾರು.',
    },
  },
  {
    term: 'Exclusion',
    category: 'general',
    translations: { en: 'Exclusion', hi: 'अपवर्जन', kn: 'ಹೊರಗಿಡುವಿಕೆ' },
    definition: {
      en: 'A condition or situation the policy does NOT cover. Always listed in the policy wording.',
      hi: 'पॉलिसी में जो स्थिति कवर नहीं होती। हमेशा पॉलिसी दस्तावेज़ में सूचीबद्ध होता है।',
      kn: 'ಪಾಲಿಸಿ ಕವರ್ ಮಾಡದ ಪರಿಸ್ಥಿತಿ. ಇದು ಯಾವಾಗಲೂ ಪಾಲಿಸಿ ದಸ್ತಾವೇಜಿನಲ್ಲಿ ಪಟ್ಟಿ ಮಾಡಲಾಗಿರುತ್ತದೆ.',
    },
  },
  {
    term: 'Pre-existing Condition',
    category: 'health',
    translations: {
      en: 'Pre-existing Condition',
      hi: 'पूर्व-मौजूदा स्थिति',
      kn: 'ಮುನ್ಚಿತ ಆರೋಗ್ಯ ಸ್ಥಿತಿ',
    },
    definition: {
      en: 'A medical condition you already had before the policy started. May have a longer waiting period.',
      hi: 'वह बीमारी जो पॉलिसी शुरू होने से पहले आपको थी। इसकी प्रतीक्षा अवधि लंबी हो सकती है।',
      kn: 'ಪಾಲಿಸಿ ಪ್ರಾರಂಭಕ್ಕೆ ಮೊದಲು ನಿಮಗೆ ಇದ್ದ ರೋಗ. ಇದಕ್ಕೆ ಹೆಚ್ಚು ಕಾಯುವ ಅವಧಿ ಇರಬಹುದು.',
    },
  },
  {
    term: 'Nominee',
    category: 'life',
    translations: { en: 'Nominee', hi: 'नामिती', kn: 'ನಾಮಿನಿ' },
    definition: {
      en: 'The person who will receive the policy benefit if the policyholder dies.',
      hi: 'वह व्यक्ति जिसे पॉलिसीधारक की मृत्यु पर लाभ मिलेगा।',
      kn: 'ಪಾಲಿಸಿದಾರ ಮೃತಪಟ್ಟಾಗ ಪ್ರಯೋಜನ ಪಡೆಯುವ ವ್ಯಕ್ತಿ.',
    },
  },
  {
    term: 'Premium',
    category: 'general',
    translations: { en: 'Premium', hi: 'प्रीमियम', kn: 'ಪ್ರೀಮಿಯಂ' },
    definition: {
      en: 'The amount you pay regularly to keep the policy active.',
      hi: 'पॉलिसी को सक्रिय रखने के लिए नियमित रूप से भुगतान की जाने वाली राशि।',
      kn: 'ಪಾಲಿಸಿಯನ್ನು ಸಕ್ರಿಯವಾಗಿಡಲು ನಿಯಮಿತವಾಗಿ ಪಾವತಿಸುವ ಮೊತ್ತ.',
    },
  },
  {
    term: 'Floater',
    category: 'health',
    translations: { en: 'Floater', hi: 'फ्लोटर', kn: 'ಫ್ಲೋಟರ್' },
    definition: {
      en: 'A health policy where the sum assured is shared by a family — any member can use the full amount.',
      hi: 'ऐसी स्वास्थ्य पॉलिसी जिसमें बीमा राशि परिवार द्वारा साझा की जाती है — कोई भी सदस्य पूरी राशि उपयोग कर सकता है।',
      kn: 'ಕುಟುಂಬ ಒಟ್ಟಾಗಿ ಹಂಚಿಕೊಳ್ಳುವ ಆರೋಗ್ಯ ಪಾಲಿಸಿ — ಯಾರಾದರೂ ಪೂರ್ಣ ಮೊತ್ತವನ್ನು ಬಳಸಬಹುದು.',
    },
  },
  {
    term: 'ULIP',
    category: 'life',
    translations: { en: 'ULIP', hi: 'ULIP', kn: 'ULIP' },
    definition: {
      en: 'Unit Linked Insurance Plan. A life-insurance product where your premium is partly invested in the stock market. NOT a fixed deposit.',
      hi: 'यूनिट-लिंक्ड बीमा योजना। ऐसी जीवन बीमा जहाँ प्रीमियम का कुछ हिस्सा शेयर बाज़ार में निवेश होता है। यह फिक्स्ड डिपॉज़िट नहीं है।',
      kn: 'ಯೂನಿಟ್-ಲಿಂಕ್ಡ್ ಇನ್ಶೂರೆನ್ಸ್ ಪ್ಲಾನ್. ನಿಮ್ಮ ಪ್ರೀಮಿಯಂ ಭಾಗಶಃ ಷೇರು ಮಾರುಕಟ್ಟೆಯಲ್ಲಿ ಹೂಡಿಕೆಯಾಗುವ ಜೀವ ವಿಮೆ. ಇದು FD ಅಲ್ಲ.',
    },
  },
  {
    term: 'Mis-selling',
    category: 'regulatory',
    translations: { en: 'Mis-selling', hi: 'मिस-सेलिंग', kn: 'ತಪ್ಪು ಮಾರಾಟ' },
    definition: {
      en: 'When a policy is sold by misrepresenting what it is or what it does. IRDAI and the Ombudsman can order a full refund.',
      hi: 'पॉलिसी को गलत तरीके से बेचना। IRDAI और लोकपाल पूरा रिफंड का आदेश दे सकते हैं।',
      kn: 'ಪಾಲಿಸಿಯ ಬಗ್ಗೆ ತಪ್ಪು ಮಾಹಿತಿ ನೀಡಿ ಮಾರಾಟ ಮಾಡುವುದು. IRDAI/ಲೋಕಪಾಲ ಪೂರ್ಣ ಮರುಪಾವತಿಯನ್ನು ಆದೇಶಿಸಬಹುದು.',
    },
  },
  {
    term: 'Ombudsman',
    category: 'regulatory',
    translations: { en: 'Ombudsman', hi: 'लोकपाल', kn: 'ಲೋಕಪಾಲ' },
    definition: {
      en: 'An independent authority you can complain to if your insurer rejects your claim unfairly. Free for policyholders. Settles claims up to ₹50 lakh.',
      hi: 'एक स्वतंत्र प्राधिकरण जहाँ आप अनुचित दावा अस्वीकृति के खिलाफ शिकायत कर सकते हैं। पॉलिसीधारक के लिए मुफ्त। ₹50 लाख तक के दावे।',
      kn: 'ನ್ಯಾಯಸಮ್ಮತವಲ್ಲದ ಕ್ಲೈಮ್ ತಿರಸ್ಕಾರಕ್ಕೆ ದೂರು ಸಲ್ಲಿಸಬಹುದಾದ ಸ್ವತಂತ್ರ ಪ್ರಾಧಿಕಾರ. ₹50 ಲಕ್ಷದವರೆಗಿನ ಕ್ಲೈಮ್‌ಗಳು.',
    },
  },
  {
    term: 'IRDAI',
    category: 'regulatory',
    translations: { en: 'IRDAI', hi: 'IRDAI', kn: 'IRDAI' },
    definition: {
      en: 'Insurance Regulatory and Development Authority of India — the government body that regulates all insurance companies in India.',
      hi: 'भारत में सभी बीमा कंपनियों का नियामक निकाय।',
      kn: 'ಭಾರತದಲ್ಲಿ ಎಲ್ಲಾ ವಿಮಾ ಕಂಪನಿಗಳನ್ನು ನಿಯಂತ್ರಿಸುವ ಸರ್ಕಾರಿ ಸಂಸ್ಥೆ.',
    },
  },
  {
    term: 'Grievance',
    category: 'claim',
    translations: { en: 'Grievance', hi: 'शिकायत', kn: 'ದೂರು' },
    definition: {
      en: 'A formal complaint filed with your insurer. IRDAI requires insurers to resolve grievances within 14 days.',
      hi: 'बीमा कंपनी के साथ दर्ज एक औपचारिक शिकायत। IRDAI के नियम के तहत 14 दिन में समाधान आवश्यक।',
      kn: 'ವಿಮಾ ಕಂಪನಿಯ ಜೊತೆ ಸಲ್ಲಿಸಿದ ಔಪಚಾರಿಕ ದೂರು. IRDAI 14 ದಿನದಲ್ಲಿ ಪರಿಹಾರ ಕಡ್ಡಾಯ.',
    },
  },
  {
    term: 'Repudiation',
    category: 'claim',
    translations: { en: 'Repudiation', hi: 'अस्वीकृति', kn: 'ತಿರಸ್ಕಾರ' },
    definition: {
      en: 'When the insurer refuses to pay a claim. You have the right to challenge this through grievance and Ombudsman channels.',
      hi: 'जब बीमा कंपनी दावा देने से इनकार करती है। आप शिकायत और लोकपाल के ज़रिए चुनौती दे सकते हैं।',
      kn: 'ವಿಮಾ ಕಂಪನಿ ಕ್ಲೈಮ್ ಪಾವತಿಸಲು ನಿರಾಕರಿಸಿದಾಗ. ನೀವು ದೂರು ಮತ್ತು ಲೋಕಪಾಲ ಮೂಲಕ ಪ್ರಶ್ನಿಸಬಹುದು.',
    },
  },
  {
    term: 'PM-JAY',
    category: 'scheme',
    translations: { en: 'PM-JAY', hi: 'PM-JAY', kn: 'PM-JAY' },
    definition: {
      en: 'Ayushman Bharat Pradhan Mantri Jan Arogya Yojana — India\'s flagship public health insurance scheme. ₹5 lakh cover per family per year, free for eligible families. All Indians 70+ automatically qualify since Oct 2024.',
      hi: 'आयुष्मान भारत प्रधान मंत्री जन आरोग्य योजना — भारत की प्रमुख सार्वजनिक स्वास्थ्य बीमा योजना। प्रति परिवार प्रति वर्ष ₹5 लाख कवर।',
      kn: 'ಆಯುಷ್ಮಾನ್ ಭಾರತ PM-JAY — ಭಾರತದ ಪ್ರಮುಖ ಸಾರ್ವಜನಿಕ ಆರೋಗ್ಯ ವಿಮೆ. ಪ್ರತಿ ಕುಟುಂಬಕ್ಕೆ ವರ್ಷಕ್ಕೆ ₹5 ಲಕ್ಷ.',
    },
  },
];

export function glossaryLookup(term: string, locale: Locale): string | undefined {
  const entry = GLOSSARY.find((g) => g.term.toLowerCase() === term.toLowerCase());
  return entry?.translations[locale];
}

/**
 * Missing-glossary check: given a set of terms used in a draft, return any
 * that have no human-reviewed translation in the target locale.
 */
export function findUnglossedTerms(terms: string[], locale: Locale): string[] {
  return terms.filter((t) => !glossaryLookup(t, locale));
}
