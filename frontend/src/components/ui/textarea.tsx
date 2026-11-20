import type { ComponentProps } from 'react';
import { cn } from '@/shared/utils/cn';

export function Textarea({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea data-slot="textarea" className={cn(
    'min-h-24 w-full min-w-0 resize-y rounded-lg border border-input bg-card px-3 py-2.5 text-sm leading-6 text-foreground transition-[border-color,box-shadow] duration-200 placeholder:text-muted-foreground/70 hover:border-ring/40 focus-visible:border-ring focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/10 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive',
    className,
  )} {...props} />;
}
