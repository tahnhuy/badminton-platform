import type { ComponentProps } from 'react';
import { cn } from '@/shared/utils/cn';

export function Input({ className, type, ...props }: ComponentProps<'input'>) {
  return <input data-slot="input" type={type} className={cn(
    'h-13 w-full min-w-0 rounded-xl border border-input bg-brand-soft px-3 py-2 text-base text-foreground transition-[background-color,border-color,box-shadow,transform] duration-200 placeholder:text-muted-foreground/70 hover:border-ring/40 focus-visible:border-ring focus-visible:bg-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/10 motion-safe:focus-visible:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:focus-visible:ring-destructive/25',
    className,
  )} {...props} />;
}
