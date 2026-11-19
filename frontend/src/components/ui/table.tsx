import type { ComponentProps } from 'react';
import { cn } from '@/shared/utils/cn';

/** Pure table primitives; callers own the scroll region, data, selection and pagination. */
export function Table({ className, ...props }: ComponentProps<'table'>) {
  return <table className={cn('w-full min-w-160 text-left text-sm', className)} {...props} />;
}
export function TableHead({ className, ...props }: ComponentProps<'th'>) {
  return <th className={cn('h-12 border-b border-border bg-muted/60 px-4 py-3 align-middle font-semibold text-muted-foreground', className)} {...props} />;
}
export function TableCell({ className, ...props }: ComponentProps<'td'>) {
  return <td className={cn('border-b border-border px-4 py-4 align-top leading-6 [overflow-wrap:anywhere]', className)} {...props} />;
}
