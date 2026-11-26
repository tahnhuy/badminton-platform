import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { Crown, Trophy } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { cn } from '@/shared/utils/cn';
import { formatTime, roundName } from '../format';
import type { Bracket as BracketData, BracketMatch, BracketSlot } from '../types';
import { PlayerAvatar, SeedBadge } from './shared';

/**
 * Bracket view (TRN-07; owner feedback 2026-11-25): elbow connectors from each winner to its slot
 * in the next round; decided paths are green with a lime "flow" running toward the next round and
 * draw in round by round; a live match flows faintly; undecided paths stay grey; losers fade.
 */

const EASE = [0.2, 0.8, 0.2, 1] as const;
type PathState = 'won' | 'live' | 'wait';
interface Connector { key: string; d: string; state: PathState; round: number }

function slotState(match: BracketMatch, slot: BracketSlot): 'win' | 'lose' | 'none' {
  if (match.winnerRegistrationId === null || slot.registrationId === null) return 'none';
  return match.winnerRegistrationId === slot.registrationId ? 'win' : 'lose';
}

function elbow(x1: number, y1: number, x2: number, y2: number): string {
  if (Math.abs(y2 - y1) < 1) return `M${x1},${y1} H${x2}`;
  const xm = (x1 + x2) / 2;
  const r = Math.min(12, Math.abs(y2 - y1) / 2);
  const dir = y2 > y1 ? 1 : -1;
  return `M${x1},${y1} H${xm - r} Q${xm},${y1} ${xm},${y1 + dir * r} V${y2 - dir * r} Q${xm},${y2} ${xm + r},${y2} H${x2}`;
}

