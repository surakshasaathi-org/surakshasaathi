import Link from 'next/link';
import { Inbox, Users, BookOpen, Cog, Sparkles } from 'lucide-react';

const NAV = [
  { label: 'Inbox', href: '/', icon: Inbox },
  { label: 'Customers', href: '/customers', icon: Users },
  { label: 'Macros', href: '/macros', icon: BookOpen },
  { label: 'Co-pilot settings', href: '/copilot', icon: Sparkles },
  { label: 'Settings', href: '/settings', icon: Cog },
];

export function SupportShell({ children, email }: { children: React.ReactNode; email: string | null }) {
  return (
    <div className="grid min-h-screen grid-cols-[220px_1fr] bg-background">
      <aside className="border-r border-border bg-card">
        <div className="flex h-14 items-center gap-2 border-b border-border px-5">
          <div className="size-6 rounded-md bg-primary" aria-hidden />
          <div className="text-sm font-semibold">Support console</div>
        </div>
        <nav className="flex flex-col gap-0.5 p-3">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-muted hover:bg-primary-subtle hover:text-ink"
            >
              <n.icon className="size-4" />
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-border p-4 text-xs text-ink-subtle">
          <div>Signed in as</div>
          <div className="truncate text-ink">{email ?? '—'}</div>
        </div>
      </aside>
      <section>{children}</section>
    </div>
  );
}
