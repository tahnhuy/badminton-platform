import { useState } from 'react';
import { DataTable } from '../../../components/common/DataTable';
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
  if (!facilityId) return <><h1>Lịch đặt & Giám sát</h1><p>Hãy tạo cơ sở và thêm sân trước.</p></>;
  const rows = resource.data?.data.courts.flatMap(court => court.slots.map((slot, index) => ({ ...slot, courtId: court.courtId, courtName: court.courtName, key: `${court.courtId}-${index}` }))) ?? [];
  return <><h1>Lịch đặt & Giám sát</h1><div className="owner-actions"><label>Ngày xem lịch <input aria-label="Ngày xem lịch" type="date" required value={date} onChange={event => { if (event.target.value) { setDate(event.target.value); setDetail(null); } }} /></label><button onClick={resource.reload}>Làm mới lịch</button></div>
    <ResourceState {...resource} retry={resource.reload}>
      {resource.data?.data.courts.length === 0 && <p className="owner-note">Cơ sở chưa có sân. Thêm sân trong Quản lý cơ sở.</p>}
      <section className="owner-card owner-grid"><h2>Lịch sân theo ngày</h2><DataTable data={rows} keyExtractor={row => row.key} emptyState={<p>Không có sân để hiển thị.</p>} columns={[
        { key: 'court', header: 'Sân', render: row => row.courtName }, { key: 'time', header: 'Khoảng giờ', render: row => `${row.startTime}–${row.endTime}` }, { key: 'state', header: 'Trạng thái', render: row => <><Status value={row.state} />{row.bookingStatus && <p>{labels[row.bookingStatus]}</p>}</> },
        { key: 'info', header: 'Thông tin', render: row => <SlotInfo slot={row} /> }, { key: 'actions', header: 'Thao tác', render: row => <div className="owner-slot-actions">{row.bookingId && <button onClick={() => setDetail(row.bookingId!)}>Xem booking</button>}{row.blockId && <button disabled={action.busy} onClick={() => void action.run(() => ownerApi.write(`/courts/${row.courtId}/unblock-slots`, { blockId: row.blockId }), resource.reload)}>Mở khóa khoảng giờ</button>}</div> },
      ]} /><Feedback {...action} /></section>
      {resource.data && <MaintenanceForm courts={resource.data.data.courts} date={date} saved={resource.reload} />}
    </ResourceState>
    <OwnerHistory facilityId={facilityId} detail={setDetail} />{detail && <BookingDetailPanel key={detail} id={detail} close={() => setDetail(null)} onCancelled={resource.reload} />}
  </>;
}
function SlotInfo({ slot }: { slot: Slot }) {
  if (slot.state === 'UNAVAILABLE') return <>{slot.unavailableReasons?.map(value => labels[value] ?? value).join(' · ')}</>;
  if (slot.state === 'BLOCKED') return <>{slot.reason}</>;
  if (slot.bookingKind === 'TOURNAMENT') return <>Lịch sân giải đấu</>;
  return <>{slot.player?.fullName}{slot.pricePerHour !== undefined && <p>{slot.pricePerHour.toLocaleString('vi-VN')} VNĐ/giờ</p>}</>;
}