export function Bracket({ bracket, highlightRegistrationId = null }: { bracket: BracketData; highlightRegistrationId?: number | null }) {
  const reduce = useReducedMotion();
  const hostRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<{ width: number; height: number; connectors: Connector[] }>({ width: 0, height: 0, connectors: [] });
  const total = bracket.totalRounds;
  const final = bracket.rounds[total - 1]?.matches[0];
  const champion = final && final.winnerRegistrationId !== null
    ? (final.slot1.registrationId === final.winnerRegistrationId ? final.slot1 : final.slot2) : null;

  const measure = useCallback(() => {
    const host = hostRef.current;
    if (!host) return;
    const box = host.getBoundingClientRect();
    const rel = (el: Element) => { const r = el.getBoundingClientRect(); return { l: r.left - box.left, r: r.right - box.left, cy: r.top - box.top + r.height / 2 }; };
    const connectors: Connector[] = [];

    function measureMatch(hostElement: HTMLDivElement, round: (typeof bracket.rounds)[number], match: (typeof bracket.rounds)[number]['matches'][number]) {
      const card = hostElement.querySelector(`[data-match="${match.id}"]`);
      if (!card) return;
      let target: Element | null;
      if (match.nextMatchId !== null) {
        const next = hostElement.querySelector(`[data-match="${match.nextMatchId}"]`);
        const nextMatch = bracket.rounds[round.roundIndex + 1]?.matches.find(x => x.id === match.nextMatchId);
        const slotName = nextMatch && nextMatch.matchIndex * 2 === match.matchIndex ? '1' : '2';
        target = next?.querySelector(`[data-slot="${slotName}"]`) ?? next;
      } else {
        target = hostElement.querySelector('[data-champion]');
      }
      if (!target) return;
      const from = rel(card);
      const winnerRow = card.querySelector('[data-result="win"]');
      const y1 = winnerRow ? rel(winnerRow).cy : from.cy;
      const to = rel(target);
      const targetCard = target.closest('[data-match]') ?? target;
      const x2 = rel(targetCard).l;
      const state: PathState = match.winnerRegistrationId !== null ? 'won' : match.status === 'IN_PROGRESS' ? 'live' : 'wait';
      connectors.push({ key: `${match.id}`, d: elbow(from.r, y1, x2, to.cy), state, round: round.roundIndex });

    }
    for (const round of bracket.rounds) {
      for (const match of round.matches) {
        measureMatch(host, round, match);
      }
    }
    setLines({ width: box.width, height: box.height, connectors });
  }, [bracket]);

  useLayoutEffect(() => {
    measure();
    const host = hostRef.current;
    if (!host || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(host);
    return () => observer.disconnect();
  }, [measure]);

  return <div className="-mx-1 overflow-x-auto px-1 pb-4" tabIndex={0} aria-label="Nhánh đấu, cuộn ngang để xem các vòng">
    <div ref={hostRef} className="relative grid min-w-max auto-cols-[minmax(15rem,17rem)] grid-flow-col gap-14">
      <svg aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-visible" width={lines.width} height={lines.height}>
        {lines.connectors.map(c => <path key={`base-${c.key}`} d={c.d} fill="none" strokeLinecap="round" strokeLinejoin="round" className="stroke-border" strokeWidth={2} />)}
        {lines.connectors.filter(c => c.state === 'won').map(c =>
          <m.path key={`won-${c.key}`} d={c.d} fill="none" strokeLinecap="round" strokeLinejoin="round" className="stroke-primary" strokeWidth={3}
            initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: EASE, delay: reduce ? 0 : 0.15 + c.round * 0.35 }} />)}
        {!reduce && lines.connectors.filter(c => c.state !== 'wait').map(c =>
          <m.path key={`flow-${c.key}`} d={c.d} fill="none" strokeLinecap="round" strokeLinejoin="round"
            className={c.state === 'won' ? 'stroke-brand-lime' : 'stroke-danger/40'} strokeWidth={3}
            strokeDasharray={c.state === 'won' ? '2 16' : '2 12'}
            initial={{ strokeDashoffset: 0, opacity: 0 }}
            animate={{ strokeDashoffset: -18, opacity: 1 }}
            transition={{ strokeDashoffset: { duration: c.state === 'won' ? 1.1 : 1.8, ease: 'linear', repeat: Infinity }, opacity: { duration: 0.4, delay: 0.4 + c.round * 0.35 } }} />)}
      </svg>

      {bracket.rounds.map(round => <div key={round.roundIndex} className="relative z-10 flex flex-col">
        <h3 className="mb-3 text-2xs font-bold uppercase tracking-widest text-muted-foreground">{roundName(round.roundIndex, total)}</h3>
        <div className="flex flex-1 flex-col justify-around gap-5">
          {round.matches.map((match, i) => <MatchCard key={match.id} match={match} index={i} round={round.roundIndex} highlight={highlightRegistrationId} />)}
        </div>
      </div>)}

      <div className="relative z-10 flex flex-col">
        <h3 className="mb-3 text-2xs font-bold uppercase tracking-widest text-muted-foreground">Vô địch</h3>
        <div className="flex flex-1 flex-col justify-around">
          <m.div data-champion
            initial={reduce ? false : { opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, ease: EASE, delay: reduce ? 0 : 0.3 + total * 0.35 }}
            className={cn('relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl border bg-card px-4 py-6 text-center shadow-panel',
              champion ? 'border-brand-lime-deep ring-4 ring-brand-lime/40' : 'border-border')}>
            <span aria-hidden="true" className={cn('absolute inset-x-0 -top-10 mx-auto size-40 rounded-full blur-2xl', champion ? 'bg-brand-lime/50' : 'bg-brand-lime/20')} />
            {champion
              ? <>
                <m.span className="relative" animate={reduce ? undefined : { rotate: [0, -8, 8, 0] }} transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 2.4 }}>
                  <Crown aria-hidden="true" className="size-8 text-medal-gold" />
                </m.span>
                <div className="relative flex -space-x-2">{champion.players.map(p => <PlayerAvatar key={p.id} player={p} size="lg" />)}</div>
                <strong className="relative text-base">{champion.teamName ?? champion.players.map(p => p.fullName).join(' / ')}</strong>
                <span className="relative rounded-full bg-brand-lime px-3 py-1 text-xs font-bold text-brand-forest">Vô địch</span>
              </>
              : <>
                <Trophy aria-hidden="true" className="relative size-8 text-medal-gold" />
                <strong className="relative text-sm text-muted-foreground">Chưa xác định</strong>
              </>}
          </m.div>
        </div>
      </div>
    </div>
  </div>;
}

