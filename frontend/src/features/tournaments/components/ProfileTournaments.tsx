import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { Crown, Medal, Trophy } from 'lucide-react';
import { m, LazyMotion, domAnimation, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { formatDate, matchTypeLabel, placementLabel } from '../format';
import { tournamentApi } from '../tournament-api';

const MEDAL: Record<string, string> = { CHAMPION: 'text-medal-gold', RUNNER_UP: 'text-brand-mint', SEMI_FINAL: 'text-caution' };

/** "Giải đấu" section of own and public profiles (PRD FR-70, Tech Design §3.4b; TRN-16). */
export function ProfileTournaments({ playerId, compact = false }: { playerId: number; compact?: boolean }) {
  const reduce = useReducedMotion();
  const [page, setPage] = useState(1);
  const history = useQuery({ queryKey: ['tournaments', 'history', playerId, page], queryFn: () => tournamentApi.playerHistory(playerId, page), placeholderData: keepPreviousData });
  const items = history.data?.data ?? [];
  const titles = items.filter(i => i.placement === 'CHAMPION').length;
  const ranking = useQuery({ queryKey: ['tournaments', 'ranking', playerId], queryFn: () => tournamentApi.playerRanking(playerId) });
  return <LazyMotion features={domAnimation} strict>
    <section aria-label="Giải đấu" className={cn('flex min-w-0 flex-col gap-4 rounded-2xl border border-border bg-card', compact ? 'p-4' : 'p-5 sm:p-6')}>
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight"><Trophy aria-hidden="true" className="size-5 text-medal-gold" />Giải đấu</h2>
        {history.data && history.data.meta.total > 0 && <span className="text-xs text-muted-foreground">{history.data.meta.total} giải{titles > 0 ? ` · ${titles} chức vô địch` : ''}</span>}
      </div>
      {ranking.data && (ranking.data.SINGLES || ranking.data.DOUBLES) && <div className="flex flex-wrap gap-2">
        {(['SINGLES', 'DOUBLES'] as const).map(type => ranking.data![type] && <Link key={type} to="/tournaments/rankings"
          className="inline-flex items-center gap-2 rounded-full bg-brand-light px-3 py-1.5 text-sm font-semibold text-brand-forest outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
          <Medal aria-hidden="true" className="size-4" />{type === 'SINGLES' ? 'Đơn' : 'Đôi'}: hạng #{ranking.data![type]!.position} · {ranking.data![type]!.totalPoints} điểm
        </Link>)}
      </div>}
      {history.isPending ? <div className="grid gap-2">{[0, 1].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}</div>
        : history.isError ? <p className="text-sm text-muted-foreground">Chưa tải được lịch sử giải đấu.</p>
          : items.length === 0 ? <p className="rounded-lg bg-soft p-4 text-sm text-muted-foreground">Chưa có giải đấu nào đã kết thúc.</p>
            : <ul className="grid gap-2">
              {items.map((item, i) => {
                const Icon = item.placement === 'CHAMPION' ? Crown : item.placement === 'RUNNER_UP' || item.placement === 'SEMI_FINAL' ? Medal : Trophy;
                return <m.li key={item.tournament.id} initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, delay: reduce ? 0 : i * 0.04 }}>
                  <Link to={`/tournaments/${item.tournament.id}`} className="flex items-center gap-3 rounded-lg bg-soft px-3 py-2.5 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
                    <span className={cn('grid size-10 shrink-0 place-items-center rounded-full bg-card', MEDAL[item.placement ?? ''] ?? 'text-muted-foreground')}><Icon aria-hidden="true" className="size-5" /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{item.tournament.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {matchTypeLabel(item.tournament.matchType)}{item.partner ? ` · cặp với ${item.partner.fullName}` : ''} · {formatDate(item.tournament.completedAt ?? item.tournament.tournamentStart)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-sm font-bold text-brand-forest">{placementLabel(item.placement)}</span>
                      {item.rankingPoints !== null && <span className="block text-xs tabular-nums text-muted-foreground">+{item.rankingPoints} điểm</span>}
                    </span>
                  </Link>
                </m.li>;
              })}
            </ul>}
      {history.data && history.data.meta.totalPages > 1 && <div className="flex justify-between gap-2">
        <Button type="button" variant="ghost" className="h-9" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Trước</Button>
        <span className="self-center text-xs text-muted-foreground">Trang {page}/{history.data.meta.totalPages}</span>
        <Button type="button" variant="ghost" className="h-9" disabled={page >= history.data.meta.totalPages} onClick={() => setPage(p => p + 1)}>Sau</Button>
      </div>}
    </section>
  </LazyMotion>;
}
