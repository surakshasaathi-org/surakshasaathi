import '@suraksha/ui/globals.css';

export const metadata = {
  title: 'Partner portal · SurakshaSaathi',
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-ink antialiased">{children}</body>
    </html>
  );
}
