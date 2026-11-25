import { useMemo, useState, type CSSProperties } from 'react';
import { AlertTriangle, CalendarClock, LoaderCircle, Shuffle } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { cn } from '@/shared/utils/cn';
import {
  WARNING_LABEL, formatDay, formatTime, fromLocalInput, minutesToHHmm, roundName, toLocalInput, vnDateKey, vnMinutes,
} from '../format';
import { useBracket, useSchedule, useTournamentMutation } from '../queries';
import { tournamentApi } from '../tournament-api';
import type { BracketMatch, ScheduleItem, ScheduleWarning, TournamentDetail } from '../types';
import { Notice, Panel, sideName } from '../components/shared';

/** Court × time board with click-to-edit and conflict warnings (PRD FR-41/42, Tech Design §7.3/§7.4). */
const PX_PER_MIN = 1.3;
const EASE = [0.2, 0.8, 0.2, 1] as const;

export function ScheduleBoard({ tournament: t }: { tournament: TournamentDetail }) {
  const reduce = useReducedMotion();
  const drawn = ['READY', 'IN_PROGRESS', 'COMPLETED'].includes(t.status);
  const schedule = useSchedule(t.id, t.status, drawn);
  const bracket = useBracket(t.id, t.status, drawn);
  const [day, setDay] = useState<string | null>(null);
  const [editing, setEditing] = useState<ScheduleItem | null>(null);
  const [confirmRerun, setConfirmRerun] = useState(false);
  const rerun = useTournamentMutation(t.id, () => tournamentApi.rerunSchedule(t.id, t.version), 'Đã xếp lại lịch các trận chưa đánh.');

  const items = useMemo(() => schedule.data?.matches ?? [], [schedule.data]);
  const warnings = schedule.data?.warnings ?? [];
  const byMatch = useMemo(() => new Map((bracket.data?.rounds.flatMap(r => r.matches) ?? []).map(x => [x.id, x])), [bracket.data]);
  const days = useMemo(() => [...new Set(items.map(i => vnDateKey(i.scheduledAt)))].sort(), [items]);
  const activeDay = day && days.includes(day) ? day : days[0];
  const dayItems = useMemo(() => items.filter(i => vnDateKey(i.scheduledAt) === activeDay), [items, activeDay]);
  const courts = useMemo(() => {
    const virtual = Array.from({ length: t.schedule.courtCount }, (_, i) => `Sân ${i + 1}`);
    const extra = [...new Set(dayItems.map(i => i.courtLabel ?? '—'))].filter(c => !virtual.some(v => v.toLowerCase() === c.trim().toLowerCase()));
    return [...virtual, ...extra];
  }, [dayItems, t.schedule.courtCount]);

  if (!drawn) return <Panel title="Lịch thi đấu"><Notice tone="caution">Lịch được tạo tự động khi bốc thăm.</Notice></Panel>;
  if (schedule.isPending || bracket.isPending) return <Panel title="Lịch thi đấu"><Skeleton className="h-96 rounded-lg" /></Panel>;

  const [startH, startM] = t.schedule.dailyStartTime.split(':').map(Number);
  const dayStart = Math.min(startH * 60 + startM, ...dayItems.map(i => vnMinutes(i.scheduledAt)));
  const dayEnd = Math.max(dayStart + 120, ...dayItems.map(i => vnMinutes(i.scheduledAt) + (schedule.data?.matchDurationMinutes ?? 45)));
  const ticks: number[] = [];
  for (let mnt = Math.floor(dayStart / 30) * 30; mnt <= dayEnd; mnt += 30) ticks.push(mnt);
  const heightStyle: CSSProperties = { height: (dayEnd - dayStart) * PX_PER_MIN + 16 };
  const columnsStyle: CSSProperties = { gridTemplateColumns: `4rem repeat(${courts.length}, minmax(11rem, 1fr))` };
  const warnFor = (id: number) => warnings.filter(w => w.matchId === id);
  const canEdit = t.status === 'READY' || t.status === 'IN_PROGRESS';

  return <Panel title="Lịch thi đấu"
    action={canEdit && <Button type="button" variant="outline" className="h-10" onClick={() => setConfirmRerun(true)}><Shuffle aria-hidden="true" />Xếp lại tự động</Button>}>
    <p className="-mt-2 mb-4 text-sm text-muted-foreground">{t.schedule.courtCount} sân ảo · {t.schedule.matchDurationMinutes} phút/trận · nghỉ ≥ {t.schedule.minRestMinutes} phút · {t.schedule.dailyStartTime}–{t.schedule.dailyEndTime}</p>
    {warnings.length > 0
      ? <Notice tone="caution" icon={AlertTriangle} className="mb-4">{warnings.length} cảnh báo lịch. Trận có biểu tượng cảnh báo — bấm để xem và sửa. Cảnh báo không chặn việc lưu.</Notice>
      : <Notice tone="success" icon={CalendarClock} className="mb-4">Lịch hợp lệ: không trùng sân, không trùng người, đủ thời gian nghỉ.</Notice>}
    {days.length > 1 && <div role="tablist" aria-label="Ngày thi đấu" className="mb-3 flex gap-1 overflow-x-auto">
      {days.map(d => <button key={d} type="button" role="tab" aria-selected={d === activeDay} onClick={() => setDay(d)}
        className={cn('min-h-10 shrink-0 rounded-lg px-3 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring', d === activeDay ? 'bg-brand-forest text-primary-foreground' : 'bg-muted text-muted-foreground')}>
        {formatDay(`${d}T05:00:00Z`)}</button>)}
    </div>}

    <div className="overflow-x-auto rounded-2xl border border-border">
      <div className="grid min-w-max" style={columnsStyle}>
        <div className="sticky top-0 z-10 border-b border-border bg-background px-2 py-2 text-xs font-bold text-muted-foreground">Giờ</div>
        {courts.map(c => <div key={c} className="sticky top-0 z-10 border-b border-l border-border bg-background px-3 py-2 text-sm font-bold">{c}</div>)}
        <div className="relative border-r border-border" style={heightStyle}>
          {ticks.map(tick => <TimeTick key={tick} minute={tick} origin={dayStart} />)}
        </div>
        {courts.map(court => <div key={court} className="relative border-l border-border bg-linear-to-b from-transparent to-background/60" style={heightStyle}>
          {ticks.map(tick => <GridLine key={tick} minute={tick} origin={dayStart} />)}
          {dayItems.filter(i => (i.courtLabel ?? '—').trim().toLowerCase() === court.toLowerCase()).map((item, i) =>
            <Block key={item.id} item={item} match={byMatch.get(item.id)} total={bracket.data?.totalRounds ?? 1} origin={dayStart}
              duration={schedule.data!.matchDurationMinutes} warnings={warnFor(item.id)} delay={reduce ? 0 : i * 0.04}
              onEdit={canEdit && item.status === 'CONFIRMED' && item.resolution === 'UNRESOLVED' ? () => setEditing(item) : undefined} />)}
        </div>)}
      </div>
    </div>
    <ul className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
      <li className="flex items-center gap-1.5"><span className="size-3 rounded border border-brand-mint bg-brand-light" />Chưa đánh (bấm để sửa)</li>
      <li className="flex items-center gap-1.5"><span className="size-3 rounded border border-danger/40 bg-danger-bg" />Đang đánh</li>
      <li className="flex items-center gap-1.5"><span className="size-3 rounded bg-muted" />Đã xong / huỷ</li>
      <li className="flex items-center gap-1.5"><span className="size-3 rounded border border-caution bg-caution-bg" />Có cảnh báo</li>
    </ul>

    {editing && <EditDialog tournament={t} item={editing} match={byMatch.get(editing.id)} total={bracket.data?.totalRounds ?? 1} onClose={() => setEditing(null)} />}
    {confirmRerun && <ConfirmDialog title="Xếp lại tự động?" confirmLabel="Xếp lại" busyLabel="Đang xếp…" busy={rerun.isPending}
      description={<><p>Các trận <b>chưa đánh</b> được xếp lại từ bây giờ (làm tròn 5 phút) hoặc từ giờ bắt đầu giải; trận đang đánh và đã xong giữ nguyên.</p><p className="font-semibold">Các chỉnh tay của trận chưa đánh sẽ bị ghi đè.</p></>}
      onCancel={() => setConfirmRerun(false)} onConfirm={() => rerun.mutate(undefined, { onSettled: () => setConfirmRerun(false) })} />}
    <span className="sr-only" aria-live="polite">{rerun.isSuccess ? 'Đã xếp lại lịch.' : ''}</span>
    {!reduce && rerun.isPending && <m.div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-50 h-1 bg-brand-lime" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, ease: EASE }} />}
  </Panel>;
}

function TimeTick({ minute, origin }: { minute: number; origin: number }) {
  const style: CSSProperties = { top: (minute - origin) * PX_PER_MIN + 8 };
  return <span className="absolute right-2 -translate-y-1/2 text-2xs tabular-nums text-muted-foreground" style={style}>{minutesToHHmm(minute)}</span>;
}

function GridLine({ minute, origin }: { minute: number; origin: number }) {
  const style: CSSProperties = { top: (minute - origin) * PX_PER_MIN + 8 };
  return <span aria-hidden="true" className="absolute inset-x-0 border-t border-dashed border-muted" style={style} />;
}

function Block({ item, match, total, origin, duration, warnings, delay, onEdit }: {
  item: ScheduleItem; match?: BracketMatch; total: number; origin: number; duration: number; warnings: ScheduleWarning[]; delay: number; onEdit?: () => void;
}) {
  const reduce = useReducedMotion();
  const style: CSSProperties = { top: (vnMinutes(item.scheduledAt) - origin) * PX_PER_MIN + 8, height: duration * PX_PER_MIN - 4 };
  const live = item.status === 'IN_PROGRESS';
  const done = item.status === 'COMPLETED' || item.status === 'CANCELLED';
  const title = `${formatTime(item.scheduledAt)} · ${roundName(item.roundIndex, total)}`;
  const sides = match ? `${sideName(match.slot1.players, match.slot1.teamName)} – ${sideName(match.slot2.players, match.slot2.teamName)}` : 'Chờ đối thủ';
  const Tag = onEdit ? m.button : m.div;
  return <Tag type={onEdit ? 'button' : undefined} onClick={onEdit} style={style}
    initial={reduce ? false : { opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.3, ease: EASE, delay }}
    whileHover={onEdit && !reduce ? { scale: 1.02 } : undefined}
    aria-label={onEdit ? `Sửa lịch: ${title}, ${sides}` : undefined}
    className={cn('absolute inset-x-1.5 overflow-hidden rounded-lg border px-2 py-1.5 text-left text-xs shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
      warnings.length > 0 ? 'border-caution bg-caution-bg' : live ? 'border-danger/40 bg-danger-bg' : done ? 'border-border bg-muted' : 'border-brand-mint bg-brand-light',
      onEdit && 'cursor-pointer hover:shadow-md')}>
    <span className="flex items-center justify-between gap-1 font-bold text-brand-forest">
      <span className="truncate">{title}</span>
      {warnings.length > 0 && <AlertTriangle aria-label={warnings.map(w => WARNING_LABEL[w.code]).join('; ')} className="size-3.5 shrink-0 text-caution" />}
      {live && <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-danger motion-safe:animate-pulse" />}
    </span>
    <span className="mt-0.5 block truncate text-muted-foreground">{sides}</span>
  </Tag>;
}

function EditDialog({ tournament: t, item, match, total, onClose }: { tournament: TournamentDetail; item: ScheduleItem; match?: BracketMatch; total: number; onClose: () => void }) {
  const [court, setCourt] = useState(item.courtLabel ?? '');
  const [at, setAt] = useState(toLocalInput(item.scheduledAt));
  const [result, setResult] = useState<ScheduleWarning[] | null>(null);
  const save = useTournamentMutation(t.id, () => tournamentApi.editMatchSchedule(t.id, item.id, court.trim(), fromLocalInput(at)));
  const submit = () => save.mutate(undefined, { onSuccess: r => setResult(r.warnings ?? []) });
  return <Dialog open onOpenChange={open => { if (!open && !save.isPending) onClose(); }}>
    <DialogContent closeDisabled={save.isPending}>
      <DialogTitle>Sửa lịch · {roundName(item.roundIndex, total)}</DialogTitle>
      <DialogDescription>{match ? `${sideName(match.slot1.players, match.slot1.teamName)} vs ${sideName(match.slot2.players, match.slot2.teamName)}` : 'Chờ đối thủ'}</DialogDescription>
      {result === null ? <>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5"><Label htmlFor="edit-court">Sân</Label>
            <Input id="edit-court" className="h-11" maxLength={40} value={court} onChange={e => setCourt(e.target.value)} placeholder="Sân 3 hoặc Sân VIP" />
            <p className="text-xs text-muted-foreground">Nhập tự do.</p></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="edit-time">Giờ bắt đầu</Label>
            <Input id="edit-time" type="datetime-local" className="h-11" value={at} onChange={e => setAt(e.target.value)} /></div>
        </div>
        <div className="mt-6 flex justify-end gap-2">
          <Button type="button" variant="ghost" className="h-11" onClick={onClose} disabled={save.isPending}>Huỷ</Button>
          <Button type="button" variant="brand" className="h-11" onClick={submit} disabled={save.isPending || !court.trim() || !at}>
            {save.isPending && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}Lưu</Button>
        </div>
      </> : <>
        {result.filter(w => w.matchId === item.id || w.otherMatchId === item.id).length === 0
          ? <Notice tone="success" className="mt-5">Đã lưu. Không có xung đột.</Notice>
          : <div className="mt-5 grid gap-2">
            <Notice tone="caution" icon={AlertTriangle}>Đã lưu, nhưng có cảnh báo:</Notice>
            <ul className="list-disc pl-6 text-sm">{[...new Set(result.filter(w => w.matchId === item.id || w.otherMatchId === item.id).map(w => WARNING_LABEL[w.code]))].map(label => <li key={label}>{label}</li>)}</ul>
          </div>}
        <div className="mt-6 flex justify-end"><Button type="button" className="h-11" onClick={onClose}>Đóng</Button></div>
      </>}
    </DialogContent>
  </Dialog>;
}
