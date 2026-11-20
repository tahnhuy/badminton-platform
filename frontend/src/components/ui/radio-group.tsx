import type { ComponentProps } from 'react';
import { RadioGroup as Primitive } from 'radix-ui';
import { cn } from '@/shared/utils/cn';

export function RadioGroup({ className, ...props }: ComponentProps<typeof Primitive.Root>) {
  return <Primitive.Root className={cn('flex gap-1', className)} {...props} />;
}
export function RadioGroupItem({ className, ...props }: ComponentProps<typeof Primitive.Item>) {
  return <Primitive.Item className={cn('flex size-11 shrink-0 items-center justify-center rounded-lg outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50', className)} {...props} />;
}
