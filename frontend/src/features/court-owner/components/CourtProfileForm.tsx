import { useId, type FormEvent } from 'react';
import { ClipboardList } from 'lucide-react';
import { ContentPanel } from '@/components/common/content-panel';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Feedback } from './OwnerUi';
import { useOwnerAction } from '../hooks/useOwnerAction';
import { ownerApi } from '../services/owner-api';
import type { Court } from '../types/owner';

const surfaceOptions = [
  { value: '', label: 'Chưa khai báo' },
  { value: 'PVC', label: 'PVC' },
  { value: 'WOOD', label: 'Gỗ' },
  { value: 'PU_ACRYLIC', label: 'PU / Acrylic' },
  { value: 'OTHER', label: 'Khác' },
];
const conditionOptions = [
  { value: '', label: 'Chưa khai báo' },
  { value: 'NORMAL', label: 'Bình thường' },
  { value: 'NEEDS_MAINTENANCE', label: 'Cần bảo trì' },
  { value: 'UNDER_MAINTENANCE', label: 'Đang bảo trì' },
];

export function CourtProfileForm({ court, saved }: { court: Court; saved: () => void }) {
  const prefix = useId();
  const action = useOwnerAction();
  const maintenance = court.condition === 'UNDER_MAINTENANCE' || court.condition === 'NEEDS_MAINTENANCE';

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (action.busy) return;
    const form = new FormData(event.currentTarget);
    const text = (name: string) => {
      const value = String(form.get(name) ?? '').trim();
      return value === '' ? null : value;
    };
    const thickness = text('surfaceThicknessMm');
    void action.run(() => ownerApi.write(`/courts/${court.id}/profile`, {
      profileVersion: court.profileVersion,
      surfaceType: text('surfaceType'),
      surfaceBrand: text('surfaceBrand'),
      surfaceModel: text('surfaceModel'),
      surfaceThicknessMm: thickness === null ? null : Number(thickness),
      condition: text('condition'),
      conditionNote: text('conditionNote'),
    }, 'PUT'), saved);
  }

  return <ContentPanel title="Thông số mặt sân & tình trạng" icon={ClipboardList}>
    <p className="text-sm leading-6 text-muted-foreground">Thông tin do bạn khai báo, không phải chứng nhận. Tình trạng chỉ là nhãn; hãy tạo lịch khóa ở trang lịch sân để chặn đặt.</p>
    {maintenance && !court.hasActiveMaintenanceBlock && <p className="rounded-lg bg-caution-bg p-4 text-sm leading-6 text-caution" role="status">Đã khai báo bảo trì nhưng chưa có lịch khóa đang hiệu lực. Hãy tạo lịch khóa để chặn đặt sân.</p>}
    <form onSubmit={save} className="flex min-w-0 flex-col gap-4">
      <fieldset className="flex min-w-0 flex-col gap-5" disabled={action.busy}>
        <div className="grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-2"><Label htmlFor={prefix + 'surfaceType'} className="text-sm font-semibold">Vật liệu mặt sân</Label><Select id={prefix + 'surfaceType'} name="surfaceType" defaultValue={court.surfaceType ?? ''} options={surfaceOptions} /></div>
          <div className="flex min-w-0 flex-col gap-2"><Label htmlFor={prefix + 'surfaceBrand'} className="text-sm font-semibold">Thương hiệu</Label><Input id={prefix + 'surfaceBrand'} name="surfaceBrand" defaultValue={court.surfaceBrand ?? ''} maxLength={120} /></div>
          <div className="flex min-w-0 flex-col gap-2"><Label htmlFor={prefix + 'surfaceModel'} className="text-sm font-semibold">Dòng sản phẩm</Label><Input id={prefix + 'surfaceModel'} name="surfaceModel" defaultValue={court.surfaceModel ?? ''} maxLength={120} /></div>
          <div className="flex min-w-0 flex-col gap-2"><Label htmlFor={prefix + 'surfaceThicknessMm'} className="text-sm font-semibold">Độ dày (mm)</Label><Input id={prefix + 'surfaceThicknessMm'} name="surfaceThicknessMm" type="number" min="0.1" max="50" step="0.1" defaultValue={court.surfaceThicknessMm ?? ''} /></div>
          <div className="flex min-w-0 flex-col gap-2"><Label htmlFor={prefix + 'condition'} className="text-sm font-semibold">Tình trạng</Label><Select id={prefix + 'condition'} name="condition" defaultValue={court.condition ?? ''} options={conditionOptions} /></div>
          <div className="flex min-w-0 flex-col gap-2 sm:col-span-2"><Label htmlFor={prefix + 'conditionNote'} className="text-sm font-semibold">Ghi chú tình trạng (bắt buộc khi cần/đang bảo trì)</Label><Textarea id={prefix + 'conditionNote'} name="conditionNote" defaultValue={court.conditionNote ?? ''} maxLength={2000} /></div>
        </div>
        <Button className="h-11 self-start" type="submit">{action.busy ? 'Đang lưu…' : 'Lưu thông số sân'}</Button>
        <p className="text-xs text-muted-foreground">Phiên bản hồ sơ hiện tại: {court.profileVersion}. Nếu người khác vừa sửa, hệ thống sẽ yêu cầu tải lại.</p>
      </fieldset>
      <Feedback {...action} />
    </form>
  </ContentPanel>;
}
