import type { BookingStatus, RefundStatus } from '../types/booking';

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; background: string }> = {
  PENDING_PAYMENT: { label: 'Chờ thanh toán', color: '#436600', background: 'var(--bg-tag-amber)' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'var(--color-brand)', background: 'var(--bg-tag-green)' },
  IN_PROGRESS: { label: 'Đang diễn ra', color: 'var(--color-owner-badge)', background: 'var(--bg-tag-owner)' },
  COMPLETED: { label: 'Đã hoàn thành', color: 'var(--text-secondary)', background: 'var(--bg-tag-uid)' },
  CANCELLED: { label: 'Đã hủy', color: 'var(--color-danger)', background: 'var(--bg-tag-red)' },
  EXPIRED: { label: 'Hết hạn', color: 'var(--color-danger)', background: 'var(--bg-tag-red)' },
};

const REFUND_LABELS: Partial<Record<RefundStatus, string>> = {
  PENDING: 'Đang hoàn tiền',
  REFUND_PENDING: 'Đang hoàn tiền',
  REFUNDED: 'Đã hoàn tiền',
  REFUND_FAILED: 'Hoàn tiền thất bại',
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const config = STATUS_CONFIG[status];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 700,
        color: config.color,
        backgroundColor: config.background,
        whiteSpace: 'nowrap',
      }}
    >
      {config.label}
    </span>
  );
}

export function RefundStatusBadge({ refundStatus }: { refundStatus: RefundStatus }) {
  const label = REFUND_LABELS[refundStatus];
  if (!label) return null;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '3px 10px',
        borderRadius: 9999,
        fontSize: 11,
        fontWeight: 600,
        color: 'var(--text-secondary)',
        backgroundColor: 'var(--bg-table-header)',
      }}
    >
      {label}
    </span>
  );
}
