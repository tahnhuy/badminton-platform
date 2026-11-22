import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DetailRow } from '@/components/common/content-panel';
import { formatCurrency, formatDisplayDate, formatTimeRange } from '../utils/booking';
import type { BookingSummary } from '../types/booking';

interface MockPaymentModalProps {
  isOpen: boolean; booking: BookingSummary | null;
  paymentDetails: { paymentId: number; amount: string; isMock: boolean } | null;
  submitting: boolean; error: string | null; onClose: () => void; onConfirm: () => void; onSimulateFail?: () => void;
}
export function MockPaymentModal({ isOpen, booking, paymentDetails, submitting, error, onClose, onConfirm, onSimulateFail }: MockPaymentModalProps) {
  if (!isOpen || !booking) return null;
  const payableAmount = paymentDetails?.amount ? Number(paymentDetails.amount) : booking.totalAmount;
  return <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent showClose={false} className="max-h-[85svh] overflow-y-auto">
      <Badge variant="success" className="mb-4">MOCK GATEWAY</Badge>
      <DialogTitle>Cổng thanh toán mô phỏng</DialogTitle>
      <DialogDescription className="mt-4 leading-6">Hệ thống đang chạy chế độ thanh toán giả lập dành cho phát triển và kiểm thử. Bạn có thể mô phỏng xác nhận thanh toán thành công ngay lập tức để xác nhận lịch đặt sân.</DialogDescription>
      <div className="my-5 rounded-lg bg-muted p-4">
        <DetailRow label="Mã đặt sân:" value={booking.bookingCode} />
        <DetailRow label="Sân đấu:" value={`${booking.facility.name} · ${booking.court.name}`} />
        <DetailRow label="Thời gian:" value={`${formatDisplayDate(booking.bookingDate)} · ${formatTimeRange(booking.startTime, booking.endTime)}`} />
        <DetailRow label="Số tiền thanh toán:" value={formatCurrency(payableAmount)} />
      </div>
      {error && <p role="alert" className="mb-4 rounded-lg bg-danger-bg p-3 text-sm text-danger">{error}</p>}
      <div className="flex flex-col gap-3">
        <Button type="button" variant="brand" onClick={onConfirm} disabled={submitting} className="h-auto min-h-12 whitespace-normal py-3">{submitting ? 'Đang xử lý thanh toán...' : 'Xác nhận thanh toán thành công'}</Button>
        {onSimulateFail && <Button type="button" variant="outline" onClick={onSimulateFail} disabled={submitting} className="h-auto min-h-12 whitespace-normal py-3 text-danger">Mô phỏng thanh toán thất bại</Button>}
        <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>Đóng</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
