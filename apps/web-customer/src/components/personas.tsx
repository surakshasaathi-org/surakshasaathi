import { Container } from '@suraksha/ui';

interface Props {
  locale: string;
}

// Persona copy is held close to the component for now — it evolves as we learn.
// Consider moving to a `persona` catalog table once we have 3+ white-label tenants.
const COPY: Record<string, { title: string; sub: string; personas: { title: string; body: string }[] }> = {
  en: {
    title: 'Who we stand beside',
    sub: 'Different people, different situations. One companion.',
    personas: [
      { title: 'The 68-year-old in Dharwad', body: 'whose bank RM sold her an ULIP labelled "special FD". We help her surrender it with minimal loss and enrol her in PM-JAY.' },
      { title: 'The Bengaluru IT manager', body: 'whose ₹3-lakh hospital claim was rejected on a waiting-period technicality. We draft the grievance and escalate to Ombudsman.' },
      { title: 'The Tumkur small mill owner', body: 'with 30 employees, no insurance, and no idea where to start. We run a risk audit and map the coverage stack.' },
      { title: 'The Mumbai adult child', body: 'watching her parents\' renewals from across the country. We give her one dashboard — and alert her before it\'s too late.' },
    ],
  },
  hi: {
    title: 'हम किनके साथ खड़े हैं',
    sub: 'अलग-अलग लोग, अलग-अलग स्थितियाँ। एक ही साथी।',
    personas: [
      { title: 'धारवाड़ की 68 वर्षीय दादी', body: 'जिन्हें बैंक RM ने ULIP को "स्पेशल FD" कहकर बेचा। हम न्यूनतम नुकसान के साथ उसे बंद कराते हैं और PM-JAY में नामांकन कराते हैं।' },
      { title: 'बेंगलुरु का IT मैनेजर', body: 'जिनका ₹3 लाख का दावा प्रतीक्षा अवधि की टेक्निकैलिटी पर अस्वीकृत हुआ। हम शिकायत और लोकपाल तक ले जाते हैं।' },
      { title: 'तुमकुर का छोटा मिल मालिक', body: '30 कर्मचारी, कोई बीमा नहीं, कहाँ से शुरू करें पता नहीं। हम जोखिम ऑडिट करते हैं।' },
      { title: 'मुंबई की बेटी', body: 'जो माता-पिता की पॉलिसियाँ दूर से देखती है। हम एक डैशबोर्ड देते हैं।' },
    ],
  },
  kn: {
    title: 'ನಾವು ಯಾರೊಂದಿಗೆ ನಿಲ್ಲುತ್ತೇವೆ',
    sub: 'ವಿವಿಧ ವ್ಯಕ್ತಿಗಳು, ವಿವಿಧ ಪರಿಸ್ಥಿತಿಗಳು. ಒಂದೇ ಸಹಾಯಕ.',
    personas: [
      { title: 'ಧಾರವಾಡದ 68 ವರ್ಷದ ಅಜ್ಜಿ', body: 'ಬ್ಯಾಂಕ್ RM "ವಿಶೇಷ FD" ಎಂದು ULIP ಮಾರಿದವರು. ನಾವು ಕಡಿಮೆ ನಷ್ಟದಲ್ಲಿ ಸರೆಂಡರ್ ಮಾಡಿಸಿ PM-JAY ನೋಂದಾಯಿಸುತ್ತೇವೆ.' },
      { title: 'ಬೆಂಗಳೂರಿನ IT ಮ್ಯಾನೇಜರ್', body: '₹3 ಲಕ್ಷ ಕ್ಲೈಮ್ ವೈಟಿಂಗ್ ಪೀರಿಯಡ್ ತಾಂತ್ರಿಕತೆಯಿಂದ ತಿರಸ್ಕೃತ. ನಾವು ದೂರು ಸಲ್ಲಿಸಿ ಲೋಕಪಾಲದವರೆಗೆ ಒಯ್ಯುತ್ತೇವೆ.' },
      { title: 'ತುಮಕೂರಿನ ಸಣ್ಣ ಗಿರಣಿ ಮಾಲೀಕ', body: '30 ಉದ್ಯೋಗಿಗಳು, ವಿಮೆ ಇಲ್ಲ, ಎಲ್ಲಿಂದ ಶುರು? ನಾವು ಅಪಾಯ ಆಡಿಟ್ ಮಾಡುತ್ತೇವೆ.' },
      { title: 'ಮುಂಬೈಯ ಹೆಣ್ಣು ಮಗಳು', body: 'ದೂರದಿಂದ ಪೋಷಕರ ಪಾಲಿಸಿಗಳನ್ನು ನೋಡುತ್ತಾಳೆ. ನಾವು ಒಂದು ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ನೀಡುತ್ತೇವೆ.' },
    ],
  },
};

export function Personas({ locale }: Props) {
  const copy = COPY[locale] ?? COPY.en;
  return (
    <section className="py-16">
      <Container>
        <div className="max-w-prose">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {copy.title}
          </h2>
          <p className="mt-2 text-ink-muted">{copy.sub}</p>
        </div>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {copy.personas.map((p, i) => (
            <li key={i} className="rounded-lg border border-border bg-card p-5 shadow-card">
              <h3 className="text-sm font-semibold text-ink">{p.title}</h3>
              <p className="mt-2 text-sm text-ink-muted">{p.body}</p>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
