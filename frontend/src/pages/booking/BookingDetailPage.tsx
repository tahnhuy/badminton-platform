import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { bookingService } from '../../services/bookingService';
import { ApiError } from '../../shared/api/http-client';
import { BookingStatusBadge, RefundStatusBadge } from '../../components/booking/BookingStatusBadge';
import { CancelBookingModal } from '../../components/booking/CancelBookingModal';
import { StateBlock } from '../../components/booking/StateBlocks';
import { ArrowLeftIcon } from '../../components/common/Icons';
import { formatCurrency, formatDisplayDate, formatDuration, formatTimeRange, isCancellable } from '../../utils/booking';
import type { BookingDetail } from '../../types/booking';

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, padding: '8px 0', borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

export function BookingDetailPage() {
  const { bookingId: bookingIdParam } = useParams();
  const bookingId = Number(bookingIdParam);
  const [booking, setBooking] = useState<BookingDetail | null>(null);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(bookingId)) return;
    setStatus('loading');
    setError(null);
    try {
      setBooking(await bookingService.getBookingDetail(bookingId));
      setStatus('success');
    } catch (err) {
      setStatus('error');
      setError(err instanceof ApiError ? err.message : 'Không thể tải chi tiết đơn đặt sân.');
    }
  }, [bookingId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleConfirmCancel = async () => {
    setSubmitting(true);
    setCancelError(null);
    try {
      await bookingService.cancelBooking(bookingId);
      setIsModalOpen(false);
      await load();
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
      <StateBlock title="Không tải được đơn" description={error ?? 'Đơn không tồn tại.'} actionLabel="Thử lại" onAction={() => void load()} />
    );
  }

  const cancellable = isCancellable(booking.status, booking.bookingDate, booking.startTime);

  return (
    <div style={{ width: '100%', maxWidth: 960, margin: '0 auto', padding: '32px 24px 64px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <Link to="/bookings" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--color-brand)' }}>
        <ArrowLeftIcon size={16} color="var(--color-brand)" />
        Quay lại lịch sử đặt sân
      </Link>

      <header style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--text-primary)' }}>
            Đơn đặt sân #{booking.bookingCode}
          </h1>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Ngày tạo: {new Date(booking.createdAt).toLocaleString('vi-VN')}</span>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <BookingStatusBadge status={booking.status} />
          <RefundStatusBadge refundStatus={booking.refundStatus} />
        </div>
      </header>

      <section style={{ padding: 20, borderRadius: 14, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-card)' }}>
        <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 8, color: 'var(--text-primary)' }}>Thông tin lịch đặt</h2>
        <InfoRow label="Cơ sở" value={booking.facility.name} />
        <InfoRow label="Địa chỉ" value={`${booking.facility.address}, ${booking.facility.district}, ${booking.facility.city}`} />
        <InfoRow label="Sân" value={booking.court.name} />
        <InfoRow label="Ngày thi đấu" value={formatDisplayDate(booking.bookingDate)} />
        <InfoRow label="Khung giờ" value={`${formatTimeRange(booking.startTime, booking.endTime)} (${formatDuration(booking.durationMinutes)})`} />
        {booking.expiresAt && booking.status === 'PENDING_PAYMENT' && (
          <InfoRow label="Hạn thanh toán" value={new Date(booking.expiresAt).toLocaleString('vi-VN')} />
        )}
      </section>

      <section style={{ padding: 20, borderRadius: 14, backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-card)' }}>
        <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, marginBottom: 8, color: 'var(--text-primary)' }}>Chi tiết thanh toán</h2>
        {booking.pricingDetails.map((detail) => (
          <InfoRow
            key={`${detail.startTime}-${detail.endTime}`}
            label={`${formatTimeRange(detail.startTime, detail.endTime)} · ${formatCurrency(detail.price)}/giờ`}
            value={formatCurrency(detail.amount)}
          />
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Tổng cộng</span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>{formatCurrency(booking.totalAmount)}</span>
        </div>
        <span style={{ display: 'block', marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
          {booking.payment ? `Đã thanh toán (${booking.payment.status})` : 'Chưa ghi nhận thanh toán'}
        </span>
      </section>

      {cancellable && (
        <section style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 20, borderRadius: 14, backgroundColor: 'var(--color-brand-light)', border: '1px solid var(--border-card)' }}>
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            {booking.status === 'CONFIRMED'
              ? `Hủy trước giờ bắt đầu để được hoàn 100% (${formatCurrency(booking.totalAmount)}).`
              : 'Hủy đơn chưa thanh toán để giải phóng khung giờ ngay lập tức.'}
          </span>
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{ padding: '10px 18px', borderRadius: 8, backgroundColor: 'var(--color-danger)', color: '#FFFFFF', fontWeight: 600, fontSize: 13 }}
          >
            Yêu cầu hủy đặt sân
          </button>
        </section>
      )}

      <CancelBookingModal
        isOpen={isModalOpen}
        booking={booking}
        submitting={submitting}
        error={cancelError}
        onClose={() => setIsModalOpen(false)}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
}
