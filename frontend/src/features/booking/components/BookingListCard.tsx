import { ArrowRight, CalendarDays, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BookingStatusBadge, RefundStatusBadge } from './BookingStatusBadge';
import { formatCurrency, formatDisplayDate, formatDuration, formatTimeRange } from '../utils/booking';
import type { BookingSummary } from '../types/booking';

interface BookingListCardProps { booking: BookingSummary; onView: (bookingId: number) => void }
export function BookingListCard({ booking, onView }: BookingListCardProps) {
  return <article aria-label={`Đơn ${booking.bookingCode}`} className="flex min-w-0 flex-col gap-5 rounded-2xl border border-border border-l-4 border-l-primary/40 bg-card p-5 shadow-sm transition-shadow duration-200 hover:shadow-md sm:flex-row sm:justify-between sm:p-6">
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-muted-foreground">#{booking.bookingCode}</span><BookingStatusBadge status={booking.status} /><RefundStatusBadge refundStatus={booking.refundStatus} /></div>
      <h3 className="text-lg font-bold tracking-tight">{booking.facility.name} · {booking.court.name}</h3>
      <p className="flex items-start gap-2 text-sm leading-6 text-muted-foreground"><MapPin aria-hidden="true" className="mt-1 size-4 shrink-0" />{booking.facility.address}, {booking.facility.district}, {booking.facility.city}</p>
      <p className="flex items-start gap-2 text-sm leading-6"><CalendarDays aria-hidden="true" className="mt-1 size-4 shrink-0 text-primary" />{formatDisplayDate(booking.bookingDate)} · {formatTimeRange(booking.startTime, booking.endTime)} ({formatDuration(booking.durationMinutes)})</p>
    </div>
    <div className="flex shrink-0 items-end justify-between gap-5 border-t border-border pt-4 sm:flex-col sm:justify-center sm:border-0 sm:pl-5 sm:pt-0">
      <div><p className="text-xs font-semibold text-muted-foreground">TỔNG TIỀN</p><p className="mt-1 text-2xl font-extrabold tracking-tight text-primary">{formatCurrency(booking.totalAmount)}</p></div>
      <Button type="button" variant="outline" onClick={() => onView(booking.id)}>Xem chi tiết<ArrowRight aria-hidden="true" /></Button>
    </div>
  </article>;
}
