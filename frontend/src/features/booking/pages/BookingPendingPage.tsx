import { useBookingMatchContext } from '../hooks/useBookingMatchContext';
import { MatchBookingContext } from '../components/MatchBookingContext';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { bookingService } from '../services/bookingService';
import { ApiError } from '../../../shared/api/http-client';
import { useBookingDetail } from '../hooks/useBookingDetail';
import { CancelBookingModal } from '../components/CancelBookingModal';
import { MockPaymentModal } from '../components/MockPaymentModal';
import { BookingPageState as StateBlock } from '../components/BookingPageState';
import { ArrowLeft, CalendarDays, CreditCard, Hourglass } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/shared/utils/cn';
import { PageContainer, PageHeader } from '@/components/common/page-layout';
import { ContentPanel, DetailRow } from '@/components/common/content-panel';
import { Button } from '@/components/ui/button';
import { formatCurrency, formatDisplayDate, formatDuration, formatTimeRange } from '../utils/booking';

function useCountdown(expiresAt: string | null): number {
  const [remaining, setRemaining] = useState(() => remainingSeconds(expiresAt));
  useEffect(() => {
    setRemaining(remainingSeconds(expiresAt));
    const timer = window.setInterval(() => setRemaining(remainingSeconds(expiresAt)), 1000);
    return () => window.clearInterval(timer);
  }, [expiresAt]);
  return remaining;
}

function remainingSeconds(expiresAt: string | null): number {
  if (!expiresAt) return 0;
  return Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
}

