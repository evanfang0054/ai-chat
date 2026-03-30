import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const baseClassName =
  'inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--accent-focus))] focus-visible:ring-offset-2';

const variantClassName: Record<ButtonVariant, string> = {
  primary: 'bg-[rgb(var(--accent))] text-white hover:bg-[rgb(var(--accent-hover))]',
  secondary: 'bg-[rgb(var(--surface-muted))] text-[rgb(var(--foreground))] hover:bg-[rgb(var(--border-active))] border border-[rgb(var(--border))]',
  danger: 'bg-[rgb(var(--error))] text-white hover:opacity-90'
};

export function Button({ className = '', variant = 'primary', ...props }: ButtonProps) {
  const mergedClassName = `${baseClassName} ${variantClassName[variant]} ${className}`.trim();
  return <button {...props} className={mergedClassName} />;
}
