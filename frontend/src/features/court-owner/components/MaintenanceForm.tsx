import { useState } from 'react';
import { FilterToolbar } from '../../../components/common/FilterToolbar';
import { OwnerForm } from './OwnerForm';
import { Feedback } from './OwnerUi';
import { useOwnerAction } from '../hooks/useOwnerAction';
import { ownerApi } from '../services/owner-api';
import type { Schedule } from '../types/owner';
export function MaintenanceForm({ courts, date, saved }: { courts: Schedule['courts']; date: string; saved: () => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const action = useOwnerAction();
  const courtId = courts.some(court => court.courtId === selected) ? selected : courts[0]?.courtId;
  if (!courtId) return null;
  return <section className="owner-card"><h2>Khóa bảo trì</h2><p>Khóa một khoảng giờ trên một sân. Hệ thống từ chối nếu có booking còn hiệu lực. Mở khóa áp dụng cho toàn bộ một khoảng đã tạo.</p>
    <FilterToolbar filters={[{ id: 'block-court', value: String(courtId), ariaLabel: 'Chọn sân bảo trì', options: courts.map(court => ({ value: String(court.courtId), label: court.courtName })), onChange: value => setSelected(Number(value)) }]} />
    <OwnerForm key={date} fields={[{ name: 'bookingDate', label: 'Ngày bảo trì', type: 'date', required: true }, { name: 'startTime', label: 'Giờ bắt đầu bảo trì', type: 'time', required: true }, { name: 'endTime', label: 'Giờ kết thúc bảo trì', type: 'time', required: true }, { name: 'reason', label: 'Lý do bảo trì', type: 'textarea', required: true }]} initial={{ bookingDate: date }} title="Khóa khoảng giờ" busy={action.busy} submit={values => void action.run(() => ownerApi.write(`/courts/${courtId}/block-slots`, values), saved)} />
    <Feedback {...action} />
  </section>;
}
