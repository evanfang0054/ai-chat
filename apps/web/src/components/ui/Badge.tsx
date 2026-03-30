import type { HTMLAttributes } from 'react';

type BadgeVariant = 'neutral' | 'success' | 'warning';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantClassName: Record<BadgeVariant, string> = {
  neutral: 'bg-slate-800 text-slate-200',
  success: 'bg-emerald-500/20 text-emerald-200',
  warning: 'bg-amber-500/20 text-amber-200'
};

export function Badge({ className = '', variant = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${variantClassName[variant]} ${className}`.trim()}
    />
  );
}
