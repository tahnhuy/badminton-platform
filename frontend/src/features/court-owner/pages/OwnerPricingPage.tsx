import { useState } from 'react';
import { DataTable } from '../../../components/common/DataTable';
import { FilterToolbar } from '../../../components/common/FilterToolbar';
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
  return <><ResourceState {...resource} retry={resource.reload}><section className="owner-card"><DataTable data={resource.data?.data ?? []} keyExtractor={row => row.id} emptyState={<p>Chưa có giá. Player chưa thể đặt các khoảng giờ chưa được cấu hình.</p>} columns={[
    { key: 'time', header: 'Khoảng giờ', render: row => `${row.startTime.slice(0, 5)}–${row.endTime.slice(0, 5)}` }, { key: 'price', header: 'VNĐ / giờ', render: row => row.pricePerHour.toLocaleString('vi-VN') }, { key: 'validity', header: 'Hiệu lực', render: row => `${row.validFrom} → ${row.validTo ?? 'Không giới hạn'}` }, { key: 'edit', header: 'Thao tác', render: row => <button onClick={() => setEditing(row)}>Sửa khung giá</button> },
  ]} /></section></ResourceState>
    <section className="owner-card"><h2>{editing ? 'Sửa khung giá hiện hữu' : 'Tạo khung giá'}</h2><p className="owner-note">Giá được chụp khi booking được tạo, kể cả lúc chờ thanh toán. Booking cũ giữ nguyên giá. Điền ngày kết thúc để ngừng áp dụng.</p>
      <OwnerForm key={editing?.id ?? 'new'} fields={fields} initial={editing ? { ...editing } : {}} title="Lưu khung giá" busy={action.busy} submit={values => void action.run(() => ownerApi.write(`/courts/${courtId}/pricings`, { ...values, ...(editing ? { pricingId: editing.id } : {}) }), () => { setEditing(null); resource.reload(); })} />
      {editing && <button onClick={() => setEditing(null)}>Tạo khung khác</button>}<Feedback {...action} />
    </section></>;
}
export function OwnerPricingPage() {
  const { facilityId } = useOwnerWorkspace();
  const resource = useOwnerResource<{ data: Facility }>(facilityId ? `/facilities/${facilityId}` : null);
  const [selected, setSelected] = useState<number | null>(null);
  const courts = resource.data?.data.courts ?? [];
  const courtId = courts.some(row => row.id === selected) ? selected : courts[0]?.id ?? null;
  return <><h1>Bảng giá sân</h1><ResourceState {...resource} retry={resource.reload}>
    {!courts.length && <p className="owner-note">Chưa có sân để cấu hình giá. Hãy thêm sân trong Quản lý cơ sở.</p>}
    {!!courts.length && <FilterToolbar filters={[{ id: 'price-court', value: String(courtId), ariaLabel: 'Chọn sân để cấu hình giá', options: courts.map(row => ({ value: String(row.id), label: row.name })), onChange: value => setSelected(Number(value)) }]} />}
    {courtId && <CourtPricing key={courtId} courtId={courtId} />}
  </ResourceState></>;
}
