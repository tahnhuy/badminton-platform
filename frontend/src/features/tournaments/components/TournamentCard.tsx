import { Link } from 'react-router-dom';
import { CalendarDays, Check, Gauge, MapPin, Trophy } from 'lucide-react';
import { m, useReducedMotion } from 'motion/react';
import { cn } from '@/shared/utils/cn';
import { feeLabel, formatDateTime, levelRange, matchTypeLabel, unitLabel } from '../format';
import type { Tournament } from '../types';
import { StatusPill } from './shared';

const EASE = [0.2, 0.8, 0.2, 1] as const;

/** Tournament card of the list (prototype `card()`): status, schedule, venue, level, fee and slots. */
export function TournamentCard({ tournament: t, index = 0, fits = false, href }: { tournament: Tournament; index?: number; fits?: boolean; href?: string }) {
  const reduce = useReducedMotion();
  const filled = t.participantLimit > 0 ? Math.min(100, Math.round((t.confirmedCount / t.participantLimit) * 100)) : 0;
  const almostFull = t.status === 'OPEN_FOR_REGISTRATION' && t.slotsLeft > 0 && t.slotsLeft <= 2;
  return <m.div
    initial={reduce ? false : { opacity: 0, y: 18 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, ease: EASE, delay: reduce ? 0 : Math.min(index, 8) * 0.06 }}
    whileHover={reduce ? undefined : { y: -4 }}
    className="h-full"
  >
    <Link to={href ?? `/tournaments/${t.id}`} className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-panel outline-none transition-colors hover:border-brand-mint focus-visible:ring-2 focus-visible:ring-ring">
      <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-brand-lime/0 blur-2xl transition-colors duration-500 group-hover:bg-brand-lime/40" />
      <div className="flex flex-wrap items-center gap-2">
        <StatusPill status={t.status} />
        {fits && <span className="inline-flex items-center gap-1 rounded-full bg-brand-lime px-2 py-0.5 text-2xs font-bold text-brand-forest"><Check aria-hidden="true" className="size-3" />Hợp trình</span>}
        {almostFull && <span className="rounded-full bg-caution-bg px-2 py-0.5 text-2xs font-bold text-caution">Sắp đủ người</span>}
      </div>
      <h3 className="text-base font-bold leading-snug tracking-tight transition-colors group-hover:text-primary">{t.name}</h3>
      <dl className="grid gap-1.5 text-sm text-muted-foreground">
        <div className="flex items-center gap-2"><dt className="sr-only">Thời gian</dt><CalendarDays aria-hidden="true" className="size-4 shrink-0" /><dd>{formatDateTime(t.tournamentStart)}</dd></div>
        {t.venueNote && <div className="flex items-center gap-2"><dt className="sr-only">Địa điểm</dt><MapPin aria-hidden="true" className="size-4 shrink-0" /><dd className="truncate">{t.venueNote}</dd></div>}
        <div className="flex items-center gap-2"><dt className="sr-only">Trình độ</dt><Gauge aria-hidden="true" className="size-4 shrink-0" /><dd>{levelRange(t.minSkillLevel, t.maxSkillLevel)} · {matchTypeLabel(t.matchType)}</dd></div>
      </dl>
      <div className="mt-auto flex items-end justify-between gap-4 border-t border-dashed border-border pt-3">
        <span className={cn('text-base font-extrabold', t.entryFee === 0 ? 'text-primary' : 'text-brand-forest')}>{feeLabel(t.entryFee)}</span>
        <div className="w-28 text-right text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{t.confirmedCount}</span>/{t.participantLimit} {unitLabel(t.matchType)}
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
            <m.div className="h-full rounded-full bg-primary" initial={reduce ? false : { width: 0 }} animate={{ width: `${filled}%` }}
              transition={{ duration: 0.8, ease: EASE, delay: reduce ? 0 : 0.2 + Math.min(index, 8) * 0.06 }} />
          </div>
        </div>
      </div>
      {t.status === 'COMPLETED' && <Trophy aria-hidden="true" className="absolute bottom-4 right-4 size-16 text-caution/10" />}
    </Link>
  </m.div>;
}
