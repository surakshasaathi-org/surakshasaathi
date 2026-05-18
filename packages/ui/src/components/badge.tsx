import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
  {
    variants: {
      tone: {
        neutral: 'bg-ink/5 text-ink-muted',
        success: 'bg-success-subtle text-success',
        warn: 'bg-warn-subtle text-warn',
        danger: 'bg-danger-subtle text-danger',
        primary: 'bg-primary-subtle text-primary',
        accent: 'bg-accent/10 text-accent-foreground',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof badgeVariants>;

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ tone }), className)} {...props} />;
}
