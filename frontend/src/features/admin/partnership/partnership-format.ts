import type { OwnerRequestStatus } from '@/features/partnership/partnership-api';

const DATE_TIME = new Intl.DateTimeFormat('vi-VN', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
});

export const formatDateTime = (value: string | null) => value ? DATE_TIME.format(new Date(value)) : '—';

/** Badge has success / caution / neutral; a rejection reads as neutral with the red text class below. */
export const STATUS_BADGE: Record<OwnerRequestStatus, { variant: 'caution' | 'neutral' | 'success'; className?: string }> = {
  PENDING: { variant: 'caution' },
  CONTACTED: { variant: 'neutral', className: 'bg-info-bg text-info' },
  APPROVED: { variant: 'success' },
  REJECTED: { variant: 'neutral', className: 'bg-danger-bg text-danger' },
};
