import { useEffect, useState } from 'react';
import { DataTable } from '@/components/common/data-table';
import { History } from 'lucide-react';
import { ContentPanel } from '@/components/common/content-panel';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useOwnerResource } from '../hooks/useOwnerResource';
import { Pager, ResourceState, Status } from './OwnerUi';
import { labels } from '../types/labels';
import type { OwnerBooking, Meta } from '../types/owner';
export function OwnerHistory({ facilityId, detail, revision = 0 }: { revision?: number; facilityId: number; detail: (id: number) => void }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const resource = useOwnerResource<{ data: OwnerBooking[]; meta: Meta }>(`/facilities/${facilityId}/bookings?page=${page}&limit=10${status ? `&status=${status}` : ''}`, true);
  useEffect(() => { if (revision > 0) resource.reload(); }, [revision, resource.reload]);
  return <ContentPanel title="Chi tiết lịch đặt" icon={History}><div className="flex flex-col gap-2 sm:max-w-80"><Label htmlFor="history-status" className="text-sm font-semibold">Lọc trạng thái booking</Label><Select id="history-status" aria-label="Lọc trạng thái booking" value={status} onChange={value => { setStatus(value); setPage(1); }} options={[{ value: '', label: 'Mọi trạng thái' }, ...['PENDING_PAYMENT', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'EXPIRED'].map(value => ({ value, label: labels[value] }))]} /></div>
    <ResourceState {...resource} retry={resource.reload}><DataTable scrollable data={resource.data?.data ?? []} keyExtractor={row => row.id} emptyState={<p>Chưa có booking phù hợp.</p>} columns={[
      { key: 'code', header: 'Booking', minWidth: 160, render: row => <Button type="button" variant="ghost" className="h-11 px-2 text-primary" onClick={() => detail(row.id)}>{row.bookingCode}</Button> }, { key: 'date', header: 'Ngày / Giờ', minWidth: 240, render: row => `${row.bookingDate} · ${row.startTime.slice(0, 5)}–${row.endTime.slice(0, 5)}` }, { key: 'customer', header: 'Khách hàng', minWidth: 220, render: row => <><p>{row.bookingKind === 'TOURNAMENT' ? 'Lịch sân giải đấu' : row.player?.fullName || '—'}</p><p className="text-xs text-muted-foreground">{row.bookingKind !== 'TOURNAMENT' && (row.player?.phone || row.player?.email)}</p></> }, { key: 'amount', header: 'Thành tiền', minWidth: 160, render: row => `${row.totalAmount.toLocaleString('vi-VN')} ₫` }, { key: 'status', header: 'Trạng thái', minWidth: 160, render: row => <Status value={row.status} /> }, { key: 'refund', header: 'Hoàn tiền', minWidth: 180, render: row => row.refundStatus === 'PENDING' ? 'Đang hoàn tiền' : labels[row.refundStatus] },
    ]} />{resource.data && <Pager page={page} pages={resource.data.meta.totalPages} setPage={setPage} />}</ResourceState>
  </ContentPanel>;
}
