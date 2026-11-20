import { Button } from '@/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { Link } from 'react-router-dom';
import { formatCurrency, todayIso } from '../utils/booking';
import type { BookingDetail } from '../types/booking';

interface NoticeConfig {
  tone: 'info' | 'success' | 'danger' | 'muted';
  title: string;
  description: string;
  showRebook?: boolean;
}

const TONES = {
  info: 'bg-caution-bg', success: 'bg-success-bg', danger: 'bg-danger-bg', muted: 'bg-muted',
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

  return <section className={cn('flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border p-5', TONES[config.tone])}>
    <div className="flex max-w-2xl flex-col gap-2"><h2 className="text-base font-bold">{config.title}</h2><p className="text-sm leading-6 text-muted-foreground">{config.description}</p></div>
    <div className="flex flex-wrap gap-2">
      {booking.status === 'PENDING_PAYMENT' && <Button asChild variant="brand"><Link to={`/bookings/${booking.id}/pending`}>Đi tới thanh toán</Link></Button>}
      {config.showRebook && <Button asChild variant="brand"><Link to={`/courts/${booking.court.id}?date=${todayIso()}`}>Đặt lại sân này</Link></Button>}
    </div>
  </section>;
}
