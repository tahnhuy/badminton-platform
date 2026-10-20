import { useBookingMatchContext } from '../hooks/useBookingMatchContext';
import { MatchBookingContext } from '../components/MatchBookingContext';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { bookingService } from '../services/bookingService';
import { ApiError } from '../../../shared/api/http-client';
import { useBookingDetail } from '../hooks/useBookingDetail';
import { CancelBookingModal } from '../components/CancelBookingModal';
import { MockPaymentModal } from '../components/MockPaymentModal';
import { StateBlock } from '../components/StateBlocks';
import { ArrowLeftIcon } from '../../../components/common/Icons';
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
        setIsPaymentModalOpen(true);
      } else if (init.redirectUrl) {
        window.location.href = init.redirectUrl;
      }
    } catch (err) {
      setPaymentError(err instanceof ApiError ? err.message : 'Không thể khởi tạo cổng thanh toán. Vui lòng thử lại.');
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
    <div style={{ width: '100%', maxWidth: 820, margin: '0 auto', padding: '32px 24px 64px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <MatchBookingContext />
      <Link to="/bookings" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--color-brand)' }}>
        <ArrowLeftIcon size={16} color="var(--color-brand)" />
        Danh sách đặt sân
      </Link>

      <section style={{ padding: 24, borderRadius: 16, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-card)', textAlign: 'center' }}>
        <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 9999, fontSize: 11, fontWeight: 700, backgroundColor: 'var(--bg-tag-amber)', color: 'var(--color-warning)' }}>
          CHỜ THANH TOÁN (PENDING PAYMENT)
        </span>
        <p style={{ marginTop: 12, fontSize: 13, color: 'var(--text-secondary)' }}>Thời gian còn lại để giữ sân</p>
        <div style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 40, letterSpacing: '-0.02em', color: expired ? 'var(--color-danger)' : 'var(--text-primary)' }}>
          {expired ? '00:00' : formatCountdown(remaining)}
        </div>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {expired
            ? 'Đã hết thời gian giữ chỗ. Đơn sẽ tự động chuyển sang EXPIRED.'
            : 'Khung giờ sẽ tự động mở lại nếu bộ đếm về 00:00.'}
        </p>
        {isStale && (
          <p style={{ fontSize: 12, color: 'var(--color-warning)' }}>
            Đang tạm mất kết nối cập nhật trạng thái — thông tin có thể chưa phải mới nhất.
          </p>
        )}

        {paymentError && !isPaymentModalOpen && (
          <div
            role="alert"
            style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 8,
              backgroundColor: 'var(--bg-tag-red)',
              color: 'var(--color-danger)',
              fontSize: 13,
            }}
          >
            {paymentError}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={handleOpenPayment}
            disabled={expired || paymentLoading}
            id="btn-open-payment"
            style={{
              padding: '11px 24px',
              borderRadius: 8,
              backgroundColor: 'var(--color-brand)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: 14,
              border: 'none',
              cursor: expired || paymentLoading ? 'not-allowed' : 'pointer',
              opacity: expired || paymentLoading ? 0.6 : 1,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            {paymentLoading ? 'Đang mở cổng...' : 'Thanh toán ngay'}
          </button>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            disabled={expired}
            id="btn-cancel-pending-booking"
            style={{
              padding: '11px 20px',
              borderRadius: 8,
              backgroundColor: 'var(--bg-tag-uid)',
              color: 'var(--text-primary)',
              fontWeight: 600,
              fontSize: 14,
              border: 'none',
              cursor: expired ? 'not-allowed' : 'pointer',
            }}
          >
            Hủy đơn đặt sân
          </button>
        </div>
      </section>

      <section style={{ padding: 20, borderRadius: 14, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-card)' }}>
        <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Chi tiết đặt chỗ #{booking.bookingCode}</h2>
        <p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{booking.facility.name} · {booking.court.name}</p>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {formatDisplayDate(booking.bookingDate)} · {formatTimeRange(booking.startTime, booking.endTime)} ({formatDuration(booking.durationMinutes)})
        </p>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border-subtle)' }}>
          <span style={{ fontWeight: 700 }}>Tổng thanh toán</span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 18 }}>{formatCurrency(booking.totalAmount)}</span>
        </div>
      </section>

      <CancelBookingModal
        isOpen={isModalOpen}
        booking={booking}
        submitting={submitting}
        error={cancelError}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmCancel}
      />

      <MockPaymentModal
        isOpen={isPaymentModalOpen}
        booking={booking}
        paymentDetails={paymentDetails}
        submitting={paymentSubmitting}
        error={paymentError}
        onClose={() => { if (!paymentSubmitting) setIsPaymentModalOpen(false); }}
        onConfirm={() => handleConfirmMockPayment(false)}
        onSimulateFail={() => handleConfirmMockPayment(true)}
      />
    </div>
  );
}