function formatCountdown(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function BookingPendingPage() {
  const { forMatch } = useBookingMatchContext();
  const { bookingId: bookingIdParam } = useParams();
  const bookingId = Number(bookingIdParam);
  const navigate = useNavigate();
  const { booking, status, error, isStale, refresh } = useBookingDetail(
    Number.isFinite(bookingId) ? bookingId : null
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // Payment states
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentDetails, setPaymentDetails] = useState<{
    paymentId: number;
    amount: string;
    isMock: boolean;
  } | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const remaining = useCountdown(booking?.expiresAt ?? null);
  const expired = booking !== null && remaining <= 0;

  // When the countdown ends, re-check the authoritative status so the worker's
  // PENDING_PAYMENT -> EXPIRED transition is reflected without a manual reload.
  useEffect(() => {
    if (expired) void refresh();
  }, [expired, refresh]);

  useEffect(() => {
    if (booking && booking.status !== 'PENDING_PAYMENT') {
      navigate(forMatch(`/bookings/${booking.id}`), { replace: true });
    }
  }, [booking, navigate, forMatch]);

  const handleOpenPayment = async () => {
    setPaymentLoading(true);
    setPaymentError(null);
    try {
      const init = await bookingService.initiatePayment(bookingId);
      setPaymentDetails(init);
      if (init.isMock) {
        // Mock gateway is a development/test aid only. A production build must
        // never present it as a real payment option.
        if (!import.meta.env.DEV) {
          setPaymentError('Cổng thanh toán chưa được cấu hình. Vui lòng thử lại sau hoặc liên hệ hỗ trợ.');
          return;
        }
        setIsPaymentModalOpen(true);
      } else if (init.redirectUrl) {
        window.location.href = init.redirectUrl;
      } else {
        // Wallet payments settle synchronously: the booking is already confirmed, so
        // re-read it and let the status effect navigate to the booking detail page.
        await refresh();
      }
    } catch (err) {
      setPaymentError(err instanceof ApiError ? err.message : 'Không thể khởi tạo cổng thanh toán. Vui lòng thử lại.');
      if (err instanceof ApiError && err.code === 'WALLET_INSUFFICIENT_BALANCE') {
        setPaymentError('Số dư ví không đủ. Vui lòng nạp thêm tiền vào ví rồi thử lại.');
      }
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleConfirmMockPayment = async (simulateFailure = false) => {
    if (!paymentDetails || paymentSubmitting) return;
    setPaymentSubmitting(true);
    setPaymentError(null);
    try {
      const result = await bookingService.confirmMockPayment({
        bookingId,
        paymentId: paymentDetails.paymentId,
        simulateFailure,
      });
      if (result.success) {
        setIsPaymentModalOpen(false);
        navigate(`/bookings/${bookingId}`, { replace: true });
      } else {
        setPaymentError(result.message || 'Thanh toán thất bại.');
        if (result.paymentStatus === 'FAILED') {
          // Retrying uses a fresh pending attempt rather than replaying a failed one.
          const next = await bookingService.initiatePayment(bookingId);
          setPaymentDetails(next);
        } else if (result.bookingStatus !== 'PENDING_PAYMENT') {
          setIsPaymentModalOpen(false);
          await refresh();
        }
      }
    } catch (err) {
      setPaymentError(err instanceof ApiError ? err.message : 'Lỗi khi xác nhận thanh toán.');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleConfirmCancel = async () => {
    setSubmitting(true);
    setCancelError(null);
    try {
      await bookingService.cancelBooking(bookingId);
      setIsModalOpen(false);
      navigate(forMatch(`/bookings/${bookingId}`), { replace: true });
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
    return <StateBlock title="Không tải được đơn" description={error ?? 'Đơn không tồn tại.'} actionLabel="Thử lại" onAction={() => void refresh()} />;
  }

  return (
    <PageContainer className="max-w-5xl">
      <MatchBookingContext />
      <PageHeader title="Hoàn tất đặt sân" description={`Đơn đặt sân #${booking.bookingCode}`}
        actions={<Button asChild variant="outline"><Link to="/bookings"><ArrowLeft aria-hidden="true" />Danh sách đặt sân</Link></Button>} />
      <ContentPanel className="items-center border-t-4 border-t-caution py-8 text-center shadow-panel sm:py-10">
        <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-2xl bg-caution-bg text-caution"><Hourglass className="size-8" /></span>
        <Badge className="bg-caution-bg text-caution">CHỜ THANH TOÁN (PENDING PAYMENT)</Badge>
        <p className="text-sm text-muted-foreground">Thời gian còn lại để giữ sân</p>
        <div className={cn('text-3xl font-extrabold tracking-tight tabular-nums', expired ? 'text-danger' : 'text-foreground')}>{expired ? '00:00' : formatCountdown(remaining)}</div>
        <p className="max-w-lg text-sm leading-6 text-muted-foreground">{expired ? 'Đã hết thời gian giữ chỗ. Đơn sẽ tự động chuyển sang EXPIRED.' : 'Khung giờ sẽ tự động mở lại nếu bộ đếm về 00:00.'}</p>
        {isStale && <p role="status" className="text-sm text-caution">Đang tạm mất kết nối cập nhật trạng thái — thông tin có thể chưa phải mới nhất.</p>}
        {paymentError && !isPaymentModalOpen && <p role="alert" className="w-full rounded-lg bg-danger-bg p-4 text-sm text-danger">{paymentError}{paymentError.includes('Số dư ví') && <Link to="/wallet" className="mt-2 block font-bold">Nạp tiền vào ví</Link>}</p>}
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Button type="button" variant="brand" onClick={handleOpenPayment} disabled={expired || paymentLoading} id="btn-open-payment"><CreditCard aria-hidden="true" />{paymentLoading ? 'Đang mở cổng...' : 'Thanh toán ngay'}</Button>
          <Button type="button" variant="outline" onClick={() => setIsModalOpen(true)} disabled={expired} id="btn-cancel-pending-booking">Hủy đơn đặt sân</Button>
        </div>
      </ContentPanel>
      <ContentPanel title={`Chi tiết đặt chỗ #${booking.bookingCode}`} icon={CalendarDays}>
        <p className="text-base font-bold">{booking.facility.name} · {booking.court.name}</p>
        <p className="text-sm leading-6 text-muted-foreground">{formatDisplayDate(booking.bookingDate)} · {formatTimeRange(booking.startTime, booking.endTime)} ({formatDuration(booking.durationMinutes)})</p>
        <DetailRow label="Tổng thanh toán" value={<span className="text-2xl font-extrabold text-primary">{formatCurrency(booking.totalAmount)}</span>} />
      </ContentPanel>
      <CancelBookingModal isOpen={isModalOpen} booking={booking} submitting={submitting} error={cancelError} onClose={() => setIsModalOpen(false)} onConfirm={handleConfirmCancel} />
      <MockPaymentModal isOpen={isPaymentModalOpen} booking={booking} paymentDetails={paymentDetails} submitting={paymentSubmitting} error={paymentError}
        onClose={() => { if (!paymentSubmitting) setIsPaymentModalOpen(false); }} onConfirm={() => handleConfirmMockPayment(false)} onSimulateFail={() => handleConfirmMockPayment(true)} />
    </PageContainer>
  );
}
