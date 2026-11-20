import { useId, useState, type ReactNode } from 'react';
import { RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { FeedFilters as Filters } from '../types';
import type { SkillLevel } from '../../matchmaking/types/matchmaking';

const fieldClass = 'h-11 rounded-lg bg-card px-3 text-sm motion-safe:focus-visible:translate-y-0';

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1.5"><Label htmlFor={id} className="text-xs font-semibold text-muted-foreground">{label}</Label>{children}</div>;
}

export function FeedFilters({ value, skills, onApply, showTitle = true }: { value: Filters; skills: SkillLevel[]; onApply: (value: Filters) => void; showTitle?: boolean }) {
  const [draft, setDraft] = useState(value);
  const id = useId();
  const change = (key: string, text: string) => setDraft(current => ({ ...current, [key]: text }));
  const select = (key: string, placeholder: string, options: { value: string; label: string }[]) => <Field id={`${id}-${key}`} label={placeholder}>
    <select id={`${id}-${key}`} value={draft[key] ?? ''} onChange={event => change(key, event.target.value)}
      className="h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 text-sm text-foreground outline-none hover:border-ring/40 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/10">
      <option value="">Tất cả</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  </Field>;
  const check = (key: string, label: string) => <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm font-medium">
    <input type="checkbox" className="size-4.5 shrink-0 accent-primary" checked={draft[key] === 'true'} onChange={event => change(key, event.target.checked ? 'true' : '')} />{label}
  </label>;
  return <form className="flex flex-col gap-4" onSubmit={event => {
    event.preventDefault();
    const clean = Object.fromEntries(Object.entries(draft).filter(([, text]) => text.trim()).map(([key, text]) => [key, text.trim()]));
    if (Object.keys(clean).some(key => ['matchType', 'date', 'timeFrom', 'timeTo', 'city', 'district', 'skillLevelId', 'hasOpenSlots'].includes(key))) clean.type = 'MATCH_FINDING';
    onApply(clean);
  }}>
    {showTitle && <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight"><SlidersHorizontal aria-hidden="true" className="size-5 text-primary" />Lọc bài viết</h2>}
    {select('type', 'Loại bài', [{ value: 'FREE', label: 'Chia sẻ' }, { value: 'MATCH_FINDING', label: 'Tìm người chơi' }])}
    {select('matchType', 'Loại kèo', [{ value: 'SINGLES', label: 'Đơn' }, { value: 'DOUBLES', label: 'Đôi' }, { value: 'GROUP', label: 'Giao lưu' }])}
    {select('skillLevelId', 'Trình độ', skills.map(skill => ({ value: String(skill.id), label: skill.name })))}
    <Field id={`${id}-date`} label="Ngày chơi"><Input id={`${id}-date`} type="date" className={fieldClass} value={draft.date ?? ''} onChange={event => change('date', event.target.value)} /></Field>
    <div className="grid grid-cols-2 gap-3">
      <Field id={`${id}-from`} label="Từ giờ"><Input id={`${id}-from`} type="time" className={fieldClass} value={draft.timeFrom ?? ''} onChange={event => change('timeFrom', event.target.value)} /></Field>
      <Field id={`${id}-to`} label="Đến giờ"><Input id={`${id}-to`} type="time" className={fieldClass} min={draft.timeFrom} value={draft.timeTo ?? ''} onChange={event => change('timeTo', event.target.value)} /></Field>
    </div>
    <Field id={`${id}-city`} label="Tỉnh / thành phố"><Input id={`${id}-city`} className={fieldClass} value={draft.city ?? ''} maxLength={100} onChange={event => change('city', event.target.value)} placeholder="Nhập tỉnh / thành phố" /></Field>
    <Field id={`${id}-district`} label="Quận / huyện"><Input id={`${id}-district`} className={fieldClass} value={draft.district ?? ''} maxLength={100} onChange={event => change('district', event.target.value)} placeholder="Nhập quận / huyện" /></Field>
    <div className="flex flex-col gap-1">{check('hasOpenSlots', 'Chỉ kèo còn chỗ')}{check('includeEnded', 'Bao gồm kèo đã kết thúc')}</div>
    <div className="flex flex-col gap-2">
      <Button type="submit" className="h-11">Áp dụng bộ lọc</Button>
      <Button type="button" variant="ghost" className="h-11" onClick={() => { setDraft({}); onApply({}); }}><RotateCcw aria-hidden="true" />Xóa bộ lọc</Button>
    </div>
    <p className="text-xs leading-5 text-muted-foreground">Bài công khai mới nhất hiển thị trước. Bộ lọc kèo chỉ tìm bài tìm người chơi.</p>
  </form>;
}
