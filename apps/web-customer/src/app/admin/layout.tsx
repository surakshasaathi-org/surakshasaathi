import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Admin · SurakshaSaathi',
  robots: { index: false, follow: false },
};

// Nested layout under apps/web-customer/src/app/admin/. The customer root
// layout owns <html>/<body>; this wraps children for the admin section.
//
// Admin used to set `html.light` at root to flip @suraksha/ui design tokens.
// Single-app deploy can't do that here (Next.js only allows <html> in the
// root layout), so admin currently inherits the customer's dark theme.
// Restoring an admin-only light scope is tracked as a follow-up — likely
// via a [data-theme="light"] selector in globals.css plus a wrapper div.
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-background text-ink">{children}</div>;
}
