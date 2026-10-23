import { useOwnerResource } from '../hooks/useOwnerResource';
import { ResourceState, Status } from './OwnerUi';
import { labels } from '../types/labels';
import { useModalA11y } from '../../../shared/hooks/useModalA11y';
import type { OwnerBooking } from '../types/owner';
export function BookingDetailPanel({ id, close }: { id: number; close: () => void }) {
  const resource = useOwnerResource<{ data: OwnerBooking }>(`/bookings/${id}`, true);
  const ref = useModalA11y<HTMLElement>(true, close);
  const booking = resource.data?.data;
  return <div className="owner-dialog-backdrop"><section className="owner-dialog" role="dialog" aria-modal="true" aria-labelledby="owner-booking-title" tabIndex={-1} ref={ref}>
    <button onClick={close}>Đóng chi tiết</button><h2 id="owner-booking-title">Chi tiết booking</h2>
    <ResourceState {...resource} retry={resource.reload}>{booking && <><h3>{booking.bookingCode}</h3><Status value={booking.status} />
      <dl><dt>Ngày</dt><dd>{booking.bookingDate}</dd><dt>Khoảng giờ</dt><dd>{booking.startTime.slice(0, 5)}–{booking.endTime.slice(0, 5)}</dd><dt>Số tiền booking</dt><dd>{booking.totalAmount.toLocaleString('vi-VN')} VNĐ</dd><dt>Hoàn tiền</dt><dd>{booking.refundStatus === 'PENDING' ? 'Đang hoàn tiền' : labels[booking.refundStatus]}</dd></dl>
      {booking.bookingKind === 'TOURNAMENT' ? <p className="owner-note">Lịch sân của giải đấu #{booking.tournamentId}. Chủ sân không thể hủy trực tiếp; vui lòng phối hợp với Organizer để xử lý trận đấu.</p> : <section><h3>Liên hệ người đặt</h3><p>{booking.player?.fullName ?? 'Chưa có tên hiển thị'}</p><p>Email: <a href={`mailto:${booking.player?.email}`}>{booking.player?.email}</a></p><p>Điện thoại: {booking.player?.phone ? <a href={`tel:${booking.player.phone}`}>{booking.player.phone}</a> : 'Chưa cung cấp số điện thoại'}</p></section>}
      {booking.cancellationReason && <p>Lý do hủy: {booking.cancellationReason}</p>}
      {booking.pricingDetails?.map((row, i) => <p key={i}>{row.startTime.slice(0, 5)}–{row.endTime.slice(0, 5)}: {Number(row.price).toLocaleString('vi-VN')} VNĐ/giờ · {Number(row.amount).toLocaleString('vi-VN')} VNĐ</p>)}
    </>}</ResourceState>
  </section></div>;
}
