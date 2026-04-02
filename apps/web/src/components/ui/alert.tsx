import * as React from 'react';

import { cn } from '../../lib/utils';

export const Alert = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function Alert(
  { className, ...props },
  ref
) {
  return (
    <div
      ref={ref}
      role="alert"
      className={cn('relative w-full rounded-lg border border-[rgb(var(--border))] p-4', className)}
      {...props}
    />
  );
});

export const AlertTitle = React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  function AlertTitle({ className, ...props }, ref) {
    return <h5 ref={ref} className={cn('mb-1 font-medium leading-none tracking-tight', className)} {...props} />;
  }
);

export const AlertDescription = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  function AlertDescription({ className, ...props }, ref) {
    return <div ref={ref} className={cn('text-sm text-[rgb(var(--foreground-muted))]', className)} {...props} />;
  }
);

Alert.displayName = 'Alert';
AlertTitle.displayName = 'AlertTitle';
AlertDescription.displayName = 'AlertDescription';
