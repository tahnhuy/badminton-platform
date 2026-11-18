import type { ComponentProps } from 'react';
import { DropdownMenu as Primitive } from 'radix-ui';
import { cn } from '@/shared/utils/cn';

export const DropdownMenu = Primitive.Root;
export const DropdownMenuTrigger = Primitive.Trigger;

export function DropdownMenuContent({ className, sideOffset = 8, ...props }: ComponentProps<typeof Primitive.Content>) {
  return <Primitive.Portal>
    <Primitive.Content data-slot="dropdown-menu-content" sideOffset={sideOffset} className={cn(
      'z-50 min-w-56 overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-lg',
      'data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none',
      className,
    )} {...props} />
  </Primitive.Portal>;
}

export function DropdownMenuItem({ className, ...props }: ComponentProps<typeof Primitive.Item>) {
  return <Primitive.Item data-slot="dropdown-menu-item" className={cn(
    'flex min-h-11 cursor-pointer select-none items-center gap-2.5 rounded-lg px-3 text-sm outline-none transition-colors focus:bg-accent focus:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0',
    className,
  )} {...props} />;
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof Primitive.Label>) {
  return <Primitive.Label data-slot="dropdown-menu-label" className={cn('px-3 py-2 text-sm', className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof Primitive.Separator>) {
  return <Primitive.Separator data-slot="dropdown-menu-separator" className={cn('-mx-1.5 my-1.5 h-px bg-border', className)} {...props} />;
}
