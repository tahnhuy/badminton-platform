import type { ComponentProps } from 'react';
import { cn } from '@/shared/utils/cn';

/** Native selection semantics; features keep parsing, options and defaults. */
export function NativeSelect({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn('h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none transition-colors hover:border-ring/40 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/10 disabled:cursor-not-allowed disabled:opacity-50', className)} {...props} />;
}
