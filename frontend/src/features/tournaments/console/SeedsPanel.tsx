import { useMemo, useState } from 'react';
import { Check, Eraser, LoaderCircle, Shuffle, Sparkles, Wand2 } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { cn } from '@/shared/utils/cn';
import { formatDateTime } from '../format';
import { useSeeds, useTournamentMutation } from '../queries';
import { tournamentApi } from '../tournament-api';
import type { SeedEntry, TournamentDetail } from '../types';
import { Notice, Panel, PlayerAvatar, SeedBadge } from '../components/shared';

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Standard seed layout of a bracket of `size` (seed 1 vs size, 1/2 in opposite halves…). */
function seedOrder(size: number): number[] {
  let order = [1];
  for (let s = 2; s <= size; s *= 2) order = order.flatMap(seed => [seed, s + 1 - seed]);
  return order;
}

/** Seeds and the draw (PRD FR-30…33): suggestion by level, Organizer edits, preview, draw. */
export function SeedsPanel({ tournament: t, onDrawn }: { tournament: TournamentDetail; onDrawn: () => void }) {
  const reduce = useReducedMotion();
  const enabled = t.status !== 'DRAFT' && t.status !== 'OPEN_FOR_REGISTRATION';
  const seeds = useSeeds(t.id, enabled);
  // Local edits over the saved seeds; cleared after a successful save.
  const [edits, setEdits] = useState<Record<number, string>>({});
  const [confirmDraw, setConfirmDraw] = useState(false);
  const entries = useMemo(() => seeds.data?.entries ?? [], [seeds.data]);
  const saved = (e: SeedEntry) => (e.seedNo === null ? '' : String(e.seedNo));
  const draft = useMemo(() => Object.fromEntries(entries.map(e => [e.registrationId, edits[e.registrationId] ?? saved(e)])) as Record<number, string>, [entries, edits]);
  const setDraft = (update: (d: Record<number, string>) => Record<number, string>) => setEdits(update(draft));

  const save = useTournamentMutation(t.id, (list: Array<{ registrationId: number; seedNo: number }>) => tournamentApi.setSeeds(t.id, seeds.data!.version, list), 'Đã lưu hạt giống.');
  const draw = useTournamentMutation(t.id, () => tournamentApi.draw(t.id, seeds.data?.version ?? t.version), 'Đã bốc thăm và xếp lịch thi đấu!');

  const values = entries.map(e => Number(draft[e.registrationId] || 0)).filter(n => n > 0);
  const sorted = [...values].sort((a, b) => a - b);
  const invalid = sorted.some((n, i) => n !== i + 1);
  const dirty = entries.some(e => draft[e.registrationId] !== saved(e));
  const preview = useMemo(() => {
    const size = 2 ** Math.ceil(Math.log2(Math.max(2, entries.length)));
    const bySeed = new Map(entries.map(e => [Number(draft[e.registrationId] || 0) || null, e]));
    const order = seedOrder(size);
    const pairs: Array<[number, number]> = [];
    for (let i = 0; i < order.length; i += 2) pairs.push([order[i], order[i + 1]]);
    return { size, byes: size - entries.length, pairs: pairs.map(([a, b]) => [bySeed.get(a) ?? null, bySeed.get(b) ?? null, a, b] as const) };
  }, [entries, draft]);

  if (!enabled) return <Panel title="Hạt giống & bốc thăm"><Notice tone="caution">Đóng đăng ký trước khi xếp hạt giống và bốc thăm.</Notice></Panel>;
  if (seeds.isPending) return <Panel title="Hạt giống & bốc thăm"><Skeleton className="h-80 rounded-lg" /></Panel>;
  const editable = seeds.data?.editable ?? false;
  const name = (e: SeedEntry) => e.teamName ?? e.players.map(p => p.fullName).join(' / ');
  const applySuggestion = () => setEdits(Object.fromEntries(entries.map(e => [e.registrationId, String(e.suggestedSeedNo)])));
  const clearAll = () => setEdits(Object.fromEntries(entries.map(e => [e.registrationId, ''])));
  const persist = () => save.mutate(entries.filter(e => draft[e.registrationId]).map(e => ({ registrationId: e.registrationId, seedNo: Number(draft[e.registrationId]) })), { onSuccess: () => setEdits({}) });

  return <Panel title="Hạt giống & bốc thăm">
    {!editable ? <Notice tone="success" icon={Check} className="mb-4">Đã bốc thăm. Hạt giống và nhánh đấu đã khoá.</Notice>
      : <p className="mb-4 text-sm leading-6 text-muted-foreground">Hệ thống gợi ý theo trình độ{t.matchType === 'DOUBLES' ? ' (đôi: tổng trình hai người)' : ''}, bằng nhau thì ngẫu nhiên. Sửa số hạt giống (1, 2, 3… liên tục) hoặc để trống để bốc thăm ngẫu nhiên. Hạt giống 1–2 ở hai nửa nhánh, 1–4 ở bốn phần tư; suất miễn đấu dành cho hạt giống cao. Không lưu hạt giống nào thì khi bốc thăm sẽ dùng gợi ý.</p>}
    <ul className="grid gap-2">
      {entries.map((e, i) => <m.li key={e.registrationId} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25, ease: EASE, delay: reduce ? 0 : Math.min(i, 16) * 0.025 }}
        className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-2xl border border-border bg-card px-3 py-2.5">
        <div className="flex -space-x-2">{e.players.map(p => <PlayerAvatar key={p.id} player={p} size="sm" />)}</div>
        <div className="min-w-0"><p className="truncate font-semibold">{name(e)}</p><p className="text-xs text-muted-foreground">Gợi ý #{e.suggestedSeedNo} · điểm trình {e.skillRank}</p></div>
        {editable
          ? <input aria-label={`Hạt giống của ${name(e)}`} inputMode="numeric" value={draft[e.registrationId] ?? ''} placeholder="–"
            onChange={ev => setDraft(d => ({ ...d, [e.registrationId]: ev.target.value.replace(/\D/g, '').slice(0, 3) }))}
            className="h-10 w-16 rounded-lg border border-input bg-soft text-center font-bold tabular-nums outline-none focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/10" />
          : <SeedBadge seed={e.seedNo} />}
      </m.li>)}
    </ul>
    {editable && invalid && <p role="alert" className="mt-3 text-sm text-danger">Hạt giống phải liên tục từ 1 và không trùng nhau.</p>}

    <h3 className="mt-6 text-sm font-bold">Vòng đầu (xem trước) · nhánh {preview.size}{preview.byes > 0 ? ` · ${preview.byes} suất miễn đấu` : ''}</h3>
    <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
      {preview.pairs.map(([a, b, sa, sb], i) => <div key={i} className="rounded-lg bg-background px-3 py-2 text-xs">
        <PairSide entry={a} seed={sa} name={name} /><span className="mx-1 text-muted-foreground">vs</span>
        {sb > entries.length ? <span className="font-bold text-primary">Miễn đấu</span> : <PairSide entry={b} seed={sb} name={name} />}
      </div>)}
    </div>
    <p className="mt-2 text-xs text-muted-foreground">Ô không có hạt giống được bốc thăm ngẫu nhiên khi bấm "Bốc thăm".</p>

    {editable && <div className="mt-6 flex flex-wrap justify-end gap-2 border-t border-border pt-4">
      <Button type="button" variant="outline" className="h-11" onClick={applySuggestion}><Wand2 aria-hidden="true" />Dùng gợi ý</Button>
      <Button type="button" variant="outline" className="h-11" onClick={clearAll}><Eraser aria-hidden="true" />Xoá hết</Button>
      <Button type="button" variant="outline" className="h-11" disabled={!dirty || invalid || save.isPending} onClick={persist}>
        {save.isPending ? <LoaderCircle aria-hidden="true" className="motion-safe:animate-spin" /> : <Check aria-hidden="true" />}Lưu hạt giống
      </Button>
      <Button type="button" variant="brand" className="h-11" disabled={dirty || entries.length < 2} onClick={() => setConfirmDraw(true)}><Shuffle aria-hidden="true" />Bốc thăm & xếp lịch</Button>
    </div>}
    {editable && dirty && <p className="mt-2 text-right text-xs text-caution">Lưu hạt giống trước khi bốc thăm.</p>}

    {confirmDraw && <ConfirmDialog title="Bốc thăm?" confirmLabel="Bốc thăm" busyLabel="Đang bốc thăm…" busy={draw.isPending}
      description={<p>Hệ thống tạo nhánh đấu và <b>tự xếp lịch</b> trên {t.schedule.courtCount} sân từ {formatDateTime(t.tournamentStart)}. Sau đó hạt giống và nhánh đấu bị khoá; lịch vẫn sửa được.</p>}
      onCancel={() => setConfirmDraw(false)} onConfirm={() => draw.mutate(undefined, { onSuccess: () => { setConfirmDraw(false); onDrawn(); }, onError: () => setConfirmDraw(false) })}>
      <p className="mt-3 flex items-center gap-2 text-sm text-primary"><Sparkles aria-hidden="true" className="size-4" />Kết quả bốc thăm tái lập được nhờ mã bốc thăm được lưu.</p>
    </ConfirmDialog>}
  </Panel>;
}

function PairSide({ entry, seed, name }: { entry: SeedEntry | null; seed: number; name: (e: SeedEntry) => string }) {
  return <span className={cn('font-semibold', !entry && 'text-muted-foreground')}>{entry ? <>#{seed} {name(entry)}</> : 'Bốc thăm'}</span>;
}
