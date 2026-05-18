import type { Metadata } from 'next';
import '@suraksha/ui/globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://surakshasaathi.com'),
  title: {
    default: 'Suraksha Saathi — India\'s Protection Companion',
    template: '%s · Suraksha Saathi',
  },
  description:
    'Claim rejections, mis-sold policies, missed government schemes. Suraksha Saathi is the advisory companion that helps Indian families use the insurance they already have.',
  openGraph: {
    type: 'website',
    title: 'Suraksha Saathi — India\'s Protection Companion',
    description:
      'Advisory-only platform. No broker license. No policy pushing. Helping Indian families actually use insurance.',
    siteName: 'Suraksha Saathi',
  },
  robots: { index: true, follow: true },
};

/**
 * Root layout. Next.js 15 requires `<html>` + `<body>` here. The nested
 * `[locale]/layout.tsx` can't host those tags in App Router. If we need
 * per-locale `lang`/`dir`, we set it on `<html>` via a client hook or by
 * inspecting headers in this layout.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-background text-ink antialiased">{children}</body>
    </html>
  );
}
