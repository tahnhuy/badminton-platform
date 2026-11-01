import { useState } from 'react';
import { FilterToolbar } from '../../../components/common/FilterToolbar';
import type { FeedFilters as Filters } from '../types';
import type { SkillLevel } from '../../matchmaking/types/matchmaking';

export function FeedFilters({ value, skills, onApply }: { value: Filters; skills: SkillLevel[]; onApply: (value: Filters) => void }) {
  const [draft, setDraft] = useState(value);
  const change = (key: string, text: string) => setDraft(current => ({ ...current, [key]: text }));
  const select = (id: string, placeholder: string, options: { value: string; label: string }[]) => ({ id, placeholder, ariaLabel: placeholder, value: draft[id] ?? '', onChange: (text: string) => change(id, text), options });
  return <form className="social-card social-filters" onSubmit={event => {
    event.preventDefault();
    const clean = Object.fromEntries(Object.entries(draft).filter(([, text]) => text.trim()).map(([key, text]) => [key, text.trim()]));
    if (Object.keys(clean).some(key => ['matchType', 'date', 'timeFrom', 'timeTo', 'city', 'district', 'skillLevelId', 'hasOpenSlots'].includes(key))) clean.type = 'MATCH_FINDING';
    onApply(clean);
  }}><h2>Lọc bài viết</h2>
    <FilterToolbar filters={[
      select('type', 'Loại bài', [{ value: 'FREE', label: 'Chia sẻ' }, { value: 'MATCH_FINDING', label: 'Tìm người chơi' }]),
      select('matchType', 'Loại kèo', [{ value: 'SINGLES', label: 'Đơn' }, { value: 'DOUBLES', label: 'Đôi' }, { value: 'GROUP', label: 'Giao lưu' }]),
      select('skillLevelId', 'Trình độ', skills.map(skill => ({ value: String(skill.id), label: skill.name }))),
    ]} />
    <label>Ngày chơi<input type="date" value={draft.date ?? ''} onChange={e => change('date', e.target.value)} /></label>
    <div className="social-fields"><label>Từ giờ<input type="time" value={draft.timeFrom ?? ''} onChange={e => change('timeFrom', e.target.value)} /></label><label>Đến giờ<input type="time" min={draft.timeFrom} value={draft.timeTo ?? ''} onChange={e => change('timeTo', e.target.value)} /></label></div>
    <label>Tỉnh / thành phố<input value={draft.city ?? ''} maxLength={100} onChange={e => change('city', e.target.value)} placeholder="Nhập tỉnh / thành phố" /></label>
    <label>Quận / huyện<input value={draft.district ?? ''} maxLength={100} onChange={e => change('district', e.target.value)} placeholder="Nhập quận / huyện" /></label>
    <label className="social-check"><input type="checkbox" checked={draft.hasOpenSlots === 'true'} onChange={e => change('hasOpenSlots', e.target.checked ? 'true' : '')} />Chỉ kèo còn chỗ</label>
    <label className="social-check"><input type="checkbox" checked={draft.includeEnded === 'true'} onChange={e => change('includeEnded', e.target.checked ? 'true' : '')} />Bao gồm kèo đã kết thúc</label>
    <button className="social-button social-primary" type="submit">Áp dụng bộ lọc</button>
    <button className="social-button" type="button" onClick={() => { setDraft({}); onApply({}); }}>Xóa bộ lọc</button>
    <small>Bài công khai mới nhất hiển thị trước. Bộ lọc kèo chỉ tìm bài tìm người chơi.</small>
  </form>;
}
