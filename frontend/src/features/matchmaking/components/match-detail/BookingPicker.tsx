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

  return <div className="match-booking-picker">
    <h3>Chọn booking đã thanh toán</h3>
    <p className="match-muted">Chỉ booking đã thanh toán, đúng khung giờ và chưa liên kết trận khác mới có thể chọn.</p>
    {resource.loading && <p role="status">Đang tải booking…</p>}
    {resource.error && <div role="alert" className="match-error"><p>{resource.error}</p><button className="match-button match-button-secondary" onClick={resource.reload}>Thử lại</button></div>}
    {error && <div role="alert" className="match-error"><p>{error}</p></div>}
    {resource.data && resource.data.data.length === 0 && <p className="match-note">Bạn chưa có booking đã thanh toán nào phù hợp. Hãy đặt và thanh toán sân trước, sau đó quay lại liên kết.</p>}
    {resource.data && resource.data.data.length > 0 && <ul className="match-booking-list">
      {resource.data.data.map(booking => <li key={booking.id} className={booking.eligible ? 'match-booking-card' : 'match-booking-card match-booking-disabled'}>
        <div>
          <strong>{booking.bookingCode}</strong>
          <p>{booking.facility.name} · {booking.court.name}</p>
          <p>{booking.bookingDate} · {booking.startTime.slice(0, 5)}–{booking.endTime.slice(0, 5)} · {booking.totalAmount.toLocaleString('vi-VN')} ₫</p>
          {!booking.eligible && <p className="match-booking-reason">{reasons[booking.reason ?? 'WRONG_WINDOW']}</p>}
        </div>
        <button type="button" className="match-button match-button-primary" disabled={!booking.eligible || linking !== null} onClick={() => void link(booking.id)}>
          {linking === booking.id ? 'Đang liên kết…' : 'Liên kết'}
        </button>
      </li>)}
    </ul>}
  </div>;
}