function MatchCard({ match, index, round, highlight }: { match: BracketMatch; index: number; round: number; highlight: number | null }) {
  const reduce = useReducedMotion();
  const live = match.status === 'IN_PROGRESS';
  const mine = highlight !== null && (match.slot1.registrationId === highlight || match.slot2.registrationId === highlight);
  const note = matchResolutionNote(match);
  const statusText = matchStatusText(live, match);
  return <m.article data-match={match.id}
    initial={reduce ? false : { opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
    transition={{ duration: 0.4, ease: EASE, delay: reduce ? 0 : round * 0.35 + index * 0.05 }}
    className={cn('overflow-hidden rounded-2xl border bg-card shadow-panel transition-shadow',
      live ? 'border-danger/40 ring-4 ring-danger/10' : match.winnerRegistrationId !== null ? 'border-brand-mint' : 'border-border',
      mine && 'ring-2 ring-primary/40')}>
    <div className="flex items-center justify-between gap-2 border-b border-border bg-background px-3 py-1.5 text-2xs text-muted-foreground">
      <span className="truncate">{[match.courtLabel, formatTime(match.scheduledAt)].filter(Boolean).join(' · ')}</span>
      <span className={cn('flex items-center gap-1 font-semibold', live && 'text-danger')}>
        {live && <span aria-hidden="true" className="size-1.5 rounded-full bg-danger motion-safe:animate-pulse" />}{statusText}
      </span>
    </div>
    <SlotRow match={match} slot={match.slot1} side={1} />
    <div className="border-t border-muted" />
    <SlotRow match={match} slot={match.slot2} side={2} />
    {note && <p className="px-3 pb-2 text-2xs font-medium text-caution">{note}</p>}
  </m.article>;
}

function matchStatusText(live: boolean, match: BracketMatch) {
  return live ? 'Đang đánh' : match.status === 'COMPLETED' ? 'Đã xong' : match.status === 'CANCELLED' ? 'Đã huỷ' : 'Chờ';
}

function matchResolutionNote(match: BracketMatch) {
  return match.resolution === 'WALKOVER' ? 'Walkover (vắng mặt)' : match.resolution === 'RETIRED' ? 'Bỏ cuộc giữa trận' : match.resolution === 'NONE' ? 'Trận bị huỷ' : null;
}

function SlotRow({ match, slot, side }: { match: BracketMatch; slot: BracketSlot; side: 1 | 2 }) {
  const result = slotState(match, slot);
  const empty = slot.registrationId === null;
  const name = slot.teamName ?? slot.players.map(p => p.fullName).join(' / ');
  return <div data-slot={String(side)} data-result={result}
    className={cn('grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2 transition-[opacity,filter] duration-500',
      result === 'win' && 'bg-linear-to-r from-brand-lime/35 to-transparent',
      result === 'lose' && 'opacity-45 grayscale')}>
    <SeedBadge seed={empty ? null : slot.seedNo} muted={result === 'lose'} />
    <span className={cn('truncate text-sm', empty ? 'italic text-muted-foreground' : 'font-semibold',
      result === 'win' && 'text-brand-forest', result === 'lose' && 'font-medium text-muted-foreground line-through decoration-muted-foreground/50')}>
      {empty ? (slot.fromBye ? 'Miễn đấu' : 'Chờ đối thủ') : name}
      {slot.fromBye && !empty && <span className="ml-1.5 rounded bg-accent px-1 text-2xs font-bold text-primary no-underline">BYE</span>}
    </span>
    <span className="flex gap-1 text-xs tabular-nums">
      {match.sets.map(set => {
        const mineScore = side === 1 ? set.team1Score : set.team2Score;
        const other = side === 1 ? set.team2Score : set.team1Score;
        return <b key={set.setNo} className={cn('min-w-6 rounded-md px-1 py-0.5 text-center font-semibold',
          mineScore > other && result !== 'lose' ? 'bg-brand-forest text-brand-lime' : 'bg-muted')}>{mineScore}</b>;
      })}
      {match.resolution === 'WALKOVER' && result === 'win' && <b className="rounded-md bg-brand-forest px-1.5 py-0.5 text-brand-lime">W/O</b>}
    </span>
  </div>;
}
