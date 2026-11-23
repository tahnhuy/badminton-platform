import { useState } from 'react';
import { ApiError } from '../../../../shared/api/http-client';
import { useApiResource } from '../../../../shared/hooks/useApiResource';
import { matchmakingService } from '../../services/matchmakingService';
import type { MatchBookingCandidate } from '../../types/matchmaking';

const reasons: Record<NonNullable<MatchBookingCandidate['reason']>, string> = {
  ALREADY_LINKED: 'Booking đã được liên kết với trận khác',
  NOT_PAID: 'Booking chưa được thanh toán',
  PAST: 'Booking đã bắt đầu hoặc ở quá khứ',
  WRONG_WINDOW: 'Booking không đúng ngày, giờ bắt đầu hoặc thời lượng của kèo',
};

export function BookingPicker({ matchId, onLinked }: { matchId: number; onLinked: () => void }) {
  const resource = useApiResource<{ data: MatchBookingCandidate[] }>(`/api/v1/matches/${matchId}/booking-candidates`);
  const [linking, setLinking] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const link = async (bookingId: number) => {
    setLinking(bookingId);
    setError(null);
    try {
      await matchmakingService.linkBooking(matchId, bookingId);
      resource.reload();
      onLinked();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể liên kết booking. Vui lòng thử lại.');
    } finally {
      setLinking(null);
    }
  };

  return <div className="match-booking-picker mt-4 grid gap-2">
    <h3>Chọn booking đã thanh toán</h3>
    <p className="match-muted text-xs leading-5 text-muted-foreground">Chỉ booking đã thanh toán, đúng khung giờ và chưa liên kết trận khác mới có thể chọn.</p>
    {resource.loading && <p role="status">Đang tải booking…</p>}
    {resource.error && <div role="alert" className="match-error mb-5 rounded-lg bg-destructive/10 p-4.5 text-sm leading-6 text-destructive"><p>{resource.error}</p><button className="match-button inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-3 text-center text-sm font-semibold disabled:opacity-50 match-button-secondary bg-secondary text-secondary-foreground" onClick={resource.reload}>Thử lại</button></div>}
    {error && <div role="alert" className="match-error mb-5 rounded-lg bg-destructive/10 p-4.5 text-sm leading-6 text-destructive"><p>{error}</p></div>}
    {resource.data && resource.data.data.length === 0 && <p className="match-note my-4 rounded-lg bg-muted p-3.5 text-xs leading-5 text-muted-foreground">Bạn chưa có booking đã thanh toán nào phù hợp. Hãy đặt và thanh toán sân trước, sau đó quay lại liên kết.</p>}
    {resource.data && resource.data.data.length > 0 && <ul className="match-booking-list mt-2 grid list-none gap-2 p-0">
      {resource.data.data.map(booking => <li key={booking.id} className={booking.eligible ? 'match-booking-card flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 [&_p]:my-0.5 [&_p]:text-xs [&_p]:text-muted-foreground' : 'match-booking-card flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 [&_p]:my-0.5 [&_p]:text-xs [&_p]:text-muted-foreground match-booking-disabled opacity-60'}>
        <div>
          <strong>{booking.bookingCode}</strong>
          <p>{booking.facility.name} · {booking.court.name}</p>
          <p>{booking.bookingDate} · {booking.startTime.slice(0, 5)}–{booking.endTime.slice(0, 5)} · {booking.totalAmount.toLocaleString('vi-VN')} ₫</p>
          {!booking.eligible && <p className="match-booking-reason text-destructive!">{reasons[booking.reason ?? 'WRONG_WINDOW']}</p>}
        </div>
        <button type="button" className="match-button inline-flex min-h-11 items-center justify-center rounded-lg border border-border px-4 py-3 text-center text-sm font-semibold disabled:opacity-50 match-button-primary border-primary bg-primary text-primary-foreground hover:bg-primary/90" disabled={!booking.eligible || linking !== null} onClick={() => void link(booking.id)}>
          {linking === booking.id ? 'Đang liên kết…' : 'Liên kết'}
        </button>
      </li>)}
    </ul>}
  </div>;
}
