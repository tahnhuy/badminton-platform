import { Link } from 'react-router-dom';
import { formatCurrency, todayIso } from '../utils/booking';
import type { BookingDetail } from '../types/booking';

interface NoticeConfig {
  tone: 'info' | 'success' | 'danger' | 'muted';
  title: string;
  description: string;
  showRebook?: boolean;
}

const TONES: Record<NoticeConfig['tone'], { background: string; color: string }> = {
  info: { background: 'var(--bg-tag-amber)', color: 'var(--color-warning)' },
  success: { background: 'var(--color-brand-light)', color: 'var(--color-brand)' },
  danger: { background: 'var(--bg-tag-red)', color: 'var(--color-danger)' },
  muted: { background: 'var(--bg-table-header)', color: 'var(--text-secondary)' },
};

function refundDescription(booking: BookingDetail): string {
  switch (booking.refundStatus) {
    case 'REFUNDED':
      return `Đã hoàn ${formatCurrency(booking.totalAmount)} vào ví của bạn.`;
    case 'PENDING':
    case 'REFUND_PENDING':
      return `Đang xử lý hoàn ${formatCurrency(booking.totalAmount)} vào ví của bạn.`;
    case 'REFUND_FAILED':
      return 'Hoàn tiền thất bại. Vui lòng liên hệ CSKH để được hỗ trợ.';
    default:
      return 'Đơn chưa thanh toán nên không phát sinh hoàn tiền.';
  }
}

function buildConfig(booking: BookingDetail): NoticeConfig | null {
  switch (booking.status) {
    case 'PENDING_PAYMENT':
      return {
        tone: 'info',
        title: 'Đơn đang chờ thanh toán',
        description: 'Hoàn tất thanh toán trước khi hết thời gian giữ chỗ để xác nhận lịch đặt.',
      };
    case 'COMPLETED':
      return {
        tone: 'success',
        title: 'Buổi thi đấu đã hoàn tất',
        description: `Cảm ơn bạn đã đồng hành cùng SmashPro. Tổng chi phí ${formatCurrency(booking.totalAmount)}.`,
        showRebook: true,
      };
    case 'EXPIRED':
      return {
        tone: 'danger',
        title: 'Đơn đã hết hạn giữ chỗ',
        description: 'Thời gian thanh toán đã kết thúc và khung giờ đã được giải phóng. Không phát sinh khoản cấn trừ nào.',
        showRebook: true,
      };
    case 'CANCELLED':
      return {
        tone: 'muted',
        title: 'Đơn đã được hủy',
        description: refundDescription(booking),
        showRebook: true,
      };
    default:
      return null;
  }
}

export function BookingStatusNotice({ booking }: { booking: BookingDetail }) {
  const config = buildConfig(booking);
  if (!config) return null;

  const tone = TONES[config.tone];

  return (
    <section style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 20, borderRadius: 14, background: tone.background, border: '1px solid var(--border-card)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 620 }}>
        <span style={{ fontWeight: 700, fontSize: 15, color: tone.color }}>{config.title}</span>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{config.description}</span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {booking.status === 'PENDING_PAYMENT' && (
          <Link to={`/bookings/${booking.id}/pending`} style={{ padding: '10px 18px', borderRadius: 8, backgroundColor: 'var(--color-brand)', color: '#FFFFFF', fontWeight: 600, fontSize: 13 }}>
            Đi tới thanh toán
          </Link>
        )}
        {config.showRebook && (
          <Link to={`/courts/${booking.court.id}?date=${todayIso()}`} style={{ padding: '10px 18px', borderRadius: 8, backgroundColor: 'var(--color-brand)', color: '#FFFFFF', fontWeight: 600, fontSize: 13 }}>
            Đặt lại sân này
          </Link>
        )}
      </div>
    </section>
  );
}
