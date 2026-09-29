import { ChevronRightIcon } from '../common/Icons';
import { BookingStatusBadge, RefundStatusBadge } from './BookingStatusBadge';
import { formatCurrency, formatDisplayDate, formatDuration, formatTimeRange } from '../../utils/booking';
import type { BookingSummary } from '../../types/booking';

interface BookingListCardProps {
  booking: BookingSummary;
  onView: (bookingId: number) => void;
}

export function BookingListCard({ booking, onView }: BookingListCardProps) {
  return (
    <article
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 16,
        padding: 20,
        borderRadius: 14,
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 260 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)' }}>#{booking.bookingCode}</span>
          <BookingStatusBadge status={booking.status} />
          <RefundStatusBadge refundStatus={booking.refundStatus} />
        </div>
        <h3 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
          {booking.facility.name} · {booking.court.name}
        </h3>
        <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          {booking.facility.address}, {booking.facility.district}, {booking.facility.city}
        </span>
        <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>
          {formatDisplayDate(booking.bookingDate)} · {formatTimeRange(booking.startTime, booking.endTime)} ({formatDuration(booking.durationMinutes)})
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)' }}>TỔNG TIỀN</span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>
            {formatCurrency(booking.totalAmount)}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onView(booking.id)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '9px 16px', borderRadius: 8, backgroundColor: 'var(--bg-tag-uid)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}
        >
          Xem chi tiết
          <ChevronRightIcon size={14} />
        </button>
      </div>
    </article>
  );
}
