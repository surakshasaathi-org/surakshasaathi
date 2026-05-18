'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  ShieldCheck,
  FileSearch,
  FolderOpen,
  Briefcase,
  Landmark,
  Activity,
  Settings,
  Menu,
  X,
} from 'lucide-react';
import { cn } from '@/lib/cn';

interface Props {
  locale: string;
}

/**
 * Sidebar nav for the /my/* account shell. Sections:
 *   - Dashboard  — placeholder in W1, fills in W2 (Policy Health Score etc.)
 *   - Family     — persistent family graph (W1.3)
 *   - Policies   — canonical owned policies (W1.4)
 *   - Analyses   — existing page, enhanced in W1.5
 *   - Settings   — profile/consent/delete (W1.6)
 *
 * Mobile (< md): collapses to a full-bleed sheet opened from a hamburger in
 * the page header. Desktop: sticky rail on the left.
 */
export function SidebarNav({ locale }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const items: Array<{ slug: string; label: string; icon: typeof LayoutDashboard; eta?: string }> = [
    { slug: '', label: 'Dashboard', icon: LayoutDashboard },
    { slug: 'family', label: 'Family', icon: Users },
    { slug: 'policies', label: 'Policies', icon: ShieldCheck },
    { slug: 'analyses', label: 'Analyses', icon: FileSearch },
    { slug: 'claims', label: 'Claims', icon: Briefcase },
    { slug: 'schemes', label: 'Schemes', icon: Landmark },
    { slug: 'documents', label: 'Documents', icon: FolderOpen },
    { slug: 'activity', label: 'Activity', icon: Activity },
    { slug: 'settings', label: 'Settings', icon: Settings },
  ];

  const hrefFor = (slug: string) => (slug ? `/${locale}/my/${slug}` : `/${locale}/my`);
  const isActive = (slug: string) => {
    const href = hrefFor(slug);
    if (slug === '') return pathname === href;
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <>
      {/* Mobile trigger */}
      <div className="mb-4 flex items-center justify-between md:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-sm font-medium text-ink hover:bg-primary-subtle/50"
        >
          <Menu className="size-4" />
          Menu
        </button>
      </div>

      {mobileOpen && (
        <div
          className="fixed inset-0 z-50 flex md:hidden"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileOpen(false);
          }}
        >
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-sm" />
          <nav className="relative ml-0 flex h-full w-72 flex-col bg-background p-4 shadow-floating">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-display text-sm font-semibold uppercase tracking-wider text-ink-muted">
                My Account
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close menu"
                className="rounded-md p-1 text-ink-muted hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>
            <NavList
              items={items}
              hrefFor={hrefFor}
              isActive={isActive}
              onNavigate={() => setMobileOpen(false)}
            />
          </nav>
        </div>
      )}

      {/* Desktop rail */}
      <nav className="hidden w-60 shrink-0 md:block">
        <div className="sticky top-20">
          <div className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            My Account
          </div>
          <NavList items={items} hrefFor={hrefFor} isActive={isActive} />
        </div>
      </nav>
    </>
  );
}

function NavList({
  items,
  hrefFor,
  isActive,
  onNavigate,
}: {
  items: Array<{ slug: string; label: string; icon: typeof LayoutDashboard; eta?: string }>;
  hrefFor: (slug: string) => string;
  isActive: (slug: string) => boolean;
  onNavigate?: () => void;
}) {
  return (
    <ul className="space-y-1">
      {items.map((item) => {
        const active = isActive(item.slug);
        const Icon = item.icon;
        return (
          <li key={item.slug || 'dashboard'}>
            <Link
              href={hrefFor(item.slug)}
              onClick={onNavigate}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition',
                active
                  ? 'bg-primary/10 font-medium text-primary'
                  : 'text-ink-muted hover:bg-background hover:text-ink',
              )}
            >
              <Icon className="size-4" />
              <span className="flex-1">{item.label}</span>
              {item.eta && (
                <span className="rounded-full bg-background px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-ink-subtle">
                  {item.eta}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
