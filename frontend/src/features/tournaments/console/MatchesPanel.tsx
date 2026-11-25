import { useMemo, useState } from 'react';
import { useNow } from '../use-now';
import { Ban, Crown, Flag, LoaderCircle, PencilLine, Play, Swords, Trophy, UserX } from 'lucide-react';
import { AnimatePresence, m, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { cn } from '@/shared/utils/cn';
import { formatDateTime, roundName } from '../format';
import { useBracket, useMatchResult, useTournamentMutation } from '../queries';
import { evaluateSets, type SetDraft } from '../score-rules';
import { tournamentApi } from '../tournament-api';
import type { BracketMatch, ResultInput, TournamentDetail } from '../types';
import { Notice, Panel, sideName } from '../components/shared';

const EASE = [0.2, 0.8, 0.2, 1] as const;
type Filter = 'todo' | 'live' | 'done' | 'all';
const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: 'todo', label: 'Cần xử lý' }, { value: 'live', label: 'Đang đánh' }, { value: 'done', label: 'Đã xong' }, { value: 'all', label: 'Tất cả' },
];

const playable = (x: BracketMatch) => x.slot1.registrationId !== null && x.slot2.registrationId !== null;
const resolved = (x: BracketMatch) => x.resolution !== 'UNRESOLVED';
const isByeMatch = (x: BracketMatch) => x.status === 'COMPLETED' && x.resolution === 'WALKOVER' && (x.slot1.registrationId === null || x.slot2.registrationId === null);

