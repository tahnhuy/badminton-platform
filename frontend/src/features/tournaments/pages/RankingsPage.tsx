import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Crown, Medal, Trophy } from 'lucide-react';
import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { Pagination } from '@/components/common/pagination';
import { PageContainer } from '@/components/common/page-layout';
import { cn } from '@/shared/utils/cn';
import { skillLevelOptionsQuery } from '../queries';
import { tournamentApi } from '../tournament-api';
import type { LeaderboardRow, MatchType } from '../types';
import { PlayerAvatar } from '../components/shared';

const EASE = [0.2, 0.8, 0.2, 1] as const;
const PODIUM = [
  { place: 2, height: 'h-24', icon: Medal, tone: 'text-brand-mint', delay: 0.15 },
  { place: 1, height: 'h-32', icon: Crown, tone: 'text-medal-gold', delay: 0 },
  { place: 3, height: 'h-20', icon: Medal, tone: 'text-caution', delay: 0.3 },
];

/** `/tournaments/rankings` — achievement leaderboards (PRD FR-82/83, TRN-18). */
export function RankingsPage() {
  const reduce = useReducedMotion();
  const [matchType, setMatchType] = useState<MatchType>('SINGLES');
  const [level, setLevel] = useState('');
  const [page, setPage] = useState(1);
  const levels = useQuery(skillLevelOptionsQuery);
  const board = useQuery({
    queryKey: ['tournaments', 'rankings', matchType, level, page],
    queryFn: () => tournamentApi.rankings(matchType, level ? Number(level) : null, page),
    placeholderData: keepPreviousData,
  });
  const rows = board.data?.data ?? [];
  const podium = page === 1 ? rows.slice(0, 3) : [];
  const rest = page === 1 ? rows.slice(3) : rows;

  return <LazyMotion features={domAnimation} strict>
    <PageContainer className="gap-5">
      <m.header initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
        className="relative overflow-hidden rounded-panel bg-linear-to-br from-brand-moss via-brand-forest to-brand-forest-deep p-6 text-primary-foreground shadow-panel sm:p-8">
        <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-80 rounded-full bg-brand-lime/20 blur-3xl motion-safe:animate-drift" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-10 size-64 rounded-full bg-brand-fern/40 blur-3xl motion-safe:animate-drift-slow" />
        <Link to="/tournaments" className="relative text-sm font-semibold text-brand-mint outline-none hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-brand-lime">Giải đấu</Link>
        <h1 className="relative mt-1 flex items-center gap-3 text-3xl font-extrabold tracking-tight sm:text-4xl"><Trophy aria-hidden="true" className="size-8 text-medal-gold motion-safe:animate-float" />Bảng xếp hạng</h1>
        <p className="relative mt-2 max-w-2xl text-sm text-brand-mint">
          Tổng {board.data?.meta.bestN ?? 4} kết quả tốt nhất trong {board.data?.meta.windowMonths ?? 12} tháng. Điểm theo thành tích (vô địch 100, á quân 70, bán kết 50, tứ kết 30), nhân độ mạnh và quy mô giải. Điểm xếp hạng không ảnh hưởng trình độ.
        </p>
      </m.header>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div role="tablist" aria-label="Nội dung" className="flex gap-1 rounded-2xl border border-border bg-card p-1 shadow-panel">
          {(['SINGLES', 'DOUBLES'] as const).map(type => <button key={type} type="button" role="tab" aria-selected={matchType === type} onClick={() => { setMatchType(type); setPage(1); }}
            className={cn('relative min-h-11 rounded-lg px-5 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring', matchType === type ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
            {matchType === type && <m.span layoutId="ranking-tab" aria-hidden="true" className="absolute inset-0 rounded-lg bg-brand-forest" transition={{ duration: reduce ? 0 : 0.3, ease: EASE }} />}
            <span className="relative">{type === 'SINGLES' ? 'Đơn' : 'Đôi'}</span>
          </button>)}
        </div>
        <div className="flex w-56 flex-col gap-1">
          <label htmlFor="ranking-level" className="text-xs font-semibold text-muted-foreground">Trình độ hiện tại</label>
          <Select id="ranking-level" value={level} onChange={value => { setLevel(value); setPage(1); }}
            options={[{ value: '', label: 'Tất cả trình độ' }, ...(levels.data ?? []).map(l => ({ value: String(l.id), label: l.name }))]} />
        </div>
      </div>

      {board.isPending ? <div className="grid gap-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
        : board.isError ? <EmptyState icon={Trophy} title="Không tải được bảng xếp hạng" description="Kiểm tra kết nối rồi thử lại." action={{ label: 'Thử lại', onClick: () => board.refetch() }} role="alert" />
          : rows.length === 0 ? <EmptyState icon={Trophy} title="Chưa có ai trên bảng xếp hạng" description="Điểm xuất hiện khi các giải đấu chuyên nghiệp kết thúc." />
            : <AnimatePresence mode="wait">
              <m.div key={`${matchType}-${level}-${page}`} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0 }} transition={{ duration: 0.25, ease: EASE }} className="flex flex-col gap-5">
                {podium.length > 0 && <ol aria-label="Top 3" className="grid grid-cols-3 items-end gap-2 sm:gap-4">
                  {PODIUM.map(spot => {
                    const row = podium[spot.place - 1];
                    if (!row) return <li key={spot.place} />;
                    const Icon = spot.icon;
                    return <m.li key={spot.place} initial={reduce ? false : { opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ type: 'spring', bounce: 0.35, duration: 0.7, delay: reduce ? 0 : spot.delay }}
                      className="flex min-w-0 flex-col items-center gap-2 text-center">
                      <Icon aria-hidden="true" className={cn('size-7', spot.tone, spot.place === 1 && 'motion-safe:animate-float')} />
                      <PlayerAvatar player={row.player} size="lg" className={cn(spot.place === 1 && 'ring-4 ring-medal-gold')} />
                      <p className="w-full truncate text-sm font-bold">{row.player.fullName}</p>
                      <p className="text-xs text-muted-foreground">{row.player.level?.name ?? '—'}</p>
                      <div className={cn('relative flex w-full flex-col items-center justify-center overflow-hidden rounded-t-2xl bg-linear-to-b from-brand-forest to-brand-forest-deep text-primary-foreground', spot.height)}>
                        {spot.place === 1 && <span aria-hidden="true" className="absolute inset-0 bg-linear-to-r from-transparent via-white/15 to-transparent motion-safe:animate-shine" />}
                        <span className="relative text-2xl font-extrabold">{spot.place}</span>
                        <span className="relative text-xs tabular-nums text-brand-mint">{row.totalPoints} điểm</span>
                      </div>
                    </m.li>;
                  })}
                </ol>}
                {rest.length > 0 && <ol className="grid gap-2">
                  {rest.map((row, i) => <Row key={row.player.id} row={row} index={i} />)}
                </ol>}
                {(board.data?.meta.totalPages ?? 1) > 1 && <Pagination page={page} totalPages={board.data!.meta.totalPages} onPageChange={setPage} />}
              </m.div>
            </AnimatePresence>}
    </PageContainer>
  </LazyMotion>;
}

function Row({ row, index }: { row: LeaderboardRow; index: number }) {
  const reduce = useReducedMotion();
  return <m.li initial={reduce ? false : { opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.25, ease: EASE, delay: reduce ? 0 : Math.min(index, 12) * 0.03 }}
    className="flex items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
    <span className="w-8 text-center text-lg font-extrabold tabular-nums text-muted-foreground">{row.position}</span>
    <PlayerAvatar player={row.player} />
    <div className="min-w-0 flex-1"><p className="truncate font-semibold">{row.player.fullName}</p>
      <p className="text-xs text-muted-foreground">{row.player.level?.name ?? '—'} · {row.tournamentsCounted} giải tính điểm</p></div>
    <span className="text-right"><span className="block text-lg font-bold tabular-nums text-brand-forest">{row.totalPoints}</span><span className="text-xs text-muted-foreground">điểm</span></span>
  </m.li>;
}
