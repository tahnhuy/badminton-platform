import { Badge } from '@/components/ui/badge';
import type { BookingStatus, RefundStatus } from '../types/booking';

const STATUS_CONFIG: Record<BookingStatus, { label: string; className: string }> = {
  PENDING_PAYMENT: { label: 'Chờ thanh toán', className: 'bg-caution-bg text-caution' },
  CONFIRMED: { label: 'Đã xác nhận', className: 'bg-success-bg text-success' },
  IN_PROGRESS: { label: 'Đang diễn ra', className: 'bg-info-bg text-info' },
  COMPLETED: { label: 'Đã hoàn thành', className: 'bg-muted text-muted-foreground' },
  CANCELLED: { label: 'Đã hủy', className: 'bg-danger-bg text-danger' },
  EXPIRED: { label: 'Hết hạn', className: 'bg-danger-bg text-danger' },
};
const REFUND_LABELS: Partial<Record<RefundStatus, string>> = {
  PENDING: 'Đang hoàn tiền', REFUND_PENDING: 'Đang hoàn tiền', REFUNDED: 'Đã hoàn tiền', REFUND_FAILED: 'Hoàn tiền thất bại',
};
export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  const config = STATUS_CONFIG[status];
  return <Badge className={config.className}>{config.label}</Badge>;
}
export function RefundStatusBadge({ refundStatus }: { refundStatus: RefundStatus }) {
  const label = REFUND_LABELS[refundStatus];
  if (!label) return null;
  return <Badge>{label}</Badge>;
}
