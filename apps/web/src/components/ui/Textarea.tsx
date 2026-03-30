import type { TextareaHTMLAttributes } from 'react';

export function Textarea({ className = '', ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={`w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm text-[rgb(var(--foreground))] outline-none ring-[rgb(var(--accent-focus))] placeholder:text-[rgb(var(--foreground-muted))] focus:border-[rgb(var(--border-active))] focus:ring-2 transition-all resize-none ${className}`.trim()}
    />
  );
}
