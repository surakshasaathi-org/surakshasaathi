import type { Metadata } from 'next';
import '@suraksha/ui/globals.css';

export const metadata: Metadata = {
  title: 'Admin · SurakshaSaathi',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Admin runs in light mode — `class="light"` flips the design tokens via
  // the html.light overrides in @suraksha/ui/globals.css. The customer app
  // stays on dark by default. (Reverted to admin-light on 2026-05-07 at
  // user request — the dark theme made forms hard to read.)
  return (
    <html lang="en" className="light">
      <body className="min-h-screen bg-background text-ink antialiased">{children}</body>
    </html>
  );
}
