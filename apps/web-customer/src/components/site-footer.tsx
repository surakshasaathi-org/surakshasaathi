import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Container } from '@suraksha/ui';

export function SiteFooter() {
  const t = useTranslations('footer');
  const year = new Date().getFullYear();

  return (
    <footer className="mt-24 border-t border-border/60 bg-background/60 pb-10 pt-16">
      <Container className="grid grid-cols-2 gap-10 sm:grid-cols-4">
        <div className="col-span-2">
          <div className="flex items-center gap-2.5">
            <div className="relative size-7">
              <div className="absolute inset-0 rounded-md bg-primary opacity-90" />
              <div className="absolute inset-[2px] rounded-[6px] bg-background" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="font-display text-[10px] font-bold text-primary">SS</span>
              </div>
            </div>
            <span className="font-display text-base font-semibold tracking-tight text-ink">
              Suraksha Saathi
            </span>
          </div>
          <p className="mt-3 max-w-prose text-sm text-ink-muted">{t('tagline')}</p>
          <p className="mt-6 max-w-prose text-xs text-ink-subtle">{t('legalLine')}</p>
        </div>
        <FooterCol
          title={t('sections.product')}
          links={[
            [t('links.policyAdvisory'), '/policy-health-score'],
            [t('links.claimsRecovery'), '/claims-advocacy'],
            [t('links.govtSchemes'), '/govt-scheme-navigator'],
            [t('links.seniors'), '/senior-citizen-portal'],
            [t('links.msme'), '/msme-navigator'],
            [t('links.misSelling'), '/life-mis-selling-recovery'],
          ]}
        />
        <FooterCol
          title={t('sections.legal')}
          links={[
            [t('links.privacy'), '/legal/privacy'],
            [t('links.terms'), '/legal/terms'],
            [t('links.dpdp'), '/legal/dpdp'],
            [t('links.grievance'), '/legal/grievance-officer'],
          ]}
        />
      </Container>
      <Container>
        <p className="mt-10 text-xs text-ink-subtle">{t('copyright', { year })}</p>
      </Container>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: [string, string][] }) {
  return (
    <div>
      <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
        {title}
      </h4>
      <ul className="space-y-2 text-sm text-ink-muted">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link href={href} className="transition hover:text-ink">
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
