import { cn } from '@/shared/utils/cn';

/** Unread messages count for navigation items; hidden at zero. */
export function UnreadBadge({ count, className }: { count: number; className?: string }) {
  if (count <= 0) return null;
  return <span className={cn('inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold leading-5 text-primary-foreground', className)}>
    {count > 99 ? '99+' : count}<span className="sr-only"> tin nhắn chưa đọc</span>
  </span>;
}
