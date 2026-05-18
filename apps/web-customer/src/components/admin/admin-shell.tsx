import Link from 'next/link';
import {
  BarChart3,
  Briefcase,
  ClipboardList,
  Cog,
  FileCheck2,
  FlaskConical,
  Flag,
  FolderTree,
  Heart,
  Landmark,
  Languages,
  Lock,
  ShieldCheck,
  Stethoscope,
  TreePine,
  Users,
  UserRound,
  Wand2,
} from 'lucide-react';
import { Container } from '@suraksha/ui';
import { listProductModules } from '@/server/admin/products/queries';

/**
 * Two-section sidebar:
 *
 *   PLATFORM  — cross-cutting ops surfaces (overview, global agents registry,
 *               global evals, users, flags, DPDP, audit, settings). These are
 *               about the system, not any one product.
 *
 *   PRODUCTS  — one link per product_module. Clicking lands on a hub that
 *               scopes agents/cases/evals/analyses to that product only.
 *               Agents + Evals appear at BOTH levels on purpose: platform for
 *               registry tasks, per-product for debugging tasks.
 */

interface PlatformItem {
  label: string;
  href: string;
  icon: React.ElementType;
  roles: string[];
}

const PLATFORM: PlatformItem[] = [
  { label: 'Overview', href: '/', icon: BarChart3, roles: ['super_admin', 'admin', 'viewer'] },
  { label: 'Agents', href: '/agents', icon: Wand2, roles: ['super_admin', 'content_editor'] },
  {
    label: 'Evals',
    href: '/evals',
    icon: FlaskConical,
    roles: ['super_admin', 'admin', 'content_editor', 'viewer'],
  },
  {
    label: 'Reviews',
    href: '/reviews',
    icon: FileCheck2,
    roles: ['super_admin', 'admin', 'case_manager', 'reviewer'],
  },
  { label: 'Users & roles', href: '/users', icon: Users, roles: ['super_admin', 'admin'] },
  { label: 'Feature flags', href: '/flags', icon: Flag, roles: ['super_admin', 'admin'] },
  { label: 'DPDP requests', href: '/dpdp', icon: Lock, roles: ['super_admin', 'admin'] },
  { label: 'Audit log', href: '/audit', icon: ShieldCheck, roles: ['super_admin'] },
  { label: 'Settings', href: '/settings', icon: Cog, roles: ['super_admin', 'admin'] },
];

const PRODUCT_ICONS: Record<string, React.ElementType> = {
  'claims-advocacy': Briefcase,
  'policy-health-score': Heart,
  'govt-scheme-navigator': Landmark,
  'family-insurance-os': Users,
  'vernacular-portal': Languages,
  'msme-navigator': ClipboardList,
  'senior-citizen-portal': UserRound,
  'life-mis-selling-recovery': Stethoscope,
};

export async function AdminShell({
  role,
  email,
  children,
}: {
  role: string;
  email: string | null;
  children: React.ReactNode;
}) {
  const modules = await listProductModules();
  const visiblePlatform = PLATFORM.filter((n) => n.roles.includes(role));

  return (
    <div className="grid min-h-screen grid-cols-[240px_1fr] bg-background">
      <aside className="flex flex-col border-r border-border bg-card">
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <div className="size-7 rounded-md bg-primary" aria-hidden />
          <div className="leading-tight">
            <div className="text-sm font-semibold">SurakshaSaathi</div>
            <div className="text-xs text-ink-subtle">Admin console</div>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto p-3">
          <NavSection label="Platform">
            {visiblePlatform.map((n) => (
              <NavLink key={n.href} href={n.href} icon={n.icon} label={n.label} />
            ))}
          </NavSection>

          <NavSection label="Products">
            <NavLink href="/admin/products" icon={FolderTree} label="All products" />
            {modules.map((m) => {
              const Icon = PRODUCT_ICONS[m.id] ?? TreePine;
              return (
                <NavLink
                  key={m.id}
                  href={`/products/${m.id}`}
                  icon={Icon}
                  label={m.name}
                  badge={m.status === 'beta' ? 'beta' : m.status === 'skeleton' ? 'wip' : undefined}
                />
              );
            })}
          </NavSection>
        </nav>

        <div className="border-t border-border p-4 text-xs text-ink-subtle">
          <div>Signed in as</div>
          <div className="truncate text-ink">{email ?? '—'}</div>
          <div className="mt-1 uppercase tracking-wide">{role}</div>
        </div>
      </aside>
      <section className="overflow-x-hidden">
        <Container className="py-8">{children}</Container>
      </section>
    </div>
  );
}

function NavSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="px-3 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-widest text-ink-subtle">
        {label}
      </div>
      <div className="flex flex-col gap-0.5">{children}</div>
    </div>
  );
}

function NavLink({
  href,
  icon: Icon,
  label,
  badge,
}: {
  href: string;
  icon: React.ElementType;
  label: string;
  badge?: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-ink-muted transition hover:bg-primary-subtle hover:text-ink"
    >
      <Icon className="size-4 shrink-0" />
      <span className="flex-1 truncate">{label}</span>
      {badge && (
        <span className="rounded-full bg-background px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-ink-subtle">
          {badge}
        </span>
      )}
    </Link>
  );
}
