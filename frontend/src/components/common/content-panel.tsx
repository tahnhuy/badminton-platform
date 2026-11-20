import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/shared/utils/cn';

/** Shared detail/form section. Feature data and actions stay with the caller. */
export function ContentPanel({ title, icon: Icon, children, className }: {
  title?: string; icon?: LucideIcon; children: ReactNode; className?: string;
}) {
  return <section className={cn('flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6', className)}>
    {title && <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
      {Icon && <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />}{title}
    </h2>}
    {children}
  </section>;
}

export function DetailRow({ label, value }: { label: ReactNode; value: ReactNode }) {
  return <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-1 border-b border-border py-3 text-sm last:border-b-0">
    <span className="text-muted-foreground">{label}</span><span className="min-w-0 break-words font-semibold sm:text-right">{value}</span>
  </div>;
}
