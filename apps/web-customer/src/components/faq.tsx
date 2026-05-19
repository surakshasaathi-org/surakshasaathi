import { Container } from '@suraksha/ui';

// FAQ copy intentionally near the component — easy for the content team to edit,
// and they change more often than the build. Move to DB once we have > 10 FAQs
// and start translating full copy per locale via the content editor.

const FAQS: Record<string, { q: string; a: string }[]> = {
  en: [
    { q: 'Is this legitimate?', a: 'Yes. We operate as an information and document-preparation service — the same regulated space Insurance Samadhan has occupied for 7 years. We do not sell policies. We do not hold an IRDAI broker license. We receive no commission from insurers.' },
    { q: 'Is my data safe?', a: 'Data is stored on Indian servers (AWS Mumbai). You can download or delete your data at any time from your account settings — fulfilled within 72 hours.' },
    { q: 'Am I eligible for PM-JAY?', a: 'Since October 2024, every Indian aged 70+ is automatically eligible regardless of income. If you are younger, eligibility depends on SECC data or your state\'s expansion — check with our free tool.' },
    { q: 'Is this really free?', a: 'Government-scheme eligibility checks and basic insurance literacy are always free and anonymous. Case filing, document drafting, and recovery work are paid — priced up front.' },
    { q: 'How long does a recovery case take?', a: 'Ombudsman cases typically resolve in 3–4 months. Insurer grievance responses are mandated within 14 days; mis-selling complaints within 15 days. We track every deadline.' },
  ],
  hi: [
    { q: 'क्या यह वैध है?', a: 'हाँ। हम सूचना और दस्तावेज़-तैयारी सेवा के रूप में काम करते हैं — Insurance Samadhan जिस नियामक स्थान में 7 वर्षों से काम कर रहा है, वही। हम पॉलिसी नहीं बेचते। हमारे पास IRDAI ब्रोकर लाइसेंस नहीं है। हमें बीमा कंपनियों से कोई कमीशन नहीं मिलता।' },
    { q: 'क्या मेरा डेटा सुरक्षित है?', a: 'डेटा भारतीय सर्वर (AWS Mumbai) पर संग्रहीत है। आप अकाउंट सेटिंग से कभी भी अपना डेटा डाउनलोड या डिलीट कर सकते हैं — 72 घंटे में पूरा होता है।' },
    { q: 'क्या मैं PM-JAY के लिए पात्र हूँ?', a: 'अक्टूबर 2024 से 70+ के सभी भारतीय आय के बावजूद स्वतः पात्र हैं। यदि आप कम उम्र के हैं, तो पात्रता SECC डेटा या राज्य विस्तार पर निर्भर करती है।' },
    { q: 'क्या यह वाकई मुफ्त है?', a: 'सरकारी योजना पात्रता जाँच और बुनियादी बीमा शिक्षा हमेशा मुफ्त और गुमनाम हैं। केस फाइलिंग, दस्तावेज़ मसौदा और रिकवरी का कार्य सशुल्क है — कीमत पहले तय होती है।' },
    { q: 'रिकवरी केस में कितना समय लगता है?', a: 'लोकपाल के मामले आम तौर पर 3-4 महीने में सुलझते हैं। बीमा कंपनी की शिकायत का जवाब 14 दिन में अनिवार्य है; मिस-सेलिंग शिकायत 15 दिन में।' },
  ],
  kn: [
    { q: 'ಇದು ನಿಜವೇ?', a: 'ಹೌದು. ನಾವು ಮಾಹಿತಿ ಮತ್ತು ದಸ್ತಾವೇಜು-ತಯಾರಿ ಸೇವೆಯಾಗಿ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತೇವೆ — Insurance Samadhan 7 ವರ್ಷಗಳಿಂದ ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತಿರುವ ಅದೇ ನಿಯಂತ್ರಕ ಕ್ಷೇತ್ರ. ನಾವು ಪಾಲಿಸಿ ಮಾರುವುದಿಲ್ಲ. ನಮಗೆ IRDAI ಬ್ರೋಕರ್ ಲೈಸೆನ್ಸ್ ಇಲ್ಲ. ವಿಮಾ ಕಂಪನಿಯಿಂದ ಕಮಿಷನ್ ಸ್ವೀಕರಿಸುವುದಿಲ್ಲ.' },
    { q: 'ನನ್ನ ಡೇಟಾ ಸುರಕ್ಷಿತವೇ?', a: 'ಡೇಟಾ ಭಾರತೀಯ ಸರ್ವರ್‌ಗಳಲ್ಲಿ (AWS Mumbai) ಶೇಖರಿಸಲಾಗಿದೆ. ನೀವು ನಿಮ್ಮ ಖಾತೆಯಿಂದ ಡೇಟಾವನ್ನು ಯಾವಾಗ ಬೇಕಾದರೂ ಡೌನ್‌ಲೋಡ್ ಅಥವಾ ಅಳಿಸಬಹುದು — 72 ಗಂಟೆಗಳಲ್ಲಿ ಪೂರ್ಣ.' },
    { q: 'ನಾನು PM-JAY ಗೆ ಅರ್ಹನೇ?', a: 'ಅಕ್ಟೋಬರ್ 2024 ರಿಂದ, 70+ ಪ್ರತಿಯೊಬ್ಬ ಭಾರತೀಯ ಆದಾಯವನ್ನು ಲೆಕ್ಕಿಸದೆ ಸ್ವಯಂ-ಅರ್ಹ. ನೀವು ಕಡಿಮೆ ವಯಸ್ಸಿನವರಾಗಿದ್ದರೆ, SECC ಡೇಟಾ ಅಥವಾ ರಾಜ್ಯ ವಿಸ್ತರಣೆಯ ಮೇಲೆ ಅವಲಂಬಿತ.' },
    { q: 'ಇದು ನಿಜವಾಗಿಯೂ ಉಚಿತವೇ?', a: 'ಸರ್ಕಾರಿ ಯೋಜನೆ ಅರ್ಹತೆ ಪರಿಶೀಲನೆ ಮತ್ತು ಮೂಲ ವಿಮಾ ಸಾಕ್ಷರತೆ ಯಾವಾಗಲೂ ಉಚಿತ ಮತ್ತು ಅನಾಮಧೇಯ. ಕೇಸ್ ಫೈಲಿಂಗ್, ಡಾಕ್ಯುಮೆಂಟ್ ಡ್ರಾಫ್ಟಿಂಗ್, ಮರುಪಡೆಯಿಕೆ ಕೆಲಸ ಪಾವತಿಯ — ಬೆಲೆ ಮೊದಲೇ ನಿಗದಿ.' },
    { q: 'ಮರುಪಡೆಯಿಕೆ ಕೇಸಿಗೆ ಎಷ್ಟು ಸಮಯ?', a: 'ಲೋಕಪಾಲ ಪ್ರಕರಣಗಳು ಸಾಮಾನ್ಯವಾಗಿ 3-4 ತಿಂಗಳಲ್ಲಿ ಪರಿಹಾರವಾಗುತ್ತವೆ. ವಿಮಾ ಕಂಪನಿಯ ದೂರು ಪ್ರತಿಕ್ರಿಯೆ 14 ದಿನಗಳಲ್ಲಿ ಕಡ್ಡಾಯ; ತಪ್ಪು-ಮಾರಾಟ ದೂರು 15 ದಿನಗಳಲ್ಲಿ.' },
  ],
};

export function Faq({ locale }: { locale: string }) {
  const items = FAQS[locale] ?? FAQS.en;
  return (
    <section className="py-16">
      <Container>
        <h2 className="mb-8 max-w-prose font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
          {locale === 'hi' ? 'आपके सवाल' : locale === 'kn' ? 'ನಿಮ್ಮ ಪ್ರಶ್ನೆಗಳು' : 'Your questions'}
        </h2>
        <dl className="divide-y divide-border rounded-lg border border-border bg-card shadow-card">
          {items.map((f, i) => (
            <details key={i} className="group px-6 py-5">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-6 text-base font-medium text-ink">
                <dt>{f.q}</dt>
                <span className="mt-1 flex-none text-ink-muted group-open:rotate-45">+</span>
              </summary>
              <dd className="mt-3 max-w-prose text-sm text-ink-muted">{f.a}</dd>
            </details>
          ))}
        </dl>
      </Container>
    </section>
  );
}
