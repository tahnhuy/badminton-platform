import { CalendarDays } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Skeleton } from '@/components/ui/skeleton';

interface StateBlockProps { title: string; description: string; actionLabel?: string; onAction?: () => void }
export function StateBlock({ title, description, actionLabel, onAction }: StateBlockProps) {
  return <EmptyState icon={CalendarDays} title={title} description={description}
    action={actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined} />;
}
export function LoadingCards({ count = 3 }: { count?: number }) {
  return <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
    {Array.from({ length: count }, (_, index) => <Skeleton key={index} className="h-55 rounded-2xl border border-border" />)}
  </div>;
}
