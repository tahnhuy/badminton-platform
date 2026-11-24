import { useId, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { useReturnFocus } from '@/shared/hooks/use-return-focus';
import { cn } from '@/shared/utils/cn';
import { Notice } from '../../social/components/SocialUi';
import type { RecruitmentDetail, RecruitmentDraft, RecruitmentMatchType } from '../types/recruitment';
import type { SkillLevel } from '../types/matchmaking';

const control = 'h-11 rounded-lg bg-card px-3 text-sm motion-safe:focus-visible:translate-y-0';
function Field({ id, label, children, className }: { id: string; label: string; children: ReactNode; className?: string }) {
  return <div className={cn('flex min-w-0 flex-col gap-1.5', className)}><Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">{label}</Label>{children}</div>;
}

type Changes = Partial<Omit<RecruitmentDraft, 'court'>>;
const localStart = (value: string) => new Date(new Date(value).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16);

export function RecruitmentEdit({ detail, fieldsLocked, skills, busy, error, onClose, onSave }: {
  detail: RecruitmentDetail; fieldsLocked: boolean; skills: SkillLevel[]; busy: boolean;
  error: string; onClose: () => void; onSave: (changes: Changes) => void;
}) {
  const [matchType, setMatchType] = useState(detail.matchType);
  const [start, setStart] = useState(localStart(detail.startAt));
  const [capacity, setCapacity] = useState(detail.matchType === 'GROUP' ? detail.capacity : 8);
  const [minimum, setMinimum] = useState(detail.matchType === 'GROUP' ? detail.minPlayers : 4);
  const [duration, setDuration] = useState(detail.durationMinutes);
  const [companions, setCompanions] = useState(detail.companionCount);
  const [min, setMin] = useState(detail.minSkillLevelId);
  const [max, setMax] = useState(detail.maxSkillLevelId);
  const [cost, setCost] = useState(detail.costNote ?? '');
  const id = useId(); const returnFocus = useReturnFocus();
  const effectiveType = fieldsLocked ? detail.matchType : matchType;
  const effectiveCapacity = fieldsLocked ? detail.capacity : capacity;

  function save() {
    const changes: Changes = { minSkillLevelId: min, maxSkillLevelId: max, costNote: cost.trim() || null };
    if (!fieldsLocked) {
      if (matchType !== detail.matchType) changes.matchType = matchType;
      if (start !== localStart(detail.startAt)) changes.startAt = new Date(`${start}:00+07:00`).toISOString();
      if (effectiveType === 'GROUP' && (capacity !== detail.capacity || matchType !== detail.matchType)) changes.capacity = capacity;
    }
    if (effectiveType === 'GROUP') {
      changes.minPlayers = minimum; changes.durationMinutes = duration; changes.companionCount = companions;
    }
    onSave(changes);
  }

  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent closeDisabled={busy} className="max-h-[92dvh] max-w-xl overflow-y-auto" aria-describedby={undefined} onCloseAutoFocus={returnFocus}>
      <DialogTitle className="mb-5">Sửa thông tin kèo</DialogTitle>
      <form className="flex flex-col gap-4" onSubmit={event => { event.preventDefault(); save(); }}>
        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-4 disabled:opacity-75">
          <Notice>{fieldsLocked ? 'Giờ bắt đầu, loại kèo và sức chứa đã khóa từ lần đầu có thành viên xác nhận.' : 'Các thay đổi giờ bắt đầu, loại kèo và sức chứa chỉ được lưu khi kèo chưa từng có thành viên xác nhận.'}</Notice>
          <Field id={`${id}-type`} label="Loại kèo"><Select id={`${id}-type`} disabled={fieldsLocked} value={effectiveType} onChange={value => setMatchType(value as RecruitmentMatchType)} options={[
            { value: 'SINGLES', label: 'Đơn · Tổng 2' },
            { value: 'DOUBLES', label: 'Đôi · Tổng 4' },
            { value: 'GROUP', label: 'Giao lưu' },
          ]} /></Field>
          <Field id={`${id}-start`} label="Ngày giờ bắt đầu (Việt Nam)"><Input id={`${id}-start`} className={control} type="datetime-local" required disabled={fieldsLocked} value={fieldsLocked ? localStart(detail.startAt) : start} onChange={event => setStart(event.target.value)} /></Field>
          {effectiveType === 'GROUP' && <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Field id={`${id}-capacity`} label="Tổng số chỗ"><Input id={`${id}-capacity`} className={control} type="number" required min={3} disabled={fieldsLocked} value={effectiveCapacity} onChange={event => setCapacity(Number(event.target.value))} /></Field>
              <Field id={`${id}-minimum`} label="Tối thiểu để chốt"><Input id={`${id}-minimum`} className={control} type="number" required min={2} max={effectiveCapacity} value={minimum} onChange={event => setMinimum(Number(event.target.value))} /></Field>
              <Field id={`${id}-duration`} label="Thời lượng (phút)"><Input id={`${id}-duration`} className={control} type="number" required min={60} max={180} value={duration} onChange={event => setDuration(Number(event.target.value))} /></Field>
            </div>
            <Field id={`${id}-companions`} label="Người đi cùng"><Input id={`${id}-companions`} className={control} type="number" required min={0} max={effectiveCapacity - 2} value={companions} onChange={event => setCompanions(Number(event.target.value))} /></Field>
          </>}
          <div className="grid grid-cols-2 gap-3">
            <Field id={`${id}-min`} label="Từ trình độ"><Select id={`${id}-min`} value={String(min)} onChange={value => setMin(Number(value))} options={skills.map(skill => ({ value: String(skill.id), label: skill.name }))} /></Field>
            <Field id={`${id}-max`} label="Đến trình độ"><Select id={`${id}-max`} value={String(max)} onChange={value => setMax(Number(value))} options={skills.map(skill => ({ value: String(skill.id), label: skill.name }))} /></Field>
          </div>
          <Field id={`${id}-cost`} label="Ghi chú chi phí"><Input id={`${id}-cost`} className={control} maxLength={200} value={cost} onChange={event => setCost(event.target.value)} /></Field>
        </fieldset>
        {error && <Notice error>{error}</Notice>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" className="h-11" disabled={busy} onClick={onClose}>Hủy</Button>
          <Button className="h-11" disabled={busy || !skills.length}>Lưu thông tin kèo</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>;
}
