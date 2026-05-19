import { getFamilyAsDemographics } from '@/server/family/actions';
import { AnalyseWizard } from '@/components/claims/analyse-wizard';

// Extend the function timeout for the upload Server Action invoked from this
// page. The analyse pipeline runs synchronously-after-response via after();
// without this override Vercel kills the function at the default 10s, which
// is rarely enough for an OCR + LLM pass even on small PDFs. 60s is the cap
// on Vercel Pro; Hobby ignores this and stays at 10s.
//
// Longer durations require Vercel Pro + the upgraded Fluid Compute tier.
// True multi-minute work must move to Trigger.dev (tracked follow-up).
export const maxDuration = 60;

interface Props {
  params: Promise<{ locale: string }>;
}

const COPY = {
  en: {
    dropLabel: 'Drop your policy PDF here',
    tapToUpload: 'or tap to take a photo',
    formats: 'PDF · JPG · PNG · HEIC · up to 20 MB · 100 pages',
    analyseCta: 'Analyse my policy — free',
    changeFile: 'Change file',
    selectFirst: 'Choose a file first.',
  },
  hi: {
    dropLabel: 'अपनी पॉलिसी PDF यहाँ डालें',
    tapToUpload: 'या फोटो लेने के लिए टैप करें',
    formats: 'PDF · JPG · PNG · HEIC · 20 MB तक · 100 पृष्ठ',
    analyseCta: 'मेरी पॉलिसी जाँचें — मुफ्त',
    changeFile: 'फ़ाइल बदलें',
    selectFirst: 'पहले फ़ाइल चुनें।',
  },
  kn: {
    dropLabel: 'ನಿಮ್ಮ ಪಾಲಿಸಿ PDF ಇಲ್ಲಿ ಡ್ರಾಪ್ ಮಾಡಿ',
    tapToUpload: 'ಅಥವಾ ಫೋಟೋ ತೆಗೆಯಲು ಟ್ಯಾಪ್ ಮಾಡಿ',
    formats: 'PDF · JPG · PNG · HEIC · 20 MB ವರೆಗೆ · 100 ಪುಟಗಳು',
    analyseCta: 'ನನ್ನ ಪಾಲಿಸಿ ವಿಶ್ಲೇಷಿಸಿ — ಉಚಿತ',
    changeFile: 'ಫೈಲ್ ಬದಲಾಯಿಸಿ',
    selectFirst: 'ಮೊದಲು ಫೈಲ್ ಆಯ್ಕೆಮಾಡಿ.',
  },
} as const;

/**
 * Multi-step analyse flow. Educational prefix screens (why → how → where)
 * before the upload, with a persistent "Skip explanations" button. Reuses
 * the existing UploadZone (file + family demographics) inside the wizard's
 * final step.
 */
export default async function AnalysePolicyPage({ params }: Props) {
  const { locale } = await params;
  const familyPrefill = await getFamilyAsDemographics();
  const c = COPY[locale as keyof typeof COPY] ?? COPY.en;

  return (
    <AnalyseWizard
      locale={locale}
      familyPrefill={familyPrefill}
      uploadStrings={{
        dropLabel: c.dropLabel,
        tapToUpload: c.tapToUpload,
        formats: c.formats,
        analyseCta: c.analyseCta,
        changeFile: c.changeFile,
        selectFirst: c.selectFirst,
      }}
    />
  );
}
