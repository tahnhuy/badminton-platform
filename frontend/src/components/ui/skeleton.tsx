import type { ComponentProps } from 'react';
import { cn } from '@/shared/utils/cn';

/** Decorative placeholder; announce loading separately (e.g. a status message on the region). */
export function Skeleton({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="skeleton" aria-hidden="true" className={cn('rounded-md bg-muted motion-safe:animate-pulse', className)} {...props} />;
}
