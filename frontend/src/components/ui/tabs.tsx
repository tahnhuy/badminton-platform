import type { ComponentProps } from 'react';
import { Tabs as Primitive } from 'radix-ui';
import { cn } from '@/shared/utils/cn';

/** Radix tabs (roving focus, arrow keys, aria wiring). Pass `forceMount` on a content to keep its draft state while hidden. */
export const Tabs = Primitive.Root;

export function TabsList({ className, ...props }: ComponentProps<typeof Primitive.List>) {
  return <Primitive.List className={cn('flex gap-1 overflow-x-auto border-b border-border [scrollbar-width:none]', className)} {...props} />;
}

export function TabsTrigger({ className, ...props }: ComponentProps<typeof Primitive.Trigger>) {
  return <Primitive.Trigger className={cn(
    '-mb-px inline-flex min-h-11 shrink-0 items-center gap-2 whitespace-nowrap border-b-[3px] border-transparent px-4 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-[state=active]:border-primary data-[state=active]:text-primary',
    className,
  )} {...props} />;
}

export function TabsContent({ className, ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Content className={cn('flex min-w-0 flex-col gap-6 outline-none data-[state=inactive]:hidden', className)} {...props} />;
}
