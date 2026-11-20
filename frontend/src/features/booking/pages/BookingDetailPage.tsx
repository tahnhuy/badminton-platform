import { MatchBookingContext } from '../components/MatchBookingContext';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { bookingService } from '../services/bookingService';
import { ApiError } from '../../../shared/api/http-client';
import { useBookingDetail } from '../hooks/useBookingDetail';
import { BookingStatusBadge, RefundStatusBadge } from '../components/BookingStatusBadge';
import { BookingStatusNotice } from '../components/BookingStatusNotice';
import { CancelBookingModal } from '../components/CancelBookingModal';
import { BookingPageState as StateBlock } from '../components/BookingPageState';
import { ArrowLeft, CalendarDays, ReceiptText } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/common/page-layout';
import { ContentPanel, DetailRow as InfoRow } from '@/components/common/content-panel';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDisplayDate, formatDuration, formatTimeRange, isCancellable } from '../utils/booking';

export function BookingDetailPage() {
  const { bookingId: bookingIdParam } = useParams();
  const bookingId = Number(bookingIdParam);
  const { booking, status, error, refresh } = useBookingDetail(
    Number.isFinite(bookingId) ? bookingId : null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const handleConfirmCancel = async () => {
    setSubmitting(true);
    setCancelError(null);
    try {
      await bookingService.cancelBooking(bookingId);
      setIsModalOpen(false);
      await refresh();
    } catch (err) {
      setCancelError(err instanceof ApiError ? err.message : 'Không thể hủy đơn. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  if (status === 'loading') {
    return <StateBlock title="Đang tải..." description="Vui lòng chờ trong giây lát." />;
  }
  if (status === 'error' || !booking) {
    return (
      <StateBlock title="Không tải được đơn" description={error ?? 'Đơn không tồn tại.'} actionLabel="Thử lại" onAction={() => void refresh()} />
    );
  }

  const cancellable = isCancellable(booking.status, booking.bookingDate, booking.startTime);

  return (
    <PageContainer>
      <MatchBookingContext />
      <PageHeader title={`Đơn đặt sân #${booking.bookingCode}`} description={`Ngày tạo: ${new Date(booking.createdAt).toLocaleString('vi-VN')}`}
        actions={<Button asChild variant="outline"><Link to="/bookings"><ArrowLeft aria-hidden="true" />Quay lại lịch sử đặt sân</Link></Button>} />
      <div className="flex flex-wrap gap-2"><BookingStatusBadge status={booking.status} /><RefundStatusBadge refundStatus={booking.refundStatus} /></div>
      <BookingStatusNotice booking={booking} />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <ContentPanel title="Thông tin lịch đặt" icon={CalendarDays}>
          <div>
            <InfoRow label="Cơ sở" value={booking.facility.name} />
            <InfoRow label="Địa chỉ" value={`${booking.facility.address}, ${booking.facility.district}, ${booking.facility.city}`} />
            <InfoRow label="Sân" value={booking.court.name} />
            <InfoRow label="Ngày thi đấu" value={formatDisplayDate(booking.bookingDate)} />
            <InfoRow label="Khung giờ" value={`${formatTimeRange(booking.startTime, booking.endTime)} (${formatDuration(booking.durationMinutes)})`} />
            {booking.expiresAt && booking.status === 'PENDING_PAYMENT' && <InfoRow label="Hạn thanh toán" value={new Date(booking.expiresAt).toLocaleString('vi-VN')} />}
          </div>
        </ContentPanel>
        <ContentPanel title="Chi tiết thanh toán" icon={ReceiptText} className="border-t-4 border-t-primary shadow-panel">
          <div>{booking.pricingDetails.map(detail => <InfoRow key={`${detail.startTime}-${detail.endTime}`} label={`${formatTimeRange(detail.startTime, detail.endTime)} · ${formatCurrency(detail.price)}/giờ`} value={formatCurrency(detail.amount)} />)}</div>
          <div className="rounded-lg bg-accent p-4"><p className="text-sm text-muted-foreground">Tổng cộng</p><p className="mt-2 text-3xl font-extrabold tracking-tight text-primary">{formatCurrency(booking.totalAmount)}</p></div>
          <p className="text-xs leading-5 text-muted-foreground">{booking.payment ? `Đã thanh toán (${booking.payment.status})` : 'Chưa ghi nhận thanh toán'}</p>
        </ContentPanel>
      </div>
      {booking.status === 'CANCELLED' && (
        <ContentPanel title="Tiến trình hoàn tiền" icon={ReceiptText}>
          <ol className="grid gap-2 pl-5 text-sm">
            <li className="font-semibold text-foreground">Đã hủy booking</li>
            <li className={booking.refundStatus === 'REFUNDED' ? 'font-semibold text-foreground' : booking.refundStatus === 'REFUND_FAILED' ? 'font-semibold text-danger' : 'font-semibold text-muted-foreground'}>
              {booking.refundStatus === 'REFUNDED' ? 'Đã hoàn tiền vào ví' : booking.refundStatus === 'REFUND_FAILED' ? 'Hoàn tiền thất bại' : booking.refundStatus === 'PENDING' || booking.refundStatus === 'REFUND_PENDING' ? 'Đang hoàn tiền vào ví' : 'Không phát sinh hoàn tiền'}
            </li>
            <li className={booking.refundStatus === 'REFUNDED' ? 'text-primary' : 'text-muted-foreground'}>Hoàn tất</li>
          </ol>
          <p className="text-xs leading-5 text-muted-foreground">Trạng thái hoàn tiền lấy trực tiếp từ hệ thống thanh toán, không suy đoán.</p>
        </ContentPanel>
      )}
      {cancellable && <ContentPanel className="gap-4 bg-accent sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-6 text-muted-foreground">{booking.status === 'CONFIRMED' ? `Hủy trước giờ bắt đầu để được hoàn 100% (${formatCurrency(booking.totalAmount)}).` : 'Hủy đơn chưa thanh toán để giải phóng khung giờ ngay lập tức.'}</p>
        <Button type="button" variant="outline" onClick={() => setIsModalOpen(true)} className="border-danger/25 text-danger hover:bg-danger-bg hover:text-danger">Yêu cầu hủy đặt sân</Button>
      </ContentPanel>}
      <CancelBookingModal isOpen={isModalOpen} booking={booking} submitting={submitting} error={cancelError} onClose={() => setIsModalOpen(false)} onConfirm={handleConfirmCancel} />
    </PageContainer>
  );
}
