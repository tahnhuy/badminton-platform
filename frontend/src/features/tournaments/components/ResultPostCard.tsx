import { Link } from 'react-router-dom';
import { Crown, Medal, Trophy } from 'lucide-react';
import { m, LazyMotion, domAnimation, useReducedMotion } from 'motion/react';
import { formatDate, matchTypeLabel, placementLabel } from '../format';
import type { MatchType } from '../types';

export interface TournamentResultCardData {
  tournament: { id: number; name: string; matchType: string; completedAt: string | null; tournamentEnd: string };
  champion: string | null;
  runnerUp: string | null;
  authorPlacement: string | null;
}

/** Feed card of a TOURNAMENT_RESULT post — derived from the tournament, never from user text (Tech Design §7.7). */
export function ResultPostCard({ data }: { data: TournamentResultCardData }) {
  const reduce = useReducedMotion();
  const t = data.tournament;
  const highlight = data.authorPlacement === 'CHAMPION' || data.authorPlacement === 'RUNNER_UP';
  return <LazyMotion features={domAnimation} strict>
    <m.div initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
      className="relative overflow-hidden rounded-2xl bg-linear-to-br from-brand-moss via-brand-forest to-brand-forest-deep p-5 text-primary-foreground">
      <span aria-hidden="true" className="pointer-events-none absolute -right-12 -top-12 size-44 rounded-full bg-brand-lime/25 blur-2xl motion-safe:animate-drift" />
      {highlight && <span aria-hidden="true" className="pointer-events-none absolute inset-0 bg-linear-to-r from-transparent via-white/10 to-transparent motion-safe:animate-shine" />}
      <div className="relative flex items-start gap-4">
        <span className="grid size-14 shrink-0 place-items-center rounded-2xl bg-primary-foreground/10">
          <Trophy aria-hidden="true" className="size-7 text-medal-gold motion-safe:animate-float" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-brand-mint">{placementLabel(data.authorPlacement)} · {matchTypeLabel(t.matchType as MatchType)}</p>
          <Link to={`/tournaments/${t.id}`} className="mt-1 block truncate text-xl font-extrabold tracking-tight underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-brand-lime">{t.name}</Link>
          <p className="text-sm text-brand-mint">Kết thúc {formatDate(t.completedAt ?? t.tournamentEnd)}</p>
        </div>
      </div>
      <dl className="relative mt-4 grid gap-2 text-sm sm:grid-cols-2">
        <div className="flex items-center gap-2 rounded-lg bg-primary-foreground/10 px-3 py-2"><Crown aria-hidden="true" className="size-4 shrink-0 text-medal-gold" /><dt className="sr-only">Vô địch</dt><dd className="truncate font-bold">{data.champion ?? '—'}</dd></div>
        <div className="flex items-center gap-2 rounded-lg bg-primary-foreground/10 px-3 py-2"><Medal aria-hidden="true" className="size-4 shrink-0 text-brand-mint" /><dt className="sr-only">Á quân</dt><dd className="truncate">{data.runnerUp ?? '—'}</dd></div>
      </dl>
    </m.div>
  </LazyMotion>;
}
