import type { HTMLAttributes } from 'react';

export function Card({ className = '', ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={`rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-sm ${className}`.trim()} />;
}
