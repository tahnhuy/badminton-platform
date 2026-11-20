import { CalendarDays } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';

interface StateBlockProps { title: string; description: string; actionLabel?: string; onAction?: () => void }
export function StateBlock({ title, description, actionLabel, onAction }: StateBlockProps) {
  return <EmptyState icon={CalendarDays} title={title} description={description}
    action={actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined} />;
}
