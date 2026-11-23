import { useState } from 'react';
import { DataTable } from '@/components/common/data-table';
import { Clock3, CircleDollarSign } from 'lucide-react';
import { PageHeader } from '@/components/common/page-layout';
import { ContentPanel } from '@/components/common/content-panel';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { OwnerForm } from '../components/OwnerForm';
import type { Field } from '../components/owner-fields';
import { Feedback, ResourceState } from '../components/OwnerUi';
import { useOwnerAction } from '../hooks/useOwnerAction';
import { useOwnerWorkspace } from '../hooks/owner-workspace';
import { useOwnerResource } from '../hooks/useOwnerResource';
import { ownerApi } from '../services/owner-api';
import type { Facility, Pricing } from '../types/owner';
const fields: Field[] = [{ name: 'startTime', label: 'Giờ bắt đầu', type: 'time', required: true }, { name: 'endTime', label: 'Giờ kết thúc', type: 'time', required: true }, { name: 'pricePerHour', label: 'Giá mỗi giờ (VNĐ)', type: 'number', required: true }, { name: 'validFrom', label: 'Ngày bắt đầu hiệu lực', type: 'date', required: true }, { name: 'validTo', label: 'Ngày kết thúc hiệu lực (tùy chọn)', type: 'date' }];
function CourtPricing({ courtId }: { courtId: number }) {
  const [editing, setEditing] = useState<Pricing | null>(null);
  const resource = useOwnerResource<{ data: Pricing[] }>(`/courts/${courtId}/pricings`);
  const action = useOwnerAction();
  return <div className="flex min-w-0 flex-col gap-6"><ResourceState {...resource} retry={resource.reload}><ContentPanel title="Khung giá hiện có" icon={Clock3}><DataTable data={resource.data?.data ?? []} keyExtractor={row => row.id} emptyState={<p>Chưa có giá. Player chưa thể đặt các khoảng giờ chưa được cấu hình.</p>} columns={[
    { key: 'time', header: 'Khoảng giờ', render: row => `${row.startTime.slice(0, 5)}–${row.endTime.slice(0, 5)}` }, { key: 'price', header: 'VNĐ / giờ', render: row => row.pricePerHour.toLocaleString('vi-VN') }, { key: 'validity', header: 'Hiệu lực', render: row => `${row.validFrom} → ${row.validTo ?? 'Không giới hạn'}` }, { key: 'edit', header: 'Thao tác', render: row => <Button type="button" variant="outline" className="h-11" onClick={() => setEditing(row)}>Sửa khung giá</Button> },
  ]} /></ContentPanel></ResourceState>
    <ContentPanel title={editing ? 'Sửa khung giá hiện hữu' : 'Tạo khung giá'} icon={CircleDollarSign}><p className="rounded-lg bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">Giá được chụp khi booking được tạo, kể cả lúc chờ thanh toán. Booking cũ giữ nguyên giá. Điền ngày kết thúc để ngừng áp dụng.</p>
      <OwnerForm key={editing?.id ?? 'new'} fields={fields} initial={editing ? { ...editing } : {}} title="Lưu khung giá" busy={action.busy} submit={values => void action.run(() => ownerApi.write(`/courts/${courtId}/pricings`, { ...values, ...(editing ? { pricingId: editing.id } : {}) }), () => { setEditing(null); resource.reload(); })} />
      {editing && <Button type="button" variant="outline" className="h-11 self-start" onClick={() => setEditing(null)}>Tạo khung khác</Button>}<Feedback {...action} />
    </ContentPanel></div>;
}
export function OwnerPricingPage() {
  const { facilityId } = useOwnerWorkspace();
  const resource = useOwnerResource<{ data: Facility }>(facilityId ? `/facilities/${facilityId}` : null);
  const [selected, setSelected] = useState<number | null>(null);
  const courts = resource.data?.data.courts ?? [];
  const courtId = courts.some(row => row.id === selected) ? selected : courts[0]?.id ?? null;
  return <div className="flex min-w-0 flex-col gap-6"><PageHeader title="Bảng giá sân" /><ResourceState {...resource} retry={resource.reload}>
    {!courts.length && <p className="rounded-lg bg-muted/60 p-4 text-sm leading-6 text-muted-foreground">Chưa có sân để cấu hình giá. Hãy thêm sân trong Quản lý cơ sở.</p>}
    {!!courts.length && <div className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 shadow-sm sm:flex-row sm:items-center sm:justify-between"><Label htmlFor="price-court" className="text-sm font-bold">Chọn sân để cấu hình giá</Label><Select id="price-court" aria-label="Chọn sân để cấu hình giá" className="sm:max-w-96" value={String(courtId)} onChange={value => setSelected(Number(value))} options={courts.map(row => ({ value: String(row.id), label: row.name }))} /></div>}
    {courtId && <CourtPricing key={courtId} courtId={courtId} />}
  </ResourceState></div>;
}
