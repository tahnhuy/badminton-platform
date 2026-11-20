import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  action?: { label: string; onClick: () => void };
  role?: 'status' | 'alert';
}

/** Centered message for empty, error or "nothing yet" results inside a page section. */
export function EmptyState({ icon: Icon, title, description, action, role = 'status' }: EmptyStateProps) {
  return <div role={role} className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card px-6 py-12 text-center">
    <span aria-hidden="true" className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground"><Icon className="size-6" /></span>
    <h3 className="text-lg font-bold tracking-tight">{title}</h3>
    <p className="max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
    {action && <Button type="button" variant="outline" className="mt-2 h-11" onClick={action.onClick}>{action.label}</Button>}
  </div>;
}
