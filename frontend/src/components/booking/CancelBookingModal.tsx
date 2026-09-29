import { useModalA11y } from '../../hooks/useModalA11y';
import { formatCurrency } from '../../utils/booking';
import type { BookingSummary } from '../../types/booking';

interface CancelBookingModalProps {
  isOpen: boolean;
  booking: BookingSummary | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function CancelBookingModal({ isOpen, booking, submitting, error, onClose, onConfirm }: CancelBookingModalProps) {
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, onClose);

  if (!isOpen || !booking) return null;

  const isPaid = booking.status === 'CONFIRMED';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(19, 27, 46, 0.45)',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cancel-booking-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 480,
          backgroundColor: 'var(--bg-card)',
          borderRadius: 16,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          boxShadow: 'var(--shadow-modal)',
        }}
      >
        <h2 id="cancel-booking-title" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>
          Xác nhận hủy lịch đặt sân
        </h2>
        <p style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
          Đơn <strong>{booking.bookingCode}</strong> — {booking.facility.name}, {booking.court.name}.
          Khung giờ sẽ được giải phóng ngay lập tức.
        </p>
        <div style={{ padding: 14, borderRadius: 10, backgroundColor: 'var(--bg-table-header)', fontSize: 13, color: 'var(--text-primary)' }}>
          {isPaid ? (
            <>
              Hủy trước giờ bắt đầu được hoàn <strong>100%</strong> ({formatCurrency(booking.totalAmount)}) về phương thức thanh toán gốc.
            </>
          ) : (
            <>Đơn chưa thanh toán nên không phát sinh hoàn tiền.</>
          )}
        </div>
        {error && <span role="alert" style={{ fontSize: 13, color: 'var(--color-danger)' }}>{error}</span>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{ padding: '10px 18px', borderRadius: 8, backgroundColor: 'var(--bg-tag-uid)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}
          >
            Giữ lịch
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            style={{ padding: '10px 18px', borderRadius: 8, backgroundColor: 'var(--color-danger)', color: '#FFFFFF', fontWeight: 600, fontSize: 13 }}
          >
            {submitting ? 'Đang xử lý...' : 'Xác nhận hủy'}
          </button>
        </div>
      </div>
    </div>
  );
}
