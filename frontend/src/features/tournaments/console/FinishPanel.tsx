import { useState } from 'react';
import { Crown, Medal, PartyPopper, Wallet } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { formatDateTime, money, roundName } from '../format';
import { useBracket, useTournamentMutation } from '../queries';
import { tournamentApi } from '../tournament-api';
import type { BracketMatch, TournamentDetail } from '../types';
import { Notice, Panel, PlayerAvatar, sideName } from '../components/shared';

const finishedFinal = (x?: BracketMatch) => Boolean(x && x.winnerRegistrationId !== null && ['WINNER_DECLARED', 'RETIRED', 'WALKOVER'].includes(x.resolution));

/** Completing the tournament and the Organizer payout (PRD FR-60…62, Tech Design §2.1, §7.6). */
export function FinishPanel({ tournament: t }: { tournament: TournamentDetail }) {
  const reduce = useReducedMotion();
  const drawn = ['READY', 'IN_PROGRESS', 'COMPLETED'].includes(t.status);
  const bracket = useBracket(t.id, t.status, drawn);
  const [confirm, setConfirm] = useState(false);
  const complete = useTournamentMutation(t.id, () => tournamentApi.transition(t.id, 'complete', t.version), 'Giải đấu đã kết thúc. Chúc mừng nhà vô địch!');

  const rounds = bracket.data?.rounds ?? [];
  const final = rounds.at(-1)?.matches[0];
  const ready = finishedFinal(final);
  const champion = final && final.winnerRegistrationId !== null ? (final.winnerRegistrationId === final.slot1.registrationId ? final.slot1 : final.slot2) : null;
  const runnerUp = final && champion ? (champion === final.slot1 ? final.slot2 : final.slot1) : null;
  const payout = t.entryFee * t.confirmedCount;
  const pending = rounds.flatMap(r => r.matches).filter(x => x.resolution === 'UNRESOLVED' && x.slot1.registrationId !== null && x.slot2.registrationId !== null).length;

  return <Panel title="Kết thúc giải">
    {t.status === 'COMPLETED' ? <>
      <Notice tone="success" icon={PartyPopper}>Giải đã kết thúc lúc {t.completedAt ? formatDateTime(t.completedAt) : '—'}.{payout > 0 ? ` Lệ phí ${money(payout)} đã được cộng vào ví của bạn.` : ''}</Notice>
      <p className="mt-3 text-sm text-muted-foreground">Trong 48 giờ sau khi kết thúc, bạn vẫn sửa được tỉ số ở mục Trận đấu.</p>
    </> : !drawn || t.status === 'CANCELLED' ? <Notice tone="caution">Giải chỉ kết thúc được khi đang diễn ra và trận chung kết đã có kết quả.</Notice> : <>
      <ul className="grid gap-2 text-sm">
        <Check ok={t.status === 'IN_PROGRESS'} label="Giải đang diễn ra" />
        <Check ok={ready} label={`Trận ${final ? roundName(final.roundIndex, bracket.data?.totalRounds ?? 1).toLowerCase() : 'chung kết'} đã có người thắng`} />
        {pending > 0 && <li className="text-xs text-muted-foreground">Còn {pending} trận chưa có kết quả.</li>}
      </ul>
      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-muted p-4">
        <span className="grid size-11 place-items-center rounded-full bg-brand-light text-brand-forest"><Wallet aria-hidden="true" className="size-5" /></span>
        <div><p className="text-xs text-muted-foreground">Bạn sẽ nhận khi kết thúc</p><p className="text-xl font-bold tabular-nums">{money(payout)}</p>
          <p className="text-xs text-muted-foreground">Tổng lệ phí của {t.confirmedCount} người tham gia còn lại (người đã được hoàn tiền không tính).</p></div>
      </div>
    </>}

    {champion && <m.div initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0.3, duration: 0.6 }}
      className="relative mt-5 overflow-hidden rounded-2xl bg-brand-forest-deep p-5 text-primary-foreground">
      <span aria-hidden="true" className="absolute -right-10 -top-10 size-40 rounded-full bg-brand-lime/20 blur-2xl motion-safe:animate-drift" />
      <span aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent motion-safe:animate-shine" />
      <div className="relative flex items-center gap-4">
        <Crown aria-hidden="true" className="size-10 shrink-0 text-medal-gold motion-safe:animate-float" />
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-mint">Vô địch</p>
          <p className="truncate text-xl font-bold">{sideName(champion.players, champion.teamName)}</p>
          {runnerUp && runnerUp.registrationId !== null && <p className="mt-1 flex items-center gap-1.5 text-sm text-brand-mint"><Medal aria-hidden="true" className="size-4" />Á quân: {sideName(runnerUp.players, runnerUp.teamName)}</p>}
        </div>
        <div className="ml-auto hidden -space-x-2 sm:flex">{champion.players.map(p => <PlayerAvatar key={p.id} player={p} size="lg" className="ring-2 ring-brand-lime" />)}</div>
      </div>
    </m.div>}

    {t.status === 'IN_PROGRESS' && <div className="mt-5 flex justify-end">
      <Button type="button" variant="brand" className="h-11" disabled={!ready} onClick={() => setConfirm(true)}><PartyPopper aria-hidden="true" />Kết thúc giải</Button>
    </div>}
    {confirm && <ConfirmDialog title="Kết thúc giải?" confirmLabel="Kết thúc giải" busyLabel="Đang xử lý…" busy={complete.isPending}
      description={<><p>Giải chuyển sang "Đã kết thúc"{payout > 0 ? <>, <b>{money(payout)}</b> lệ phí được cộng vào ví của bạn</> : ''}. Người chơi nhận thông báo.</p>
        <p className="text-sm text-muted-foreground">Nếu bạn không bấm, hệ thống tự kết thúc 3 ngày sau ngày kết thúc dự kiến. Sau khi kết thúc vẫn sửa tỉ số được trong 48 giờ.</p></>}
      onCancel={() => setConfirm(false)} onConfirm={() => complete.mutate(undefined, { onSettled: () => setConfirm(false) })} />}
  </Panel>;
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  return <li className="flex items-center gap-2">
    <span aria-hidden="true" className={ok ? 'grid size-5 place-items-center rounded-full bg-success text-2xs font-bold text-primary-foreground' : 'size-5 rounded-full border-2 border-border'}>{ok ? '✓' : ''}</span>
    <span className={ok ? 'font-semibold' : 'text-muted-foreground'}>{label}</span>
    <span className="sr-only">{ok ? '(đạt)' : '(chưa đạt)'}</span>
  </li>;
}
