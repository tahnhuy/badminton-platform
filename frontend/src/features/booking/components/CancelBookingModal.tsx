import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { formatCurrency } from '../utils/booking';
import type { BookingSummary } from '../types/booking';

interface CancelBookingModalProps {
  isOpen: boolean; booking: BookingSummary | null; submitting: boolean; error: string | null;
  onClose: () => void; onConfirm: () => void;
}
export function CancelBookingModal({ isOpen, booking, submitting, error, onClose, onConfirm }: CancelBookingModalProps) {
  if (!isOpen || !booking) return null;
  const isPaid = booking.status === 'CONFIRMED';
  return <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent showClose={false} className="max-h-[85svh] overflow-y-auto">
      <DialogTitle>Xác nhận hủy lịch đặt sân</DialogTitle>
      <DialogDescription className="mt-4 leading-6">Đơn <strong>{booking.bookingCode}</strong> — {booking.facility.name}, {booking.court.name}. Khung giờ sẽ được giải phóng ngay lập tức.</DialogDescription>
      <p className="my-5 rounded-lg bg-muted p-4 text-sm leading-6">{isPaid ? <>Hủy trước giờ bắt đầu được hoàn <strong>100%</strong> ({formatCurrency(booking.totalAmount)}) về phương thức thanh toán gốc.</> : <>Đơn chưa thanh toán nên không phát sinh hoàn tiền.</>}</p>
      {error && <p role="alert" className="mb-4 rounded-lg bg-danger-bg p-3 text-sm text-danger">{error}</p>}
      <div className="flex flex-wrap justify-end gap-3">
        <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>Giữ lịch</Button>
        <Button type="button" onClick={onConfirm} disabled={submitting} className="bg-danger text-primary-foreground hover:bg-danger-hover">{submitting ? 'Đang xử lý...' : 'Xác nhận hủy'}</Button>
      </div>
    </DialogContent>
  </Dialog>;
}
