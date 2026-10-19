import { useModalA11y } from '../../../shared/hooks/useModalA11y';
import { formatCurrency, formatDisplayDate, formatTimeRange } from '../utils/booking';
import type { BookingSummary } from '../types/booking';

interface MockPaymentModalProps {
  isOpen: boolean;
  booking: BookingSummary | null;
  paymentDetails: {
    paymentId: number;
    amount: string;
    isMock: boolean;
  } | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onConfirm: () => void;
  onSimulateFail?: () => void;
}

export function MockPaymentModal({
  isOpen,
  booking,
  paymentDetails,
  submitting,
  error,
  onClose,
  onConfirm,
  onSimulateFail,
}: MockPaymentModalProps) {
  const dialogRef = useModalA11y<HTMLDivElement>(isOpen, onClose);

  if (!isOpen || !booking) return null;

  const payableAmount = paymentDetails?.amount
    ? Number(paymentDetails.amount)
    : booking.totalAmount;

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
        aria-labelledby="mock-payment-title"
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
          border: '1px solid var(--border-card)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h2
            id="mock-payment-title"
            style={{
              fontFamily: 'Inter, sans-serif',
              fontWeight: 700,
              fontSize: 18,
              color: 'var(--text-primary)',
            }}
          >
            Cổng thanh toán mô phỏng
          </h2>
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: '3px 8px',
              borderRadius: 6,
              backgroundColor: 'rgba(16, 185, 129, 0.1)',
              color: '#059669',
              border: '1px solid rgba(16, 185, 129, 0.3)',
            }}
          >
            MOCK GATEWAY
          </span>
        </div>

        <p style={{ fontSize: 13, lineHeight: '20px', color: 'var(--text-secondary)' }}>
          Hệ thống đang chạy chế độ thanh toán giả lập dành cho phát triển và kiểm thử. Bạn có thể
          mô phỏng xác nhận thanh toán thành công ngay lập tức để xác nhận lịch đặt sân.
        </p>

        <div
          style={{
            padding: 16,
            borderRadius: 12,
            backgroundColor: 'var(--bg-tag-uid)',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            fontSize: 13,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Mã đặt sân:</span>
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>{booking.bookingCode}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Sân đấu:</span>
            <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
              {booking.facility.name} · {booking.court.name}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Thời gian:</span>
            <span style={{ color: 'var(--text-primary)' }}>
              {formatDisplayDate(booking.bookingDate)} · {formatTimeRange(booking.startTime, booking.endTime)}
            </span>
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: 4,
              paddingTop: 8,
              borderTop: '1px solid var(--border-subtle)',
            }}
          >
            <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Số tiền thanh toán:</span>
            <span
              style={{
                fontFamily: 'Inter, sans-serif',
                fontWeight: 800,
                fontSize: 16,
                color: 'var(--color-brand)',
              }}
            >
              {formatCurrency(payableAmount)}
            </span>
          </div>
        </div>

        {error && (
          <div
            role="alert"
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              backgroundColor: 'var(--bg-tag-red)',
              color: 'var(--color-danger)',
              fontSize: 13,
            }}
          >
            {error}
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            style={{
              padding: '12px 20px',
              borderRadius: 8,
              backgroundColor: 'var(--color-brand)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: 14,
              border: 'none',
              cursor: submitting ? 'not-allowed' : 'pointer',
              opacity: submitting ? 0.7 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
            }}
          >
            {submitting ? 'Đang xử lý thanh toán...' : 'Xác nhận thanh toán thành công'}
          </button>

          {onSimulateFail && (
            <button
              type="button"
              onClick={onSimulateFail}
              disabled={submitting}
              style={{
                padding: '9px 16px',
                borderRadius: 8,
                backgroundColor: 'transparent',
                color: 'var(--color-danger)',
                fontWeight: 600,
                fontSize: 13,
                border: '1px solid rgba(239, 68, 68, 0.3)',
                cursor: submitting ? 'not-allowed' : 'pointer',
              }}
            >
              Mô phỏng thanh toán thất bại
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            style={{
              padding: '10px 16px',
              borderRadius: 8,
              backgroundColor: 'transparent',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              fontSize: 13,
              border: 'none',
              cursor: submitting ? 'not-allowed' : 'pointer',
            }}
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
