import { useState } from 'react';
import { DataTable } from '@/components/common/data-table';
import { CalendarDays, RefreshCw } from 'lucide-react';
import { PageHeader } from '@/components/common/page-layout';
import { ContentPanel } from '@/components/common/content-panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOwnerWorkspace } from '../hooks/owner-workspace';
import { useOwnerResource } from '../hooks/useOwnerResource';
import { Feedback, ResourceState, Status } from '../components/OwnerUi';
import { labels } from '../types/labels';
import { useOwnerAction } from '../hooks/useOwnerAction';
import { MaintenanceForm } from '../components/MaintenanceForm';
import { OwnerHistory } from '../components/OwnerHistory';
import { BookingDetailPanel } from '../components/BookingDetailPanel';
import { ownerApi } from '../services/owner-api';
import type { Schedule, Slot } from '../types/owner';
export function OwnerSchedulePage() {
  const { facilityId } = useOwnerWorkspace();
  const [date, setDate] = useState(() => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date()));
  const [detail, setDetail] = useState<number | null>(null);
  const resource = useOwnerResource<{ data: Schedule }>(facilityId ? `/facilities/${facilityId}/schedule?date=${date}` : null, true);
  const action = useOwnerAction();
  if (!facilityId) return <div className="flex min-w-0 flex-col gap-6"><PageHeader title="Lịch đặt & Giám sát" /><p>Hãy tạo cơ sở và thêm sân trước.</p></div>;
  const rows = resource.data?.data.courts.flatMap(court => court.slots.map((slot, index) => ({ ...slot, courtId: court.courtId, courtName: court.courtName, key: `${court.courtId}-${index}` }))) ?? [];
  return <div className="flex min-w-0 flex-col gap-6"><PageHeader title="Lịch đặt & Giám sát" /><div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm"><div className="flex flex-col gap-2"><Label htmlFor="schedule-date" className="text-sm font-semibold">Ngày xem lịch</Label><Input id="schedule-date" className="h-11 max-w-64 rounded-lg bg-card px-3 text-sm motion-safe:focus-visible:translate-y-0" aria-label="Ngày xem lịch" type="date" required value={date} onChange={event => { if (event.target.value) { setDate(event.target.value); setDetail(null); } }} /></div><Button type="button" variant="outline" className="h-11" onClick={resource.reload}><RefreshCw aria-hidden="true" />Làm mới lịch</Button></div>
    <ResourceState {...resource} retry={resource.reload}>
      {resource.data?.data.courts.length === 0 && <p className="rounded-lg bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">Cơ sở chưa có sân. Thêm sân trong Quản lý cơ sở.</p>}
      <ContentPanel title="Lịch sân theo ngày" icon={CalendarDays}><DataTable data={rows} keyExtractor={row => row.key} emptyState={<p>Không có sân để hiển thị.</p>} columns={[
        { key: 'court', header: 'Sân', render: row => row.courtName }, { key: 'time', header: 'Khoảng giờ', render: row => `${row.startTime}–${row.endTime}` }, { key: 'state', header: 'Trạng thái', render: row => <><Status value={row.state} />{row.bookingStatus && <p>{labels[row.bookingStatus]}</p>}</> },
        { key: 'info', header: 'Thông tin', render: row => <SlotInfo slot={row} /> }, { key: 'actions', header: 'Thao tác', render: row => <div className="flex flex-wrap gap-2">{row.bookingId && <Button type="button" variant="outline" className="h-11" onClick={() => setDetail(row.bookingId!)}>Xem booking</Button>}{row.blockId && <Button type="button" variant="outline" className="h-11" disabled={action.busy} onClick={() => void action.run(() => ownerApi.write(`/courts/${row.courtId}/unblock-slots`, { blockId: row.blockId }), resource.reload)}>Mở khóa khoảng giờ</Button>}</div> },
      ]} /><Feedback {...action} /></ContentPanel>
      {resource.data && <MaintenanceForm courts={resource.data.data.courts} date={date} saved={resource.reload} />}
    </ResourceState>
    <OwnerHistory facilityId={facilityId} detail={setDetail} />{detail && <BookingDetailPanel key={detail} id={detail} close={() => setDetail(null)} />}
  </div>;
}
function SlotInfo({ slot }: { slot: Slot }) {
  if (slot.state === 'UNAVAILABLE') return <>{slot.unavailableReasons?.map(value => labels[value] ?? value).join(' · ')}</>;
  if (slot.state === 'BLOCKED') return <>{slot.reason}</>;
  if (slot.bookingKind === 'TOURNAMENT') return <>Lịch sân giải đấu</>;
  return <>{slot.player?.fullName}{slot.pricePerHour !== undefined && <p>{slot.pricePerHour.toLocaleString('vi-VN')} VNĐ/giờ</p>}</>;
}
