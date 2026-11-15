import { useState } from 'react';
import { Dialog } from '../../../components/common/Dialog';
import { Notice } from '../../social/components/SocialUi';
import type { RecruitmentDetail, RecruitmentDraft, RecruitmentMatchType } from '../types/recruitment';
import type { SkillLevel } from '../types/matchmaking';

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

  return <Dialog title="Sửa thông tin kèo" busy={busy} onClose={onClose}>
    <form className="social-form" onSubmit={event => { event.preventDefault(); save(); }}>
      <fieldset disabled={busy}>
        <Notice>{fieldsLocked ? 'Giờ bắt đầu, loại kèo và sức chứa đã khóa từ lần đầu có thành viên xác nhận.' : 'Các thay đổi giờ bắt đầu, loại kèo và sức chứa chỉ được lưu khi kèo chưa từng có thành viên xác nhận.'}</Notice>
        <label>Loại kèo<select aria-label="Loại kèo" disabled={fieldsLocked} value={effectiveType} onChange={event => setMatchType(event.target.value as RecruitmentMatchType)}>
          <option value="SINGLES">Đơn · Tổng 2</option><option value="DOUBLES">Đôi · Tổng 4</option><option value="GROUP">Giao lưu</option>
        </select></label>
        <label>Ngày giờ bắt đầu (Việt Nam)<input type="datetime-local" required disabled={fieldsLocked} value={fieldsLocked ? localStart(detail.startAt) : start} onChange={event => setStart(event.target.value)} /></label>
        {effectiveType === 'GROUP' && <>
          <div className="social-fields">
            <label>Tổng số chỗ<input type="number" required min={3} disabled={fieldsLocked} value={effectiveCapacity} onChange={event => setCapacity(Number(event.target.value))} /></label>
            <label>Tối thiểu để chốt<input type="number" required min={2} max={effectiveCapacity} value={minimum} onChange={event => setMinimum(Number(event.target.value))} /></label>
            <label>Thời lượng (phút)<input type="number" required min={60} max={180} value={duration} onChange={event => setDuration(Number(event.target.value))} /></label>
          </div>
          <label>Người đi cùng<input type="number" required min={0} max={effectiveCapacity - 2} value={companions} onChange={event => setCompanions(Number(event.target.value))} /></label>
        </>}
        <div className="social-fields">
          <label>Từ trình độ<select value={min} onChange={event => setMin(Number(event.target.value))}>{skills.map(skill => <option value={skill.id} key={skill.id}>{skill.name}</option>)}</select></label>
          <label>Đến trình độ<select value={max} onChange={event => setMax(Number(event.target.value))}>{skills.map(skill => <option value={skill.id} key={skill.id}>{skill.name}</option>)}</select></label>
        </div>
        <label>Ghi chú chi phí<input maxLength={200} value={cost} onChange={event => setCost(event.target.value)} /></label>
      </fieldset>
      {error && <Notice error>{error}</Notice>}
      <button className="social-button social-primary" disabled={busy || !skills.length}>Lưu thông tin kèo</button>
    </form>
  </Dialog>;
}
