import { useTranslations } from 'next-intl';
import { Container } from '@suraksha/ui';

export function PricingClarity() {
  const t = useTranslations('pricing');
  const tiers = [
    { key: 'anonymousFree', tone: 'success' },
    { key: 'freemium', tone: 'primary' },
    { key: 'subscription', tone: 'primary' },
    { key: 'successFee', tone: 'accent' },
  ] as const;

  return (
    <section className="bg-primary-subtle py-16">
      <Container>
        <div className="max-w-prose">
          <h2 className="font-display text-2xl font-semibold tracking-tight text-ink sm:text-3xl">
            {t('title')}
          </h2>
          <p className="mt-2 text-ink-muted">{t('subtitle')}</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map(({ key }) => {
            const items = (t.raw(`tiers.${key}.items`) as string[]) ?? [];
            return (
              <div key={key} className="rounded-lg border border-border bg-card p-5 shadow-card">
                <h3 className="font-display text-base font-semibold text-ink">
                  {t(`tiers.${key}.title`)}
                </h3>
                <ul className="mt-3 space-y-2 text-sm text-ink-muted">
                  {items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
        <p className="mt-8 max-w-prose text-xs text-ink-subtle">{t('legal')}</p>
      </Container>
    </section>
  );
}
