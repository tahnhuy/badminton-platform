import { useState } from 'react';
import { ApiError } from '../../../shared/api/http-client';
import { useOwnerResource } from '../hooks/useOwnerResource';
import { ResourceState, Status } from './OwnerUi';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { focusDialogEdge } from '@/shared/utils/dialog-focus';
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

function refundLabel(status: string): string {
  if (status === 'PENDING' || status === 'REFUND_PENDING') return 'Đang hoàn tiền';
  if (status === 'REFUNDED') return 'Đã hoàn tiền';
  if (status === 'FAILED' || status === 'REFUND_FAILED') return 'Hoàn tiền thất bại';
  return 'Không có hoàn tiền';
}

export function BookingDetailPanel({ id, close, onCancelled }: { id: number; close: () => void; onCancelled?: () => void }) {
  const resource = useOwnerResource<{ data: OwnerBooking }>(`/bookings/${id}`, true);
  const ref = useRef<HTMLDivElement>(null);
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

  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent variant="side" overlayClassName="z-[100]" className="z-[100] flex flex-col gap-5" showClose={false} aria-describedby={undefined} tabIndex={-1} ref={ref}
    onInteractOutside={event => event.preventDefault()} onOpenAutoFocus={event => { event.preventDefault(); ref.current?.focus(); }} onCloseAutoFocus={event => event.preventDefault()} onKeyDown={focusDialogEdge}>
    <Button type="button" variant="outline" className="h-11 self-start" onClick={close}>Đóng chi tiết</Button><DialogTitle>Chi tiết booking</DialogTitle>
    <ResourceState {...resource} retry={resource.reload}>{booking && <><h3 className="text-2xl font-extrabold tracking-tight">{booking.bookingCode}</h3><Status value={booking.status} />
      <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-5 gap-y-3 rounded-lg bg-muted/60 p-4 text-sm [&_dt]:font-semibold [&_dt]:text-muted-foreground [&_dd]:break-words"><dt>Ngày</dt><dd>{booking.bookingDate}</dd><dt>Khoảng giờ</dt><dd>{booking.startTime.slice(0, 5)}–{booking.endTime.slice(0, 5)}</dd><dt>Số tiền booking</dt><dd>{booking.totalAmount.toLocaleString('vi-VN')} VNĐ</dd><dt>Hoàn tiền</dt><dd>{refundLabel(booking.refundStatus)}</dd></dl>
      {booking.bookingKind === 'TOURNAMENT' ? <p className="rounded-lg bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">Lịch sân của giải đấu #{booking.tournamentId}. Chủ sân không thể hủy trực tiếp; vui lòng phối hợp với Organizer để xử lý trận đấu.</p> : <section className="flex flex-col gap-3 border-t border-border pt-5 text-sm [overflow-wrap:anywhere]"><h3 className="text-base font-bold">Liên hệ người đặt</h3><p>{booking.player?.fullName ?? 'Chưa có tên hiển thị'}</p><p>Email: <a className="inline-flex min-h-11 items-center rounded-md font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`mailto:${booking.player?.email}`}>{booking.player?.email}</a></p><p>Điện thoại: {booking.player?.phone ? <a className="inline-flex min-h-11 items-center rounded-md font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`tel:${booking.player.phone}`}>{booking.player.phone}</a> : 'Chưa cung cấp số điện thoại'}</p></section>}
      {booking.cancellationReason && <p>Lý do hủy: {booking.cancellationReason}</p>}
      {booking.pricingDetails?.map((row, i) => <p key={i}>{row.startTime.slice(0, 5)}–{row.endTime.slice(0, 5)}: {Number(row.price).toLocaleString('vi-VN')} VNĐ/giờ · {Number(row.amount).toLocaleString('vi-VN')} VNĐ</p>)}
      {booking.bookingKind !== 'TOURNAMENT' && (booking.status === 'PENDING_PAYMENT' || booking.status === 'CONFIRMED') && <section className="flex flex-col gap-3 rounded-lg border border-border bg-muted/40 p-4 text-sm" aria-labelledby="owner-cancel-title">
        <h3 id="owner-cancel-title" className="text-base font-bold">Hủy booking do sự cố từ phía sân</h3>
        {!canCancel(booking) && <p>Booking đã bắt đầu nên không thể hủy. Vui lòng liên hệ hỗ trợ nếu cần xử lý ngoại lệ.</p>}
        {canCancel(booking) && <>
          <p>{booking.status === 'CONFIRMED'
            ? 'Booking đã thanh toán sẽ được hoàn tiền vào ví của người chơi sau khi hủy.'
            : 'Booking chưa thanh toán sẽ được giải phóng, không phát sinh hoàn tiền.'}</p>
          <label className="flex flex-col gap-2 font-semibold">Lý do hủy (bắt buộc)<textarea className="min-h-20 rounded-md border border-input bg-background p-2 text-sm" value={reason} onChange={event => setReason(event.target.value)} maxLength={2000} required /></label>
          <p>Bằng việc xác nhận, bạn xác nhận booking thuộc sự cố từ phía sân và đã kiểm tra chính sách hủy.</p>
          {error && <p role="alert" className="text-danger">{error}</p>}
          <Button type="button" variant="danger" className="self-start" disabled={submitting || !reason.trim()} onClick={() => void submit()}>{submitting ? 'Đang hủy…' : 'Xác nhận hủy booking'}</Button>
        </>}
      </section>}
      {outcome && <p role="status">{outcome.refundStatus === 'PENDING' ? 'Đã hủy. Hoàn tiền đang chờ xử lý.' : outcome.refundStatus === 'REFUNDED' ? 'Đã hủy và hoàn tiền thành công.' : outcome.refundStatus === 'FAILED' ? 'Đã hủy nhưng hoàn tiền thất bại. Vui lòng theo dõi trạng thái hoàn tiền.' : 'Đã hủy booking chưa thanh toán.'}</p>}
    </>}</ResourceState>
  </DialogContent></Dialog>;
}
