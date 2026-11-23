import { Swords } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';

export function StateBlock({ title, description, actionLabel, onAction }: {
  title: string; description: string; actionLabel?: string; onAction?: () => void;
}) {
  return <EmptyState icon={Swords} title={title} description={description}
    action={actionLabel && onAction ? { label: actionLabel, onClick: onAction } : undefined} />;
}
