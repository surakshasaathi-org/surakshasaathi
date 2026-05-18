import Link from 'next/link';
import { buttonVariants } from '@suraksha/ui';

export function HeroCta({
  locale,
  primaryLabel,
  secondaryLabel,
}: {
  locale: string;
  primaryLabel: string;
  secondaryLabel: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href={`/${locale}/claims-advocacy`}
        className={buttonVariants({ size: 'lg', variant: 'accent' })}
      >
        {primaryLabel}
      </Link>
      <Link
        href={`/${locale}/govt-scheme-navigator`}
        className={buttonVariants({ size: 'lg', variant: 'outline' })}
      >
        {secondaryLabel}
      </Link>
    </div>
  );
}
