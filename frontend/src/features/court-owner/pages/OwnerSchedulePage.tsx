import { useEffect, useState } from 'react';
import { DataTable } from '@/components/common/data-table';
import { useSearchParams } from 'react-router-dom';
import { CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Wrench } from 'lucide-react';
import { PageHeader } from '@/components/common/page-layout';
import { ContentPanel } from '@/components/common/content-panel';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useOwnerWorkspace } from '../hooks/owner-workspace';
import { useOwnerResource } from '../hooks/useOwnerResource';
import { Feedback, ResourceState, Status } from '../components/OwnerUi';
import { labels } from '../types/labels';
import { useOwnerAction } from '../hooks/useOwnerAction';
import { OwnerScheduleGrid } from '../components/OwnerScheduleGrid';
import { MaintenanceForm } from '../components/MaintenanceForm';
import { OwnerHistory } from '../components/OwnerHistory';
import { BookingDetailPanel } from '../components/BookingDetailPanel';
import { ownerApi } from '../services/owner-api';
import type { OwnerBooking, Schedule, Slot } from '../types/owner';
function validDate(value: string | null): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
const todayVN = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date());
function shiftDay(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
const SCHEDULE_TABS = ['grid', 'list', 'history'];

export function OwnerSchedulePage() {
  const { facilityId, facilities } = useOwnerWorkspace();
  const [search, setSearch] = useSearchParams();
  const bookingParam = search.get('bookingId');
  const dateParam = search.get('date');
  const [date, setDate] = useState(() => validDate(dateParam) ?? todayVN());
  const [detail, setDetail] = useState<number | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  useEffect(() => {
    if (!bookingParam) {
      setDetail(null);
      setDetailError(null);
      return;
    }
    const id = Number(bookingParam);
    if (!Number.isSafeInteger(id) || id <= 0) {
      setDetail(null);
      setDetailError('Không thể mở booking từ liên kết này.');
      return;
    }
    let active = true;
    ownerApi.get<{ data: OwnerBooking }>(`/bookings/${id}`).then(result => {
      if (!active) return;
      const booking = result.data;
      const linkDate = validDate(dateParam);
      if (booking.facilityId !== facilityId || (linkDate && booking.bookingDate !== linkDate)) {
        setDetail(null);
        setDetailError('Không thể mở booking từ liên kết này.');
        return;
      }
      setDate(booking.bookingDate);
      setDetail(booking.id);
      setDetailError(null);
    }).catch(() => {
      if (!active) return;
      setDetail(null);
      setDetailError('Không thể mở booking từ liên kết này.');
    });
    return () => { active = false; };
  }, [bookingParam, dateParam, facilityId]);
  const closeDetail = () => {
    setDetail(null);
    const next = new URLSearchParams(search);
    next.delete('bookingId');
    next.delete('date');
    setSearch(next, { replace: true });
  };
  const changeDate = (nextDate: string) => {
    if (!nextDate) return;
    setDate(nextDate);
    setDetail(null);
    setDetailError(null);
    const next = new URLSearchParams(search);
    next.delete('bookingId');
    next.delete('date');
    setSearch(next, { replace: true });
  };

  const resource = useOwnerResource<{ data: Schedule }>(facilityId ? `/facilities/${facilityId}/schedule?date=${date}` : null, true);
  const action = useOwnerAction();
  const [historyRevision, setHistoryRevision] = useState(0);
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  if (!facilityId) return <div className="flex min-w-0 flex-col gap-6"><PageHeader title="Lịch đặt & Giám sát" /><p>Hãy tạo cơ sở và thêm sân trước.</p></div>;
  const rows = resource.data?.data.courts.flatMap(court => court.slots.map((slot, index) => ({ ...slot, courtId: court.courtId, courtName: court.courtName, key: `${court.courtId}-${index}` }))) ?? [];
  const courts = resource.data?.data.courts ?? [];
  const opening = facilities.find(row => row.id === facilityId)?.openingTime.slice(0, 5);
  const requestedTab = search.get('tab') ?? '';
  const tab = SCHEDULE_TABS.includes(requestedTab) ? requestedTab : 'grid';
  const changeTab = (value: string) => { const next = new URLSearchParams(search); next.set('tab', value); setSearch(next, { replace: true }); };
  return <div className="flex min-w-0 flex-col gap-6"><PageHeader title="Lịch đặt & Giám sát" />{detailError && <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive">{detailError}</p>}
    <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5"><div className="flex flex-col gap-2"><Label htmlFor="schedule-date" className="text-sm font-semibold">Ngày xem lịch</Label><div className="flex items-center gap-2"><Button type="button" variant="outline" size="icon" className="size-11" aria-label="Ngày trước" onClick={() => changeDate(shiftDay(date, -1))}><ChevronLeft aria-hidden="true" /></Button><Input id="schedule-date" className="h-11 max-w-64 rounded-lg bg-card px-3 text-sm motion-safe:focus-visible:translate-y-0" aria-label="Ngày xem lịch" type="date" required value={date} onChange={event => changeDate(event.target.value)} /><Button type="button" variant="outline" size="icon" className="size-11" aria-label="Ngày sau" onClick={() => changeDate(shiftDay(date, 1))}><ChevronRight aria-hidden="true" /></Button></div></div>
      <Button type="button" variant="outline" className="h-11" onClick={() => changeDate(todayVN())}>Hôm nay</Button><Button type="button" variant="outline" className="h-11" onClick={resource.reload}><RefreshCw aria-hidden="true" />Làm mới lịch</Button>
      {courts.length > 0 && <Button type="button" className="h-11 sm:ml-auto" onClick={() => setMaintenanceOpen(true)}><Wrench aria-hidden="true" />Khóa bảo trì</Button>}</div>
    <Tabs value={tab} onValueChange={changeTab} className="min-w-0">
      <TabsList aria-label="Chế độ xem lịch"><TabsTrigger value="grid">Lưới sân</TabsTrigger><TabsTrigger value="list">Danh sách khoảng giờ</TabsTrigger><TabsTrigger value="history">Lịch sử booking</TabsTrigger></TabsList>
      <TabsContent value="grid" forceMount className="pt-6"><ResourceState {...resource} retry={resource.reload}>
        {courts.length === 0 && resource.data && <p className="rounded-lg bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">Cơ sở chưa có sân. Thêm sân trong Quản lý cơ sở.</p>}
        {resource.data && <ContentPanel title="Lịch sân & Giám sát" icon={CalendarDays}><OwnerScheduleGrid schedule={resource.data.data} detail={setDetail} opening={opening} active={tab === 'grid'} /></ContentPanel>}
      </ResourceState></TabsContent>
      <TabsContent value="list" forceMount className="pt-6"><ResourceState {...resource} retry={resource.reload}>
        {resource.data && <ContentPanel title="Các khoảng giờ & thao tác" icon={CalendarDays}><DataTable scrollable data={rows} keyExtractor={row => row.key} emptyState={<p>Không có sân để hiển thị.</p>} columns={[
          { key: 'court', header: 'Sân', minWidth: 150, render: row => row.courtName }, { key: 'time', header: 'Khoảng giờ', minWidth: 160, render: row => `${row.startTime}–${row.endTime}` }, { key: 'state', header: 'Trạng thái', minWidth: 180, render: row => <><Status value={row.state} />{row.bookingStatus && <p>{labels[row.bookingStatus]}</p>}</> },
          { key: 'info', header: 'Thông tin', minWidth: 220, render: row => <SlotInfo slot={row} /> }, { key: 'actions', header: 'Thao tác', minWidth: 220, render: row => <div className="flex flex-wrap gap-2">{row.bookingId && <Button type="button" variant="outline" className="h-11" onClick={() => setDetail(row.bookingId!)}>Xem booking</Button>}{row.blockId && <Button type="button" variant="outline" className="h-11" disabled={action.busy} onClick={() => void action.run(() => ownerApi.write(`/courts/${row.courtId}/unblock-slots`, { blockId: row.blockId }), resource.reload)}>Mở khóa khoảng giờ</Button>}</div> },
        ]} /><Feedback {...action} /></ContentPanel>}
      </ResourceState></TabsContent>
      <TabsContent value="history" forceMount className="pt-6"><OwnerHistory revision={historyRevision} facilityId={facilityId} detail={setDetail} /></TabsContent>
    </Tabs>
    <Dialog open={maintenanceOpen} onOpenChange={setMaintenanceOpen}>
      <DialogContent variant="side" aria-describedby={undefined} className="flex flex-col gap-5" onInteractOutside={event => event.preventDefault()}>
        <DialogTitle>Khóa bảo trì</DialogTitle>
        {resource.data && <MaintenanceForm courts={resource.data.data.courts} date={date} saved={resource.reload} />}
      </DialogContent>
    </Dialog>
    {detail && <BookingDetailPanel key={detail} id={detail} close={closeDetail} onCancelled={() => { resource.reload(); setHistoryRevision(value => value + 1); }} />}
  </div>;
}
function SlotInfo({ slot }: { slot: Slot }) {
  if (slot.state === 'UNAVAILABLE') return <>{slot.unavailableReasons?.map(value => labels[value] ?? value).join(' · ')}</>;
  if (slot.state === 'BLOCKED') return <>{slot.reason}</>;
  if (slot.bookingKind === 'TOURNAMENT') return <>Lịch sân giải đấu</>;
  return <>{slot.player?.fullName}{slot.pricePerHour !== undefined && <p>{slot.pricePerHour.toLocaleString('vi-VN')} VNĐ/giờ</p>}</>;
}
