import { useEffect, useState } from 'react';
import { AdminDialog, AdminDialogFooter } from '../AdminDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { adminFacilityService } from '../../services/adminFacilityService';
import type { Court, CourtProfileChange, Facility } from '../../types/facility';

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

interface Props {
  isOpen: boolean;
  facilityId: number | null;
  onClose: () => void;
  onSaved: () => void;
}

export function FacilityCourtProfileDialog({ isOpen, facilityId, onClose, onSaved }: Props) {
  const [facility, setFacility] = useState<Facility | null>(null);
  const [court, setCourt] = useState<Court | null>(null);
  const [history, setHistory] = useState<CourtProfileChange[]>([]);
  const [surfaceType, setSurfaceType] = useState('');
  const [surfaceBrand, setSurfaceBrand] = useState('');
  const [surfaceModel, setSurfaceModel] = useState('');
  const [thickness, setThickness] = useState('');
  const [condition, setCondition] = useState('');
  const [conditionNote, setConditionNote] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async (courtId?: number) => {
    if (!facilityId) return;
    setError('');
    const detail = await adminFacilityService.getFacilityById(facilityId);
    const courts = (detail.data.courts ?? []).filter(item => !item.deletedAt);
    setFacility({ ...detail.data, courts });
    const next = courts.find(item => item.id === courtId) ?? courts[0] ?? null;
    selectCourt(next);
    if (next) await loadHistory(next.id);
  };

  const loadHistory = async (courtId: number) => {
    if (!facilityId) return;
    const res = await adminFacilityService.getCourtProfileHistory(facilityId, courtId);
    setHistory(res.data);
  };

  const selectCourt = (next: Court | null) => {
    setCourt(next);
    setSurfaceType(next?.surfaceType ?? '');
    setSurfaceBrand(next?.surfaceBrand ?? '');
    setSurfaceModel(next?.surfaceModel ?? '');
    setThickness(next?.surfaceThicknessMm ?? '');
    setCondition(next?.condition ?? '');
    setConditionNote(next?.conditionNote ?? '');
    setReason('');
    setError('');
  };

  useEffect(() => {
    if (!isOpen) return;
    setFacility(null);
    setHistory([]);
    void load().catch((err: Error) => setError(err.message || 'Không thể tải thông số sân'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, facilityId]);

  const save = async () => {
    if (!facilityId || !court) return;
    if (!reason.trim()) { setError('Vui lòng nhập lý do chỉnh sửa của Admin.'); return; }
    setBusy(true);
    setError('');
    try {
      await adminFacilityService.updateCourtProfile(facilityId, court.id, {
        profileVersion: court.profileVersion,
        surfaceType: surfaceType || null,
        surfaceBrand: surfaceBrand.trim() || null,
        surfaceModel: surfaceModel.trim() || null,
        surfaceThicknessMm: thickness.trim() === '' ? null : Number(thickness),
        condition: condition || null,
        conditionNote: conditionNote.trim() || null,
        reason: reason.trim(),
      });
      await load(court.id);
      onSaved();
    } catch (err: any) {
      setError(err.message || 'Không thể lưu thông số sân');
    } finally {
      setBusy(false);
    }
  };

  const courts = (facility?.courts ?? []).filter(item => !item.deletedAt);

  return <AdminDialog open={isOpen} onClose={onClose} title="Thông số mặt sân & tình trạng" description={facility?.name}>
    {!facility ? (error
      ? <p className="rounded-lg bg-danger-bg p-4 text-sm text-danger" role="alert">{error}</p>
      : <p className="text-sm text-muted-foreground">Đang tải…</p>) : <div className="space-y-5">
      <div className="flex flex-wrap gap-2">{courts.map(item => <Button key={item.id} type="button" variant={item.id === court?.id ? 'brand' : 'outline'} onClick={() => { selectCourt(item); void loadHistory(item.id); }}>{item.name}</Button>)}</div>
      {!court ? <p className="text-sm text-muted-foreground">Cơ sở chưa có sân.</p> : <>
        <div className="flex flex-wrap items-center gap-2 text-sm"><Badge>{court.status}</Badge><span>Phiên bản hồ sơ: {court.profileVersion}</span>{court.condition && <Badge>{conditionOptions.find(option => option.value === court.condition)?.label ?? court.condition}</Badge>}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm font-semibold">Vật liệu<Select value={surfaceType} onChange={setSurfaceType} options={surfaceOptions} /></label>
          <label className="flex flex-col gap-2 text-sm font-semibold">Độ dày (mm)<Input type="number" min="0.1" max="50" step="0.1" value={thickness} onChange={event => setThickness(event.target.value)} /></label>
          <label className="flex flex-col gap-2 text-sm font-semibold">Thương hiệu<Input value={surfaceBrand} onChange={event => setSurfaceBrand(event.target.value)} maxLength={120} /></label>
          <label className="flex flex-col gap-2 text-sm font-semibold">Dòng sản phẩm<Input value={surfaceModel} onChange={event => setSurfaceModel(event.target.value)} maxLength={120} /></label>
          <label className="flex flex-col gap-2 text-sm font-semibold">Tình trạng<Select value={condition} onChange={setCondition} options={conditionOptions} /></label>
          <label className="flex flex-col gap-2 text-sm font-semibold sm:col-span-2">Ghi chú tình trạng<Textarea value={conditionNote} onChange={event => setConditionNote(event.target.value)} maxLength={2000} /></label>
          <label className="flex flex-col gap-2 text-sm font-semibold sm:col-span-2">Lý do chỉnh sửa *<Textarea value={reason} onChange={event => setReason(event.target.value)} maxLength={1000} placeholder="Bắt buộc với thao tác của Admin" /></label>
        </div>
        <Alert variant="warning">Nhãn tình trạng không khóa booking. Lịch khóa bảo trì vẫn do chủ sân quản lý tại trang lịch sân.</Alert>
        {error && <p className="rounded-lg bg-danger-bg p-4 text-sm text-danger" role="alert">{error}</p>}
        <div className="space-y-2"><h3 className="text-sm font-bold">Lịch sử gần nhất</h3>{history.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có thay đổi.</p> : history.map(change => <p key={change.id} className="text-sm text-muted-foreground">{new Date(change.createdAt).toLocaleString('vi-VN')} · {change.changeType === 'PROFILE' ? 'Thông số' : 'Tình trạng'} · {change.actorEmail ?? ''}{change.reason ? ` · ${change.reason}` : ''}</p>)}</div>
        <AdminDialogFooter><Button type="button" variant="outline" onClick={onClose} disabled={busy}>Đóng</Button><Button type="button" onClick={() => void save()} disabled={busy}>{busy ? 'Đang lưu…' : 'Lưu thông số'}</Button></AdminDialogFooter>
      </>}
    </div>}
  </AdminDialog>;
}
