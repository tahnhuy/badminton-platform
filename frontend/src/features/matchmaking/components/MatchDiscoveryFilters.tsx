import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { Building2, CalendarDays, ChevronDown, MapPin, RotateCcw, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { NativeSelect } from '@/components/ui/native-select';
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import type { SkillLevel } from '../types/matchmaking';

import { DiscoveryAreaField, citySuggestions, districtSuggestions } from './DiscoveryAreaField';

export type DiscoveryFilters = Record<string, string>;

const hint = 'text-xs leading-5 text-muted-foreground';

function Field({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1.5"><Label htmlFor={id} className="pl-3 text-xs font-semibold text-muted-foreground">{label}</Label>{children}</div>;
}

/** Compact filter bar: core location/date/level first, the rest behind "Bộ lọc khác". */
export function MatchDiscoveryFilters({ value, skills, onApply }: { value: DiscoveryFilters; skills: SkillLevel[]; onApply: (value: DiscoveryFilters, options?: { replace?: boolean }) => void }) {
  const [draft, setDraft] = useState(value);
  const [expanded, setExpanded] = useState(false);
  const latest = useRef({ value, onApply, draft });
  // Declared before the effects below so they always read the committed props/draft.
  useEffect(() => { latest.current = { value, onApply, draft }; });
  const appliedKey = JSON.stringify(value);
  useEffect(() => { setDraft(latest.current.value); }, [appliedKey]);
  useEffect(() => {
    const city = (draft.city ?? '').trim();
    const district = (draft.district ?? '').trim();
    if (city === (latest.current.value.city ?? '') && district === (latest.current.value.district ?? '')) return;
    const timer = window.setTimeout(() => {
      // Apply the whole draft: the sync effect above replaces the draft with the applied
      // value, which would otherwise silently drop unsubmitted level/date/type choices.
      const pending = latest.current.draft;
      if (pending.timeFrom && pending.timeTo && pending.timeFrom >= pending.timeTo) return;
      const next = Object.fromEntries(Object.entries(pending).map(([key, text]) => [key, text.trim()]).filter(([, text]) => text));
      latest.current.onApply(next, { replace: true });
    }, 400);
    return () => window.clearTimeout(timer);
  }, [draft.city, draft.district]);
  const id = useId();
  const desktop = useMediaQuery('(min-width: 48rem)');
  const formId = `${id}-form`;
  const [error, setError] = useState('');
  const change = (key: string, text: string) => setDraft(current => ({ ...current, [key]: key === 'hasOpenSlots' ? (text ? 'true' : 'false') : text }));
  const select = (key: string, label: string, options: { value: string; label: string }[]) => <Field id={`${id}-${key}`} label={label}>
    <NativeSelect className="h-10 border-0 bg-transparent shadow-none" id={`${id}-${key}`} value={draft[key] ?? ''} onChange={event => change(key, event.target.value)}>
      <option value="">Tất cả</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </NativeSelect>
  </Field>;
  const check = (key: string, label: string) => <label className="flex min-h-8 cursor-pointer items-center gap-2 text-sm font-medium">
    <input type="checkbox" className="size-4.5 shrink-0 accent-primary" checked={draft[key] === 'true'} onChange={event => change(key, event.target.checked ? 'true' : '')} />{label}
  </label>;
  const reset = () => {
    setDraft({ hasOpenSlots: 'true', sort: draft.sort ?? 'upcoming' });
    onApply({ hasOpenSlots: 'true', ...(draft.sort ? { sort: draft.sort } : {}) });
  };
  return <form id={formId} className="flex min-w-0 flex-col gap-3" onSubmit={event => {
    event.preventDefault();
    if (draft.timeFrom && draft.timeTo && draft.timeFrom >= draft.timeTo) { setError('Giờ kết thúc phải sau giờ bắt đầu.'); return; }
    setError('');
    setExpanded(false);
    const clean = Object.fromEntries(Object.entries(draft).filter(([, text]) => text.trim()).map(([key, text]) => [key, text.trim()]));
    onApply(clean);
  }}>
    <div className="grid min-w-0 items-stretch gap-2 rounded-2xl border border-border bg-card p-2.5 shadow-sm focus-within:border-primary/40 focus-within:ring-4 focus-within:ring-primary/10 min-[861px]:grid-cols-[1fr_1fr_1fr_1.2fr] min-[861px]:gap-0 min-[861px]:rounded-full min-[861px]:p-1 [&>div]:min-h-16 [&>div]:justify-center [&>div]:min-w-0 [&>div]:rounded-lg [&>div]:bg-soft [&>div]:px-4 [&>div]:py-1.5 min-[861px]:[&>div]:rounded-none min-[861px]:[&>div]:bg-transparent min-[861px]:[&>div]:border-r min-[861px]:[&>div]:border-border">
      <DiscoveryAreaField id={`${id}-city`} label="Tỉnh / thành phố" value={draft.city ?? ''} onChange={text => change('city', text)} suggestions={citySuggestions} placeholder="Hồ Chí Minh" icon={MapPin} />
      <DiscoveryAreaField id={`${id}-district`} label="Quận / huyện" value={draft.district ?? ''} onChange={text => change('district', text)} suggestions={districtSuggestions} placeholder="Gò Vấp" icon={Building2} />
      {select('skillLevelId', 'Trình độ', skills.map(skill => ({ value: String(skill.id), label: skill.name })))}
      <Dialog open={expanded} onOpenChange={next => { setExpanded(next); setError(''); }}>
        <DialogTrigger asChild><button type="button" className="flex min-w-0 flex-col min-h-16 justify-center gap-1 rounded-lg bg-soft px-5 py-1.5 text-left outline-none hover:bg-soft focus-visible:ring-2 focus-visible:ring-ring min-[861px]:rounded-full min-[861px]:bg-transparent"><span className="text-xs font-semibold text-muted-foreground">Ngày giờ & bộ lọc khác</span><span className="flex items-center gap-2 text-sm font-semibold"><CalendarDays aria-hidden="true" className="size-4 shrink-0 text-primary" /><span className="min-w-0 flex-1">{value.date ? value.date.split('-').reverse().join('/') : 'Tất cả ngày'}</span><ChevronDown aria-hidden="true" className="size-4 shrink-0" /></span></button></DialogTrigger>
        <DialogContent variant={desktop ? 'center' : 'sheet'} aria-describedby={`${id}-description`}>
          <DialogTitle>Ngày giờ và bộ lọc kèo</DialogTitle>
          <DialogDescription id={`${id}-description`}>Chọn lịch chơi và loại kèo phù hợp với bạn.</DialogDescription>
          <div className="mt-5 grid gap-4">
            <Field id={`${id}-date`} label="Ngày chơi"><Input form={formId} id={`${id}-date`} type="date" value={draft.date ?? ''} onChange={event => change('date', event.target.value)} /></Field>
      {select('matchType', 'Loại kèo', [{ value: 'SINGLES', label: 'Đơn' }, { value: 'DOUBLES', label: 'Đôi' }, { value: 'GROUP', label: 'Giao lưu' }])}
      <div className="grid grid-cols-2 gap-3">
        <Field id={`${id}-from`} label="Từ giờ"><Input id={`${id}-from`} type="time" form={formId} className="h-11" value={draft.timeFrom ?? ''} onChange={event => change('timeFrom', event.target.value)} /></Field>
        <Field id={`${id}-to`} label="Đến giờ"><Input id={`${id}-to`} type="time" form={formId} className="h-11" min={draft.timeFrom} value={draft.timeTo ?? ''} onChange={event => change('timeTo', event.target.value)} /></Field>
      </div>
      <div className="flex flex-col gap-1">{check('hasOpenSlots', 'Chỉ kèo còn chỗ')}{check('includeEnded', 'Bao gồm kèo đã kết thúc')}</div>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <div className="mt-6 flex gap-2"><Button type="submit" form={formId} variant="brand" className="h-12 flex-1">Áp dụng</Button><Button type="button" variant="ghost" className="h-12" onClick={() => { setDraft(value); setExpanded(false); }}>Hủy</Button></div>
        </DialogContent>
      </Dialog>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
      <p className={hint}>Kết quả cập nhật khi bạn gõ khu vực. Gõ một phần tên, có dấu — ví dụ “Gò Vấp”.</p>
      <div className="flex gap-2"><Button type="button" variant="ghost" className="h-10 text-xs text-muted-foreground" onClick={reset}><RotateCcw aria-hidden="true" />Xóa bộ lọc</Button><Button type="submit" className="h-10"><SlidersHorizontal aria-hidden="true" />Tìm kèo</Button></div>
    </div>
  </form>;
}
