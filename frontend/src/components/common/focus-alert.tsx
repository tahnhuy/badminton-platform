import { useEffect, useRef } from 'react';
import { CircleAlert } from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { cn } from '@/shared/utils/cn';

/** Error banner that takes focus when a message appears, so keyboard and screen-reader users notice it. */
export function FocusAlert({ message, className }: { message: string | null; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (message) ref.current?.focus(); }, [message]);
  if (!message) return null;
  return <Alert ref={ref} tabIndex={-1} variant="destructive" className={cn('flex items-start gap-3', className)}>
    <CircleAlert aria-hidden="true" className="mt-1 size-4 shrink-0" /><span>{message}</span>
  </Alert>;
}
