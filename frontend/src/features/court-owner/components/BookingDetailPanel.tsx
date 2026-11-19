import { useOwnerResource } from '../hooks/useOwnerResource';
import { ResourceState, Status } from './OwnerUi';
import { labels } from '../types/labels';
import { useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { focusDialogEdge } from '@/shared/utils/dialog-focus';
import type { OwnerBooking } from '../types/owner';
export function BookingDetailPanel({ id, close }: { id: number; close: () => void }) {
  const resource = useOwnerResource<{ data: OwnerBooking }>(`/bookings/${id}`, true);
  const ref = useRef<HTMLDivElement>(null);
  const booking = resource.data?.data;
  return <Dialog open onOpenChange={open => { if (!open) close(); }}><DialogContent variant="side" overlayClassName="z-[100]" className="z-[100] flex flex-col gap-5" showClose={false} aria-describedby={undefined} tabIndex={-1} ref={ref}
    onInteractOutside={event => event.preventDefault()} onOpenAutoFocus={event => { event.preventDefault(); ref.current?.focus(); }} onCloseAutoFocus={event => event.preventDefault()} onKeyDown={focusDialogEdge}>
    <Button type="button" variant="outline" className="h-11 self-start" onClick={close}>Đóng chi tiết</Button><DialogTitle>Chi tiết booking</DialogTitle>
    <ResourceState {...resource} retry={resource.reload}>{booking && <><h3 className="text-2xl font-extrabold tracking-tight">{booking.bookingCode}</h3><Status value={booking.status} />
      <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)] gap-x-5 gap-y-3 rounded-lg bg-muted/60 p-4 text-sm [&_dt]:font-semibold [&_dt]:text-muted-foreground [&_dd]:break-words"><dt>Ngày</dt><dd>{booking.bookingDate}</dd><dt>Khoảng giờ</dt><dd>{booking.startTime.slice(0, 5)}–{booking.endTime.slice(0, 5)}</dd><dt>Số tiền booking</dt><dd>{booking.totalAmount.toLocaleString('vi-VN')} VNĐ</dd><dt>Hoàn tiền</dt><dd>{booking.refundStatus === 'PENDING' ? 'Đang hoàn tiền' : labels[booking.refundStatus]}</dd></dl>
      {booking.bookingKind === 'TOURNAMENT' ? <p className="rounded-lg bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">Lịch sân của giải đấu #{booking.tournamentId}. Chủ sân không thể hủy trực tiếp; vui lòng phối hợp với Organizer để xử lý trận đấu.</p> : <section className="flex flex-col gap-3 border-t border-border pt-5 text-sm [overflow-wrap:anywhere]"><h3 className="text-base font-bold">Liên hệ người đặt</h3><p>{booking.player?.fullName ?? 'Chưa có tên hiển thị'}</p><p>Email: <a className="inline-flex min-h-11 items-center rounded-md font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`mailto:${booking.player?.email}`}>{booking.player?.email}</a></p><p>Điện thoại: {booking.player?.phone ? <a className="inline-flex min-h-11 items-center rounded-md font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" href={`tel:${booking.player.phone}`}>{booking.player.phone}</a> : 'Chưa cung cấp số điện thoại'}</p></section>}
      {booking.cancellationReason && <p>Lý do hủy: {booking.cancellationReason}</p>}
      {booking.pricingDetails?.map((row, i) => <p key={i}>{row.startTime.slice(0, 5)}–{row.endTime.slice(0, 5)}: {Number(row.price).toLocaleString('vi-VN')} VNĐ/giờ · {Number(row.amount).toLocaleString('vi-VN')} VNĐ</p>)}
    </>}</ResourceState>
  </DialogContent></Dialog>;
}
