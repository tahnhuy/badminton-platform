import type { ReactNode } from 'react';
import { cn } from '@/shared/utils/cn';

/**
 * Page templates (DS01): every page inside a shell uses one container width, gutter and vertical
 * rhythm, and one header style. See docs/architecture/frontend.md "Hệ thống thiết kế".
 */
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto flex w-full max-w-360 flex-col gap-6 px-4 pb-16 pt-8 sm:px-6', className)}>{children}</div>;
}

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  /** Primary page actions, aligned right on wide screens. */
  actions?: ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
    <div className="flex min-w-0 flex-col gap-1.5">
      <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{title}</h1>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
    {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
  </header>;
}
