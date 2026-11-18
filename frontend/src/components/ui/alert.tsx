import type { ComponentProps } from 'react';
import { cn } from '@/shared/utils/cn';

export function Alert({ className, variant = 'default', role = 'alert', ...props }:
  ComponentProps<'div'> & { variant?: 'default' | 'destructive' | 'warning' }) {
  return <div data-slot="alert" role={role} className={cn(
    'rounded-lg border p-4 text-sm leading-6 outline-none focus-visible:ring-2 focus-visible:ring-ring',
    variant === 'default' && 'border-primary/20 bg-accent text-foreground',
    variant === 'destructive' && 'border-destructive/20 bg-danger-bg text-destructive',
    variant === 'warning' && 'border-caution/20 bg-caution-bg text-caution',
    className,
  )} {...props} />;
}