/** Match operations of the Organizer (PRD FR-50…56, Tech Design §7.5). */
export function MatchesPanel({ tournament: t }: { tournament: TournamentDetail }) {
  const reduce = useReducedMotion();
  const drawn = ['READY', 'IN_PROGRESS', 'COMPLETED'].includes(t.status);
  const bracket = useBracket(t.id, t.status, drawn);
  const [filter, setFilter] = useState<Filter>('todo');
  const [scoring, setScoring] = useState<BracketMatch | null>(null);
  const [starting, setStarting] = useState<BracketMatch | null>(null);
  const now = useNow(); // the 48 h correction window closes while the console stays open
  const start = useTournamentMutation(t.id, (id: number) => tournamentApi.startMatch(t.id, id), 'Trận đấu đã bắt đầu.');

  const all = useMemo(() => (bracket.data?.rounds.flatMap(r => r.matches) ?? []).filter(x => !isByeMatch(x))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt) || a.roundIndex - b.roundIndex || a.matchIndex - b.matchIndex), [bracket.data]);
  const counts: Record<Filter, number> = {
    todo: all.filter(x => !resolved(x) && playable(x)).length,
    live: all.filter(x => x.status === 'IN_PROGRESS').length,
    done: all.filter(resolved).length,
    all: all.length,
  };
  const shown = all.filter(x => filter === 'all' ? true : filter === 'todo' ? !resolved(x) && playable(x) : filter === 'live' ? x.status === 'IN_PROGRESS' : resolved(x));
  const total = bracket.data?.totalRounds ?? 1;
  // Before completion a result is frozen once its next match has started (backend assertCanRecord).
  const byId = useMemo(() => new Map((bracket.data?.rounds.flatMap(r => r.matches) ?? []).map(m => [m.id, m])), [bracket.data]);
  const nextStarted = (x: BracketMatch) => {
    if (t.status === 'COMPLETED' || x.nextMatchId === null) return false;
    const next = byId.get(x.nextMatchId);
    return next !== undefined && !(next.status === 'CONFIRMED' && next.resolution === 'UNRESOLVED');
  };
  const editable = t.status === 'READY' || t.status === 'IN_PROGRESS' || t.status === 'COMPLETED';
  const correctionOpen = t.status !== 'COMPLETED' || (t.completedAt !== null && now - new Date(t.completedAt).getTime() < 48 * 3_600_000);

  if (!drawn) return <Panel title="Trận đấu"><Notice tone="caution">Trận đấu xuất hiện sau khi bốc thăm.</Notice></Panel>;
  if (bracket.isPending) return <Panel title="Trận đấu"><div className="grid gap-2">{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}</div></Panel>;

  return <Panel title="Trận đấu">
    {t.status === 'COMPLETED' && <Notice tone={correctionOpen ? 'info' : 'caution'} className="mb-4">
      {correctionOpen ? 'Giải đã kết thúc: trong 48 giờ chỉ sửa được tỉ số (không đổi người thắng), riêng trận chung kết được sửa cả người thắng.' : 'Đã quá 48 giờ sau khi kết thúc — kết quả đã khoá.'}
    </Notice>}
    <div role="tablist" aria-label="Lọc trận" className="mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-muted p-1">
      {FILTERS.map(f => <button key={f.value} type="button" role="tab" aria-selected={filter === f.value} onClick={() => setFilter(f.value)}
        className={cn('relative min-h-10 shrink-0 whitespace-nowrap rounded-lg px-3 text-sm font-semibold outline-none sm:flex-1 transition-colors focus-visible:ring-2 focus-visible:ring-ring', filter === f.value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground')}>
        {filter === f.value && <m.span layoutId="match-filter" aria-hidden="true" className="absolute inset-0 rounded-lg bg-card shadow-sm" transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />}
        <span className="relative">{f.label} <span className="tabular-nums text-muted-foreground">{counts[f.value]}</span></span>
      </button>)}
    </div>
    {shown.length === 0 ? <EmptyState icon={Swords} title={filter === 'todo' ? (counts.done === counts.all ? 'Tất cả trận đã có kết quả' : 'Không còn trận cần xử lý') : 'Không có trận nào'}
        description={filter !== 'todo' ? 'Đổi bộ lọc để xem trận khác.' : counts.done === counts.all ? (t.status === 'IN_PROGRESS' ? 'Sang mục "Kết thúc giải" để hoàn tất giải.' : 'Kết quả có thể sửa ở bộ lọc "Đã xong".') : 'Các trận còn lại đang chờ người thắng từ vòng trước.'} />
      : <ul className="grid gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {shown.map((x, i) => <m.li key={x.id} layout={!reduce} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.25, ease: EASE, delay: reduce ? 0 : Math.min(i, 10) * 0.02 }}>
            <MatchRow match={x} total={total}
              onStart={t.status !== 'COMPLETED' && x.status === 'CONFIRMED' && !resolved(x) && playable(x) ? () => setStarting(x) : undefined}
              onScore={editable && playable(x) && (x.status !== 'CANCELLED' || t.status !== 'COMPLETED') && (resolved(x) ? correctionOpen && !nextStarted(x) : t.status !== 'COMPLETED') ? () => setScoring(x) : undefined} />
          </m.li>)}
        </AnimatePresence>
      </ul>}

    {starting && <ConfirmDialog title="Bắt đầu trận?" confirmLabel="Bắt đầu" busyLabel="Đang bắt đầu…" busy={start.isPending}
      description={<p><b>{sideName(starting.slot1.players, starting.slot1.teamName)}</b> vs <b>{sideName(starting.slot2.players, starting.slot2.teamName)}</b> · {starting.courtLabel ?? 'chưa có sân'}. Trận chuyển sang "Đang đánh"{t.status === 'READY' ? ' và giải chuyển sang "Đang diễn ra"' : ''}.</p>}
      onCancel={() => setStarting(null)} onConfirm={() => start.mutate(starting.id, { onSettled: () => setStarting(null) })} />}
    {scoring && <ScoreDialog tournament={t} match={scoring} total={total} onClose={() => setScoring(null)} />}
  </Panel>;
}

