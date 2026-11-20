import type { ComponentProps } from 'react';
import { ToggleGroup as Primitive } from 'radix-ui';
import { cn } from '@/shared/utils/cn';
export function ToggleGroup({ className, ...props }: ComponentProps<typeof Primitive.Root>) {
  return <Primitive.Root className={cn('flex flex-wrap gap-1 rounded-lg bg-muted p-1', className)} {...props} />;
}
export function ToggleGroupItem({ className, ...props }: ComponentProps<typeof Primitive.Item>) {
  return <Primitive.Item className={cn('flex min-h-11 flex-1 items-center justify-center gap-2 rounded-md px-3 text-sm font-semibold text-muted-foreground outline-none transition-colors hover:bg-card/60 focus-visible:ring-2 focus-visible:ring-ring data-[state=on]:bg-card data-[state=on]:text-primary data-[state=on]:shadow-sm', className)} {...props} />;
}
