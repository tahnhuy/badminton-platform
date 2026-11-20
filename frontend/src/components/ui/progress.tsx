import type { ComponentProps } from 'react';
import { Progress as Primitive } from 'radix-ui';
import { cn } from '@/shared/utils/cn';

/** Data-driven indicator; only its geometry is inline. Colors and motion use shared tokens. */
export function Progress({ value = 0, className, ...props }: ComponentProps<typeof Primitive.Root>) {
  const indicatorStyle = { transform: `translateX(-${100 - (value ?? 0)}%)` };
  return <Primitive.Root value={value} className={cn('relative h-2 overflow-hidden rounded-full bg-muted', className)} {...props}>
    <Primitive.Indicator className="size-full bg-primary transition-transform duration-200 motion-reduce:transition-none" style={indicatorStyle} />
  </Primitive.Root>;
}
