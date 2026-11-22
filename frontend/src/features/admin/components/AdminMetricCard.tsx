import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { ContentPanel } from '@/components/common/content-panel';
export function AdminMetricCard({ label, value, description, icon: Icon, detail }: { label: string; value: ReactNode; description: string; icon: LucideIcon; detail?: ReactNode }) {
  return <ContentPanel className="relative overflow-hidden">
    <div className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-accent/60" aria-hidden="true" />
    <div className="relative flex items-start justify-between gap-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
      <Icon aria-hidden="true" className="size-5 shrink-0 text-primary" />
    </div>
    <div className="flex flex-wrap items-baseline gap-2">
      <strong className="text-3xl font-extrabold tracking-tight">{value}</strong>{detail && <span className="text-xs font-semibold text-muted-foreground">{detail}</span>}</div>
    <p className="text-sm text-muted-foreground">{description}</p>
  </ContentPanel>;
}
