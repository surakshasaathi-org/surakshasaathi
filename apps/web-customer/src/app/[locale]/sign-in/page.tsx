import { SignInCard } from '@/components/auth/sign-in-card';
import { AuthSplit } from '@/components/marketing/auth-split';

interface Props {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string; error?: string }>;
}

const COPY = {
  en: {
    eyebrow: 'Welcome back',
    heading: 'Sign in to Suraksha Saathi',
    sub: "Pick up where you left off — every analysis, every chat, every red flag still saved.",
    emailLabel: 'Email',
    emailPlaceholder: 'you@email.com',
    send: 'Email me a sign-in link',
    sending: 'Sending…',
    googleButton: 'Continue with Google',
    orDivider: 'or',
    trust:
      'No marketing emails. Delete your account any time from Settings — everything goes with it.',
    pitchEyebrow: 'Your protection, saved',
    pitchHeadline: 'Welcome back. Your family\'s policies are right where you left them.',
    pitchBody:
      'No 7-day expiry for signed-in users. Every analysis, every chat, every coverage gap flagged stays in your account forever.',
    pitchQuote: 'We recovered ₹3.2L from a mis-sold ULIP because the evidence was all still here when the Ombudsman asked.',
    pitchAttribution: '— The Gupta family, Bengaluru',
  },
  hi: {
    eyebrow: 'वापसी पर स्वागत है',
    heading: 'Suraksha Saathi में साइन इन करें',
    sub: 'वहीं से शुरू करें जहाँ आप रुके थे — सारी जाँच, सारी बातचीत, सारे रेड फ़्लैग सुरक्षित।',
    emailLabel: 'ईमेल',
    emailPlaceholder: 'aap@email.com',
    send: 'मुझे साइन-इन लिंक भेजें',
    sending: 'भेज रहे हैं…',
    googleButton: 'Google से जारी रखें',
    orDivider: 'या',
    trust: 'कोई मार्केटिंग ईमेल नहीं। सेटिंग्स से कभी भी खाता हटा सकते हैं।',
    pitchEyebrow: 'आपकी सुरक्षा, सहेजी गई',
    pitchHeadline: 'फिर से स्वागत है। आपके परिवार की पॉलिसी यहीं हैं, जहाँ आप छोड़ गए थे।',
    pitchBody: 'साइन-इन यूज़र्स के लिए 7 दिन की समाप्ति नहीं। हर जाँच, हर चैट, हर कवरेज गैप हमेशा के लिए आपके खाते में।',
    pitchQuote: 'हमने मिस-सेल ULIP से ₹3.2L वापस पाए क्योंकि लोकपाल के पूछने पर सारे सबूत यहीं थे।',
    pitchAttribution: '— गुप्ता परिवार, बेंगलुरु',
  },
  kn: {
    eyebrow: 'ಮರಳಿ ಸ್ವಾಗತ',
    heading: 'Suraksha Saathi ಗೆ ಸೈನ್ ಇನ್ ಮಾಡಿ',
    sub: 'ನೀವು ನಿಲ್ಲಿಸಿದ ಸ್ಥಳದಿಂದಲೇ ಮುಂದುವರಿಯಿರಿ.',
    emailLabel: 'ಇಮೇಲ್',
    emailPlaceholder: 'neevu@email.com',
    send: 'ನನಗೆ ಸೈನ್-ಇನ್ ಲಿಂಕ್ ಇಮೇಲ್ ಮಾಡಿ',
    sending: 'ಕಳುಹಿಸಲಾಗುತ್ತಿದೆ…',
    googleButton: 'Google ಜೊತೆ ಮುಂದುವರಿಸಿ',
    orDivider: 'ಅಥವಾ',
    trust: 'ಮಾರ್ಕೆಟಿಂಗ್ ಇಮೇಲ್ ಇಲ್ಲ. ಸೆಟ್ಟಿಂಗ್‌ಗಳಿಂದ ಯಾವಾಗಲೂ ಖಾತೆ ಅಳಿಸಬಹುದು.',
    pitchEyebrow: 'ನಿಮ್ಮ ಸುರಕ್ಷೆ, ಉಳಿಸಲಾಗಿದೆ',
    pitchHeadline: 'ಮರಳಿ ಸ್ವಾಗತ. ನಿಮ್ಮ ಕುಟುಂಬದ ಪಾಲಿಸಿಗಳು ಇಲ್ಲಿಯೇ ಇವೆ.',
    pitchBody: 'ಸೈನ್-ಇನ್ ಬಳಕೆದಾರರಿಗೆ 7-ದಿನದ ಅವಧಿ ಇಲ್ಲ. ಪ್ರತಿ ವಿಶ್ಲೇಷಣೆ, ಚಾಟ್, ಅಂತರ ಎಂದೆಂದಿಗೂ.',
    pitchQuote: 'ನಾವು ₹3.2L ವಾಪಸ್ ಪಡೆದಿದ್ದೇವೆ — ಎಲ್ಲಾ ಸಾಕ್ಷ್ಯಗಳು ಇಲ್ಲಿದ್ದವು.',
    pitchAttribution: '— ಗುಪ್ತಾ ಕುಟುಂಬ, ಬೆಂಗಳೂರು',
  },
};

export default async function SignInPage({ params, searchParams }: Props) {
  const { locale } = await params;
  const sp = await searchParams;
  const c = COPY[locale as keyof typeof COPY] ?? COPY.en;
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === 'true';

  return (
    <AuthSplit
      locale={locale}
      pitch={{
        eyebrow: c.pitchEyebrow,
        headline: c.pitchHeadline,
        body: c.pitchBody,
        quote: c.pitchQuote,
        quoteAttribution: c.pitchAttribution,
      }}
    >
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-[0.25em] text-primary">
          {c.eyebrow}
        </div>
        <h1 className="mt-3 font-display text-4xl font-semibold leading-tight tracking-tight text-ink">
          {c.heading}
        </h1>
        <p className="mt-4 text-base text-ink-muted">{c.sub}</p>
      </div>

      <SignInCard
        locale={locale}
        labels={{
          emailLabel: c.emailLabel,
          emailPlaceholder: c.emailPlaceholder,
          send: c.send,
          sending: c.sending,
          googleButton: c.googleButton,
          or: c.orDivider,
        }}
        googleEnabled={googleEnabled}
        next={sp.next ?? '/my/analyses'}
        error={sp.error ?? null}
      />

      <p className="mt-6 text-xs leading-relaxed text-ink-subtle">{c.trust}</p>
    </AuthSplit>
  );
}
