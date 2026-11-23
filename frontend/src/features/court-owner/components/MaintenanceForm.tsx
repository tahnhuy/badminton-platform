import { useState } from 'react';
import { Wrench } from 'lucide-react';
import { ContentPanel } from '@/components/common/content-panel';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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
  return <ContentPanel title="Khóa bảo trì" icon={Wrench}><p className="text-sm leading-6 text-muted-foreground">Khóa một khoảng giờ trên một sân. Hệ thống từ chối nếu có booking còn hiệu lực. Mở khóa áp dụng cho toàn bộ một khoảng đã tạo.</p>
    <div className="flex flex-col gap-2 sm:max-w-96"><Label htmlFor="block-court" className="text-sm font-semibold">Chọn sân bảo trì</Label><Select id="block-court" aria-label="Chọn sân bảo trì" value={String(courtId)} onChange={value => setSelected(Number(value))} options={courts.map(court => ({ value: String(court.courtId), label: court.courtName }))} /></div>
    <OwnerForm key={date} fields={[{ name: 'bookingDate', label: 'Ngày bảo trì', type: 'date', required: true }, { name: 'startTime', label: 'Giờ bắt đầu bảo trì', type: 'time', required: true }, { name: 'endTime', label: 'Giờ kết thúc bảo trì', type: 'time', required: true }, { name: 'reason', label: 'Lý do bảo trì', type: 'textarea', required: true }]} initial={{ bookingDate: date }} title="Khóa khoảng giờ" busy={action.busy} submit={values => void action.run(() => ownerApi.write(`/courts/${courtId}/block-slots`, values), saved)} />
    <Feedback {...action} />
  </ContentPanel>;
}
