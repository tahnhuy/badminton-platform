import { useState } from 'react';
import { ApiError } from '../../../shared/api/http-client';
import { useOwnerResource } from '../hooks/useOwnerResource';
import { ResourceState, Status } from './OwnerUi';
import { useModalA11y } from '../../../shared/hooks/useModalA11y';
import { ownerApi } from '../services/owner-api';
import type { OwnerBooking } from '../types/owner';

function started(booking: OwnerBooking): boolean {
  return new Date(`${booking.bookingDate}T${booking.startTime}+07:00`).getTime() <= Date.now();
}

function canCancel(booking: OwnerBooking): boolean {
  return booking.bookingKind !== 'TOURNAMENT'
    && (booking.status === 'PENDING_PAYMENT' || booking.status === 'CONFIRMED')
    && !started(booking);
}

function refundLabel(booking: OwnerBooking): string {
  if (booking.refundStatus === 'PENDING') return 'Đang hoàn tiền';
  if (booking.refundStatus === 'REFUNDED') return 'Đã hoàn tiền';
  if (booking.refundStatus === 'FAILED') return 'Hoàn tiền thất bại';
  return 'Không có hoàn tiền';
}

export function BookingDetailPanel({ id, close, onCancelled }: { id: number; close: () => void; onCancelled?: () => void }) {
  const resource = useOwnerResource<{ data: OwnerBooking }>(`/bookings/${id}`, true);
  const ref = useModalA11y<HTMLElement>(true, close);
  const booking = resource.data?.data;
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<{ refundStatus: string } | null>(null);

  const submit = async () => {
    if (!booking || submitting) return;
    if (!reason.trim()) {
      setError('Vui lòng nhập lý do hủy.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await ownerApi.write<{ refundStatus: string }>(`/bookings/${id}/cancel`, { reason: reason.trim() });
      setOutcome(result.data);
      await resource.reload();
      onCancelled?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Không thể hủy booking. Vui lòng thử lại.');
    } finally {
      setSubmitting(false);
    }
  };

  return <div className="owner-dialog-backdrop"><section className="owner-dialog" role="dialog" aria-modal="true" aria-labelledby="owner-booking-title" tabIndex={-1} ref={ref}>
    <button onClick={close}>Đóng chi tiết</button><h2 id="owner-booking-title">Chi tiết booking</h2>
    <ResourceState {...resource} retry={resource.reload}>{booking && <><h3>{booking.bookingCode}</h3><Status value={booking.status} />
      <dl><dt>Ngày</dt><dd>{booking.bookingDate}</dd><dt>Khoảng giờ</dt><dd>{booking.startTime.slice(0, 5)}–{booking.endTime.slice(0, 5)}</dd><dt>Số tiền booking</dt><dd>{booking.totalAmount.toLocaleString('vi-VN')} VNĐ</dd><dt>Hoàn tiền</dt><dd>{refundLabel(booking)}</dd></dl>
      {booking.bookingKind === 'TOURNAMENT' ? <p className="owner-note">Lịch sân của giải đấu #{booking.tournamentId}. Chủ sân không thể hủy trực tiếp; vui lòng phối hợp với Organizer để xử lý trận đấu.</p> : <section><h3>Liên hệ người đặt</h3><p>{booking.player?.fullName ?? 'Chưa có tên hiển thị'}</p><p>Email: <a href={`mailto:${booking.player?.email}`}>{booking.player?.email}</a></p><p>Điện thoại: {booking.player?.phone ? <a href={`tel:${booking.player.phone}`}>{booking.player.phone}</a> : 'Chưa cung cấp số điện thoại'}</p></section>}
      {booking.cancellationReason && <p>Lý do hủy: {booking.cancellationReason}</p>}
      {booking.pricingDetails?.map((row, i) => <p key={i}>{row.startTime.slice(0, 5)}–{row.endTime.slice(0, 5)}: {Number(row.price).toLocaleString('vi-VN')} VNĐ/giờ · {Number(row.amount).toLocaleString('vi-VN')} VNĐ</p>)}
      {booking.bookingKind !== 'TOURNAMENT' && (booking.status === 'PENDING_PAYMENT' || booking.status === 'CONFIRMED') && <section className="owner-note" aria-labelledby="owner-cancel-title">
        <h3 id="owner-cancel-title">Hủy booking do sự cố từ phía sân</h3>
        {!canCancel(booking) && <p>Booking đã bắt đầu nên không thể hủy. Vui lòng liên hệ hỗ trợ nếu cần xử lý ngoại lệ.</p>}
        {canCancel(booking) && <>
          <p>{booking.status === 'CONFIRMED'
            ? 'Booking đã thanh toán sẽ được hoàn tiền vào ví của người chơi sau khi hủy.'
            : 'Booking chưa thanh toán sẽ được giải phóng, không phát sinh hoàn tiền.'}</p>
          <label>Lý do hủy (bắt buộc)<textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} required /></label>
          <p>Bằng việc xác nhận, bạn xác nhận booking thuộc sự cố từ phía sân và đã kiểm tra chính sách hủy.</p>
          {error && <p role="alert" className="owner-error">{error}</p>}
          <button type="button" className="owner-primary" disabled={submitting || !reason.trim()} onClick={() => void submit()}>{submitting ? 'Đang hủy…' : 'Xác nhận hủy booking'}</button>
        </>}
      </section>}
      {outcome && <p role="status">{outcome.refundStatus === 'PENDING' ? 'Đã hủy. Hoàn tiền đang chờ xử lý.' : outcome.refundStatus === 'REFUNDED' ? 'Đã hủy và hoàn tiền thành công.' : outcome.refundStatus === 'FAILED' ? 'Đã hủy nhưng hoàn tiền thất bại. Vui lòng theo dõi trạng thái hoàn tiền.' : 'Đã hủy booking chưa thanh toán.'}</p>}
    </>}</ResourceState>
  </section></div>;
}
