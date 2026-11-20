import { useEffect, useState } from 'react';
import { cn } from '@/shared/utils/cn';
import { statusLabel } from '../utils/status';

const tones: Record<string, string> = {
  OPEN: 'bg-success-bg text-success', CONFIRMED: 'bg-success-bg text-success', COMPLETED: 'bg-success-bg text-success', ACCEPTED: 'bg-success-bg text-success',
  PENDING_COURT: 'bg-caution-bg text-caution', PENDING: 'bg-caution-bg text-caution',
  MATCHED: 'bg-info-bg text-info',
  DECLINED: 'bg-danger-bg text-danger', CANCELLED: 'bg-danger-bg text-danger',
};

export function StatusPill({ status }: { status: string }) {
  return <span className={cn('inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold', tones[status] ?? 'bg-muted text-muted-foreground')}>{statusLabel(status)}</span>;
}

export function Countdown({ expiresAt }: { expiresAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const remaining = new Date(expiresAt).getTime() - now;
  if (remaining <= 0) return <span className="font-semibold text-danger">Đã hết hạn</span>;
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);
  return <span className="font-semibold tabular-nums">Còn {minutes}:{String(seconds).padStart(2, '0')}</span>;
}
