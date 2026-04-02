import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '../../lib/utils';

const badgeVariants = cva('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors', {
  variants: {
    variant: {
      neutral: 'border border-[rgb(var(--border))] bg-[rgb(var(--surface-muted))] text-[rgb(var(--foreground-secondary))]',
      success: 'border border-[rgb(var(--success)/0.2)] bg-[rgb(var(--success)/0.1)] text-[rgb(var(--success))]',
      warning: 'border border-[rgb(var(--warning)/0.2)] bg-[rgb(var(--warning)/0.1)] text-[rgb(var(--warning))]',
      error: 'border border-[rgb(var(--error)/0.2)] bg-[rgb(var(--error)/0.1)] text-[rgb(var(--error))]'
    }
  },
  defaultVariants: {
    variant: 'neutral'
  }
});

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-variant={variant ?? 'neutral'} className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { badgeVariants };
