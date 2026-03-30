import type { HTMLAttributes } from 'react';

type BadgeVariant = 'neutral' | 'success' | 'warning' | 'error';

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: BadgeVariant;
};

const variantClassName: Record<BadgeVariant, string> = {
  neutral: 'bg-[rgb(var(--surface-muted))] text-[rgb(var(--foreground-secondary))] border border-[rgb(var(--border))]',
  success: 'bg-[rgb(var(--success)/0.1)] text-[rgb(var(--success))] border border-[rgb(var(--success)/0.2)]',
  warning: 'bg-[rgb(var(--warning)/0.1)] text-[rgb(var(--warning))] border border-[rgb(var(--warning)/0.2)]',
  error: 'bg-[rgb(var(--error)/0.1)] text-[rgb(var(--error))] border border-[rgb(var(--error)/0.2)]'
};

export function Badge({ className = '', variant = 'neutral', ...props }: BadgeProps) {
  return (
    <span
      {...props}
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${variantClassName[variant]} ${className}`.trim()}
    />
  );
}
