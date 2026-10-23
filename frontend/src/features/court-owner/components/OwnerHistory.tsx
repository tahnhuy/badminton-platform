import { useState } from 'react';
import { DataTable } from '../../../components/common/DataTable';
import { FilterToolbar } from '../../../components/common/FilterToolbar';
import { useOwnerResource } from '../hooks/useOwnerResource';
import { Pager, ResourceState, Status } from './OwnerUi';
import { labels } from '../types/labels';
import type { OwnerBooking, Meta } from '../types/owner';
export function OwnerHistory({ facilityId, detail }: { facilityId: number; detail: (id: number) => void }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const resource = useOwnerResource<{ data: OwnerBooking[]; meta: Meta }>(`/facilities/${facilityId}/bookings?page=${page}&limit=10${status ? `&status=${status}` : ''}`, true);
  return <section className="owner-card"><h2>Lịch sử booking</h2><FilterToolbar filters={[{ id: 'history-status', value: status, ariaLabel: 'Lọc trạng thái booking', placeholder: 'Mọi trạng thái', options: ['PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED'].map(value => ({ value, label: labels[value] })), onChange: value => { setStatus(value); setPage(1); } }]} />
    <ResourceState {...resource} retry={resource.reload}><DataTable data={resource.data?.data ?? []} keyExtractor={row => row.id} emptyState={<p>Chưa có booking phù hợp.</p>} columns={[
      { key: 'code', header: 'Booking', render: row => <button onClick={() => detail(row.id)}>{row.bookingCode}</button> }, { key: 'date', header: 'Ngày / Giờ', render: row => `${row.bookingDate} · ${row.startTime.slice(0, 5)}–${row.endTime.slice(0, 5)}` }, { key: 'status', header: 'Trạng thái', render: row => <Status value={row.status} /> }, { key: 'refund', header: 'Hoàn tiền', render: row => row.refundStatus === 'PENDING' ? 'Đang hoàn tiền' : labels[row.refundStatus] },
    ]} />{resource.data && <Pager page={page} pages={resource.data.meta.totalPages} setPage={setPage} />}</ResourceState>
  </section>;
}
