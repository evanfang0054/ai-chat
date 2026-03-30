import type { ButtonHTMLAttributes } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'danger';

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const baseClassName =
  'inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60';

const variantClassName: Record<ButtonVariant, string> = {
  primary: 'bg-cyan-500 text-slate-950 hover:bg-cyan-400',
  secondary: 'bg-slate-800 text-slate-100 hover:bg-slate-700',
  danger: 'bg-rose-500 text-white hover:bg-rose-400'
};

export function Button({ className = '', variant = 'primary', ...props }: ButtonProps) {
  const mergedClassName = `${baseClassName} ${variantClassName[variant]} ${className}`.trim();
  return <button {...props} className={mergedClassName} />;
}
