import type { ComponentProps } from 'react';
import { Popover as Primitive } from 'radix-ui';
import { cn } from '@/shared/utils/cn';
export const Popover = Primitive.Root;
export const PopoverTrigger = Primitive.Trigger;
export const PopoverAnchor = Primitive.Anchor;
export const PopoverClose = Primitive.Close;
export function PopoverContent({ className, portalled = true, sideOffset = 8, ...props }: ComponentProps<typeof Primitive.Content> & { portalled?: boolean }) {
  const content = <Primitive.Content sideOffset={sideOffset} className={cn('z-1000 max-h-[60svh] w-80 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-2xl border border-border bg-popover p-4 text-popover-foreground shadow-lg outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none', className)} {...props} />;
  return portalled ? <Primitive.Portal>{content}</Primitive.Portal> : content;
}