function MatchRow({ match: x, total, onStart, onScore }: { match: BracketMatch; total: number; onStart?: () => void; onScore?: () => void }) {
  const live = x.status === 'IN_PROGRESS';
  const done = resolved(x);
  const waiting = !playable(x);
  return <div className={cn('grid gap-3 rounded-2xl border bg-card p-3 transition-shadow hover:shadow-md sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center',
    live ? 'border-danger/40 ring-2 ring-danger/10' : 'border-border')}>
    <div className="text-xs text-muted-foreground">
      <p className="font-bold text-brand-forest">{roundName(x.roundIndex, total)}</p>
      <p>{formatDateTime(x.scheduledAt)}</p>
      <p>{x.courtLabel ?? 'Chưa có sân'}</p>
    </div>
    <div className="grid gap-1 text-sm">
      <Side match={x} slot={1} /><Side match={x} slot={2} />
      {x.resolution === 'WALKOVER' && <p className="text-xs font-semibold text-caution">Thắng do đối thủ vắng mặt (W/O)</p>}
      {x.resolution === 'RETIRED' && <p className="text-xs font-semibold text-caution">Đối thủ bỏ cuộc</p>}
      {x.resolution === 'NONE' && <p className="text-xs font-semibold text-danger">Trận bị huỷ</p>}
    </div>
    <div className="flex flex-wrap items-center justify-end gap-2">
      {live && <span className="inline-flex items-center gap-1.5 rounded-full bg-danger-bg px-2.5 py-1 text-xs font-bold text-danger">
        <span className="relative flex size-2"><span className="absolute inline-flex size-full rounded-full bg-danger opacity-60 motion-safe:animate-ping" /><span className="relative inline-flex size-2 rounded-full bg-danger" /></span>Đang đánh</span>}
      {waiting && <span className="text-xs text-muted-foreground">Chờ đối thủ</span>}
      {onStart && <Button type="button" variant="success-soft" className="h-10" onClick={onStart}><Play aria-hidden="true" />Bắt đầu</Button>}
      {onScore && <Button type="button" variant={done ? 'outline' : 'brand'} className="h-10" onClick={onScore}>
        {done ? <><PencilLine aria-hidden="true" />Sửa kết quả</> : <><Flag aria-hidden="true" />{live ? 'Nhập tỉ số' : 'Xử lý'}</>}</Button>}
    </div>
  </div>;
}

function Side({ match: x, slot }: { match: BracketMatch; slot: 1 | 2 }) {
  const s = slot === 1 ? x.slot1 : x.slot2;
  const won = x.winnerRegistrationId !== null && x.winnerRegistrationId === s.registrationId;
  const lost = x.winnerRegistrationId !== null && !won;
  return <div className={cn('flex items-center gap-2', lost && 'opacity-50')}>
    {won ? <Crown aria-label="Thắng" className="size-4 shrink-0 text-medal-gold" /> : <span className="size-4 shrink-0" />}
    <span className={cn('min-w-0 flex-1 truncate', won ? 'font-bold' : 'font-medium', lost && 'line-through')}>
      {s.registrationId === null ? <span className="text-muted-foreground">Chờ người thắng</span> : sideName(s.players, s.teamName)}</span>
    <span className="flex gap-1 tabular-nums">{x.sets.map(set => {
      const mine = slot === 1 ? set.team1Score : set.team2Score;
      const other = slot === 1 ? set.team2Score : set.team1Score;
      return <span key={set.setNo} className={cn('w-7 rounded-md text-center text-xs', mine > other ? 'bg-brand-light font-bold text-brand-forest' : 'text-muted-foreground')}>{mine}</span>;
    })}</span>
  </div>;
}

type Mode = 'SETS' | 'RETIRED' | 'WALKOVER' | 'CANCEL';
const MODES: Array<{ value: Mode; label: string; icon: typeof Trophy }> = [
  { value: 'SETS', label: 'Tỉ số', icon: Trophy }, { value: 'RETIRED', label: 'Bỏ cuộc', icon: Flag },
  { value: 'WALKOVER', label: 'Walkover', icon: UserX }, { value: 'CANCEL', label: 'Huỷ trận', icon: Ban },
];

