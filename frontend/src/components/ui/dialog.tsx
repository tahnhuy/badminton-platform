import type { ComponentProps } from 'react';
import { Dialog as Primitive } from 'radix-ui';
import { X } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

export const Dialog = Primitive.Root;
export const DialogTrigger = Primitive.Trigger;

/** Radix dialog content: focus trap, Escape, scroll lock and focus return. `sheet` slides up from the bottom (mobile). */
export function DialogContent({ className, children, variant = 'center', showClose = true, closeDisabled = false, overlayClassName, ...props }:
  ComponentProps<typeof Primitive.Content> & { variant?: 'center' | 'sheet' | 'side'; showClose?: boolean; closeDisabled?: boolean; overlayClassName?: string }) {
  return <Primitive.Portal>
    <Primitive.Overlay className={cn("fixed inset-0 z-50 bg-foreground/40 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 motion-reduce:animate-none", overlayClassName)} />
    <Primitive.Content data-slot="dialog-content" className={cn(
      'fixed z-50 bg-card p-6 text-card-foreground shadow-xl outline-none motion-reduce:animate-none',
      variant === 'center' && 'left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95',
      variant === 'sheet' && 'inset-x-0 bottom-0 max-h-[85svh] overflow-y-auto rounded-t-panel pb-[max(1.5rem,env(safe-area-inset-bottom))] data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom data-[state=closed]:animate-out data-[state=closed]:slide-out-to-bottom',
      variant === 'side' && 'inset-y-0 right-0 w-full max-w-xl overflow-y-auto border-l border-border data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right',
      className,
    )} {...props}>
      {children}
      {showClose && <Primitive.Close aria-label="Đóng" disabled={closeDisabled} className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full text-muted-foreground outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50">
        <X aria-hidden="true" className="size-5" />
      </Primitive.Close>}
    </Primitive.Content>
  </Primitive.Portal>;
}

export function DialogTitle({ className, ...props }: ComponentProps<typeof Primitive.Title>) {
  return <Primitive.Title className={cn('pr-10 text-lg font-bold tracking-tight', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: ComponentProps<typeof Primitive.Description>) {
  return <Primitive.Description className={cn('mt-1 text-sm text-muted-foreground', className)} {...props} />;
}
