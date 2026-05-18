import { ShieldCheck, Server, FileText, Lock } from 'lucide-react';
import { cn } from '@/lib/cn';

/**
 * Compliance footer strip. The four things Indian health-insurance buyers
 * actually care about before handing over a policy PDF:
 *   - We're NOT a broker (advisory-only)
 *   - DPDP Act 2023 compliance
 *   - Servers in India
 *   - Delete-everything escape hatch
 *
 * Deliberately plain — stating these clearly is the trust signal. Flashy
 * badge logos (which we can't license) would hurt.
 */

interface Props {
  tone?: 'light' | 'dark';
}

export function TrustStrip({ tone = 'light' }: Props) {
  const items = [
    {
      icon: FileText,
      title: 'Advisory-only',
      body: 'We never place your policy or take a broker cut. IRDAI-registered advisory model.',
    },
    {
      icon: Lock,
      title: 'DPDP Act 2023',
      body: 'Granular consent, right-to-access, right-to-erasure. Enforced in product.',
    },
    {
      icon: Server,
      title: 'Indian servers',
      body: 'Your documents never leave India. Auto-delete at 7 days unless you save.',
    },
    {
      icon: ShieldCheck,
      title: 'No insurer linkage',
      body: 'We don\'t share your policy with any insurer — ever. Not even anonymised.',
    },
  ];
  return (
    <div
      className={cn(
        'grid gap-6 sm:grid-cols-2 lg:grid-cols-4',
        tone === 'light' ? 'text-ink-muted' : 'text-white/75',
      )}
    >
      {items.map((it) => (
        <div key={it.title} className="flex items-start gap-3">
          <div
            className={cn(
              'mt-0.5 flex size-9 items-center justify-center rounded-lg',
              tone === 'light' ? 'bg-primary/10 text-primary' : 'bg-white/10 text-accent',
            )}
          >
            <it.icon className="size-4" aria-hidden />
          </div>
          <div className="min-w-0">
            <div
              className={cn(
                'text-sm font-semibold',
                tone === 'light' ? 'text-ink' : 'text-white',
              )}
            >
              {it.title}
            </div>
            <p className="mt-0.5 text-xs leading-relaxed">{it.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