function ScoreDialog({ tournament: t, match: x, total, onClose }: { tournament: TournamentDetail; match: BracketMatch; total: number; onClose: () => void }) {
  const reduce = useReducedMotion();
  const correcting = resolved(x);
  const initialMode: Mode = x.resolution === 'RETIRED' ? 'RETIRED' : x.resolution === 'WALKOVER' ? 'WALKOVER' : x.resolution === 'NONE' ? 'CANCEL' : 'SETS';
  const [mode, setMode] = useState<Mode>(initialMode);
  const [sets, setSets] = useState<SetDraft[]>(() => [0, 1, 2].map(i => ({ a: x.sets[i] ? String(x.sets[i].team1Score) : '', b: x.sets[i] ? String(x.sets[i].team2Score) : '' })));
  const winnerSlot = x.winnerRegistrationId === null ? null : x.winnerRegistrationId === x.slot1.registrationId ? 1 : 2;
  const [retiredSlot, setRetiredSlot] = useState<1 | 2>(x.resolution === 'RETIRED' && winnerSlot ? (winnerSlot === 1 ? 2 : 1) : 2);
  const [woWinner, setWoWinner] = useState<1 | 2>(winnerSlot ?? 1);
  const [reason, setReason] = useState('');
  const result = useMatchResult(t.id);
  const name1 = sideName(x.slot1.players, x.slot1.teamName);
  const name2 = sideName(x.slot2.players, x.slot2.teamName);
  const lockedType = t.status === 'COMPLETED';
  const needsStart = !correcting && x.status !== 'IN_PROGRESS';

  const evaluation = evaluateSets(sets, mode === 'RETIRED');
  const winner: 1 | 2 | null = mode === 'SETS' ? evaluation.winner : mode === 'RETIRED' ? (retiredSlot === 1 ? 2 : 1) : mode === 'WALKOVER' ? woWinner : null;
  const problems = Object.keys(evaluation.problems).length > 0;
  const retiredInvalid = mode === 'RETIRED' && evaluation.winner !== null;
  // After completion only the final may change its winner (backend TOURNAMENT_MATCH_LOCKED).
  const winnerFlipped = lockedType && x.nextMatchId !== null && winnerSlot !== null && winner !== null && winner !== winnerSlot;
  const valid = mode === 'SETS' ? !problems && evaluation.winner !== null
    : mode === 'RETIRED' ? !problems && !retiredInvalid
      : mode === 'CANCEL' ? reason.trim().length > 0 : true;
  const blocked = ((mode === 'SETS' || mode === 'RETIRED') && needsStart) || winnerFlipped;

  const submit = () => {
    const input: ResultInput = mode === 'SETS' ? { type: 'SETS', sets: evaluation.filledSets }
      : mode === 'RETIRED' ? { type: 'RETIRED', retiredSlot, sets: evaluation.filledSets }
        : mode === 'WALKOVER' ? { type: 'WALKOVER', winnerSlot: woWinner, ...(reason.trim() ? { reason: reason.trim() } : {}) }
          : { type: 'CANCEL', reason: reason.trim() };
    result.mutate({ matchId: x.id, input }, { onSuccess: onClose });
  };
  const setScore = (i: number, side: 'a' | 'b', value: string) =>
    setSets(list => list.map((s, k) => (k === i ? { ...s, [side]: value.replace(/\D/g, '').slice(0, 2) } : s)));

  return <Dialog open onOpenChange={open => { if (!open && !result.isPending) onClose(); }}>
    <DialogContent className="sm:max-w-xl" closeDisabled={result.isPending}>
      <DialogTitle>{correcting ? 'Sửa kết quả' : 'Kết quả trận'} · {roundName(x.roundIndex, total)}</DialogTitle>
      <DialogDescription>{name1} vs {name2} · 3 set, mỗi set 21 điểm, cách 2, tối đa 30.</DialogDescription>

      {!lockedType && <div role="radiogroup" aria-label="Loại kết quả" className="mt-5 grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1 sm:grid-cols-4">
        {MODES.map(({ value, label, icon: Icon }) => <button key={value} type="button" role="radio" aria-checked={mode === value} onClick={() => setMode(value)}
          className={cn('relative flex min-h-10 items-center justify-center gap-1.5 rounded-lg text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring', mode === value ? 'text-foreground' : 'text-muted-foreground')}>
          {mode === value && <m.span layoutId="score-mode" aria-hidden="true" className="absolute inset-0 rounded-lg bg-card shadow-sm" transition={{ type: 'spring', bounce: 0.2, duration: 0.35 }} />}
          <Icon aria-hidden="true" className="relative size-4" /><span className="relative">{label}</span>
        </button>)}
      </div>}
      {lockedType && <Notice tone="info" className="mt-5">Giải đã kết thúc: chỉ sửa được tỉ số, giữ nguyên loại kết quả{x.nextMatchId !== null ? ' và người thắng' : ''}.</Notice>}

      <AnimatePresence mode="wait" initial={false}>
        <m.div key={mode} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.18, ease: EASE }} className="mt-5">
          {(mode === 'SETS' || mode === 'RETIRED') && <>
            {blocked && <Notice tone="caution" className="mb-3">Bấm "Bắt đầu" trận trước khi nhập tỉ số. Có thể xử lý Walkover hoặc Huỷ trận ngay.</Notice>}
            {mode === 'RETIRED' && <fieldset className="mb-4">
              <legend className="mb-2 text-sm font-semibold">Bên bỏ cuộc</legend>
              <SidePicker value={retiredSlot} onChange={setRetiredSlot} name1={name1} name2={name2} />
            </fieldset>}
            <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_4.5rem] items-center gap-x-3 gap-y-2">
              <span />
              <span className="truncate text-center text-xs font-bold text-muted-foreground" title={name1}>{name1}</span>
              <span className="truncate text-center text-xs font-bold text-muted-foreground" title={name2}>{name2}</span>
              {sets.map((s, i) => <SetRow key={i} index={i} set={s} problem={evaluation.problems[i]} onChange={setScore} />)}
            </div>
            {mode === 'RETIRED' && <p className="mt-3 text-xs text-muted-foreground">Nhập các set đã đánh; set cuối có thể đang dở. Người bỏ cuộc vẫn tính một trận thua.</p>}
            {retiredInvalid && <p role="alert" className="mt-2 text-sm text-danger">Trận đã phân thắng bại — không thể ghi bỏ cuộc.</p>}
            {winnerFlipped && <p role="alert" className="mt-2 text-sm text-danger">Tỉ số này đổi người thắng — giải đã kết thúc nên chỉ trận chung kết được đổi người thắng.</p>}
          </>}
          {mode === 'WALKOVER' && <>
            <fieldset><legend className="mb-2 text-sm font-semibold">Bên thắng (đối thủ vắng mặt)</legend>
              <SidePicker value={woWinner} onChange={setWoWinner} name1={name1} name2={name2} /></fieldset>
            <ReasonInput id="wo-reason" label="Ghi chú (tuỳ chọn)" value={reason} onChange={setReason} placeholder="Ví dụ: Vắng mặt sau 15 phút" />
          </>}
          {mode === 'CANCEL' && <>
            <Notice tone="danger">Trận bị huỷ không có người thắng và không ai đi tiếp vào vòng sau. Có thể ghi kết quả cho trận này sau nếu đánh bù.</Notice>
            <ReasonInput id="cancel-reason" label="Lý do (bắt buộc)" value={reason} onChange={setReason} placeholder="Ví dụ: Cả hai bên vắng mặt" />
          </>}
        </m.div>
      </AnimatePresence>

      <AnimatePresence>
        {winner && valid && !blocked && <m.div key={winner} initial={reduce ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={reduce ? undefined : { opacity: 0, scale: 0.95 }}
          transition={{ type: 'spring', bounce: 0.35, duration: 0.45 }}
          className="relative mt-5 flex items-center gap-3 overflow-hidden rounded-2xl bg-brand-forest px-4 py-3 text-primary-foreground">
          <span aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent motion-safe:animate-shine" />
          <Crown aria-hidden="true" className="relative size-6 text-brand-lime motion-safe:animate-float" />
          <p className="relative text-sm">Người thắng: <b className="text-base">{winner === 1 ? name1 : name2}</b>
            {mode === 'SETS' && <span className="ml-1 text-brand-mint">({evaluation.wins[0]}–{evaluation.wins[1]})</span>}</p>
        </m.div>}
      </AnimatePresence>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" className="h-11" onClick={onClose} disabled={result.isPending}>Đóng</Button>
        <Button type="button" variant={mode === 'CANCEL' ? 'danger' : 'brand'} className="h-11" onClick={submit} disabled={!valid || blocked || result.isPending}>
          {result.isPending && <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" />}
          {mode === 'CANCEL' ? 'Huỷ trận' : correcting ? 'Lưu thay đổi' : 'Lưu kết quả'}
        </Button>
      </div>
    </DialogContent>
  </Dialog>;
}

function SetRow({ index, set, problem, onChange }: { index: number; set: SetDraft; problem?: string; onChange: (i: number, side: 'a' | 'b', value: string) => void }) {
  const a = Number(set.a);
  const b = Number(set.b);
  const filled = set.a !== '' && set.b !== '';
  const cls = (mine: number, other: number) => cn('h-11 rounded-lg border bg-soft text-center text-lg font-bold tabular-nums outline-none transition-colors focus-visible:ring-4 focus-visible:ring-ring/10 min-w-0',
    problem ? 'border-danger' : filled && mine > other ? 'border-brand-mint bg-brand-light text-brand-forest' : 'border-input');
  return <>
    <span className="text-sm font-semibold">Set {index + 1}{index === 2 && <span className="ml-1 text-xs font-normal text-muted-foreground">(nếu 1–1)</span>}</span>
    <input aria-label={`Set ${index + 1} – bên 1`} inputMode="numeric" value={set.a} onChange={e => onChange(index, 'a', e.target.value)} placeholder="–" className={cls(a, b)} aria-invalid={Boolean(problem)} />
    <input aria-label={`Set ${index + 1} – bên 2`} inputMode="numeric" value={set.b} onChange={e => onChange(index, 'b', e.target.value)} placeholder="–" className={cls(b, a)} aria-invalid={Boolean(problem)} />
    {problem && <p role="alert" className="col-span-3 -mt-1 text-right text-xs text-danger">{problem}</p>}
  </>;
}

function SidePicker({ value, onChange, name1, name2 }: { value: 1 | 2; onChange: (v: 1 | 2) => void; name1: string; name2: string }) {
  return <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
    {([1, 2] as const).map(slot => <button key={slot} type="button" role="radio" aria-checked={value === slot} onClick={() => onChange(slot)}
      className={cn('min-h-11 truncate rounded-lg border px-3 text-left text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
        value === slot ? 'border-brand-forest bg-brand-light text-brand-forest' : 'border-border bg-card hover:bg-muted')}>
      {slot === 1 ? name1 : name2}</button>)}
  </div>;
}

function ReasonInput({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder: string }) {
  return <div className="mt-4 flex flex-col gap-1.5">
    <Label htmlFor={id}>{label}</Label>
    <Input id={id} className="h-11" maxLength={255} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
  </div>;
}
