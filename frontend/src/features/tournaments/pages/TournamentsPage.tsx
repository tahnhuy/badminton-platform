import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Gauge, ListChecks, Medal, Plus, Search, Trophy } from 'lucide-react';
import { domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { EmptyState } from '@/components/common/empty-state';
import { Pagination } from '@/components/common/pagination';
import { PageContainer } from '@/components/common/page-layout';
import { profileApi } from '@/features/player/profile/profile-api';
import { useAuth } from '@/features/auth/auth-context';
import { cn } from '@/shared/utils/cn';
import { useTournamentList } from '../queries';
import { TournamentCard } from '../components/TournamentCard';
import type { ListFilters, MatchType, Tournament, TournamentStatus } from '../types';

const EASE = [0.2, 0.8, 0.2, 1] as const;
type StatusFilter = 'all' | 'open' | 'ready' | 'live' | 'done';
const STATUS_MAP: Record<StatusFilter, TournamentStatus | undefined> = { all: undefined, open: 'OPEN_FOR_REGISTRATION', ready: 'READY', live: 'IN_PROGRESS', done: 'COMPLETED' };

/** `/tournaments` — discovery list (TRN-07, prototype `viewList`). */
export function TournamentsPage() {
  const reduce = useReducedMotion();
  const [search, setSearch] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [type, setType] = useState<'all' | MatchType>('all');
  const [free, setFree] = useState(false);
  const [fit, setFit] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const { user } = useAuth();
  const isPlayer = user?.role === 'PLAYER';
  useEffect(() => { const timer = setTimeout(() => { setQ(search); setPage(1); }, 300); return () => clearTimeout(timer); }, [search]);

  const filters: ListFilters = { page, q, status: STATUS_MAP[status], matchType: type === 'all' ? undefined : type, free: free || undefined, eligibleForMe: (isPlayer && fit) || undefined,
    // Dates are picked in Vietnam time (+07:00): whole days, start of tournament within the range.
    from: from ? `${from}T00:00:00+07:00` : undefined, to: to ? `${to}T23:59:59+07:00` : undefined };
  const list = useTournamentList(filters);
  const profile = useQuery({ queryKey: ['players', 'me', 'profile'], queryFn: ({ signal }) => profileApi.own(signal), staleTime: 60_000, enabled: isPlayer });
  const myRank = profile.data?.skillLevel?.rank ?? null;
  const fits = (t: Tournament) => myRank !== null && t.status === 'OPEN_FOR_REGISTRATION'
    && (t.minSkillLevel === null || myRank >= t.minSkillLevel.rank) && (t.maxSkillLevel === null || myRank <= t.maxSkillLevel.rank);
  const reset = (fn: () => void) => { fn(); setPage(1); };

  return <LazyMotion features={domAnimation} strict>
    <PageContainer>
      <m.section initial={reduce ? false : { opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
        className="relative overflow-hidden rounded-panel bg-linear-to-br from-brand-moss via-brand-forest to-brand-forest-deep px-6 py-8 text-primary-foreground shadow-panel sm:px-10 sm:py-10">
        <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full bg-brand-lime/20 blur-3xl motion-safe:animate-drift" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 size-72 rounded-full bg-brand-fern/40 blur-3xl motion-safe:animate-drift-slow" />
        <Trophy aria-hidden="true" className="pointer-events-none absolute -bottom-6 right-6 size-40 text-brand-lime/10 motion-safe:animate-float" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-2xs font-bold uppercase tracking-widest text-brand-lime">Giải chuyên nghiệp</p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">Giải đấu</h1>
            <p className="mt-3 text-sm leading-6 text-brand-mint sm:text-base">Tìm giải hợp trình độ, đăng ký và trả lệ phí bằng ví. Kết quả giải chuyên nghiệp ghi lại thành tích và phong độ của bạn.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isPlayer && <Button asChild variant="outline" className="h-11 border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground">
              <Link to="/tournaments/mine"><ListChecks aria-hidden="true" />Giải của tôi</Link>
            </Button>}
            <Button asChild variant="outline" className="h-11 border-primary-foreground/25 bg-primary-foreground/10 text-primary-foreground hover:bg-primary-foreground/20 hover:text-primary-foreground">
              <Link to="/tournaments/rankings"><Medal aria-hidden="true" />Bảng xếp hạng</Link>
            </Button>
            {isPlayer && <Button asChild className="h-11 bg-brand-lime text-brand-forest hover:bg-brand-lime-deep">
              <Link to="/tournaments/new"><Plus aria-hidden="true" />Tạo giải</Link>
            </Button>}
          </div>
        </div>
      </m.section>

      <section aria-label="Bộ lọc" className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-3 shadow-panel lg:flex-row lg:items-center">
        <label className="flex h-11 min-w-0 flex-1 items-center gap-2 rounded-lg border border-input bg-background px-3 focus-within:ring-2 focus-within:ring-ring">
          <Search aria-hidden="true" className="size-4 text-muted-foreground" />
          <span className="sr-only">Tìm giải theo tên</span>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Tìm theo tên giải" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>
        {/* Five chips: scroll inside the bar on phones instead of widening the page. */}
        <div className="min-w-0 overflow-x-auto">
        <ToggleGroup type="single" value={status} onValueChange={v => v && reset(() => setStatus(v as StatusFilter))} aria-label="Trạng thái" className="flex-nowrap">
          {([['all', 'Tất cả'], ['open', 'Đang mở'], ['ready', 'Sắp đấu'], ['live', 'Đang đấu'], ['done', 'Đã xong']] as const).map(([v, label]) =>
            <ToggleGroupItem key={v} value={v} className="min-h-9 whitespace-nowrap px-3 text-xs">{label}</ToggleGroupItem>)}
        </ToggleGroup>
        </div>
        <ToggleGroup type="single" value={type} onValueChange={v => v && reset(() => setType(v as 'all' | MatchType))} aria-label="Nội dung" className="flex-nowrap">
          {([['all', 'Đơn & đôi'], ['SINGLES', 'Đơn'], ['DOUBLES', 'Đôi']] as const).map(([v, label]) =>
            <ToggleGroupItem key={v} value={v} className="min-h-9 whitespace-nowrap px-3 text-xs">{label}</ToggleGroupItem>)}
        </ToggleGroup>
        <div className="flex gap-2">
          <FilterToggle pressed={free} onClick={() => reset(() => setFree(v => !v))}>Miễn phí</FilterToggle>
          {isPlayer && <FilterToggle pressed={fit} onClick={() => reset(() => setFit(v => !v))}><Gauge aria-hidden="true" className="size-4" />Hợp trình độ tôi</FilterToggle>}
        </div>
        <div className="grid grid-cols-2 gap-2 lg:flex lg:items-center">
          <label className="flex min-w-0 flex-col text-2xs font-semibold text-muted-foreground">Từ ngày
            <input type="date" value={from} max={to || undefined} onChange={e => reset(() => setFrom(e.target.value))} className="h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
          <label className="flex min-w-0 flex-col text-2xs font-semibold text-muted-foreground">Đến ngày
            <input type="date" value={to} min={from || undefined} onChange={e => reset(() => setTo(e.target.value))} className="h-9 w-full min-w-0 rounded-lg border border-input bg-background px-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" />
          </label>
        </div>
      </section>

      {list.isPending
        ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-64 rounded-2xl" />)}</div>
        : list.isError
          ? <EmptyState icon={Trophy} title="Không tải được danh sách giải" description="Kiểm tra kết nối rồi thử lại." action={{ label: 'Thử lại', onClick: () => list.refetch() }} role="alert" />
          : list.data.data.length === 0
            ? <EmptyState icon={Trophy} title="Chưa có giải phù hợp" description="Thử bỏ bớt bộ lọc, hoặc tự tạo một giải cho cộng đồng của bạn." />
            : <div className={cn('grid gap-4 transition-opacity sm:grid-cols-2 xl:grid-cols-3', list.isFetching && 'opacity-70')}>
              {list.data.data.map((t, i) => <TournamentCard key={t.id} tournament={t} index={i} fits={fits(t)} />)}
            </div>}
      {list.data && list.data.meta.totalPages > 1 && <Pagination page={page} totalPages={list.data.meta.totalPages} onPageChange={setPage} disabled={list.isFetching} />}
    </PageContainer>
  </LazyMotion>;
}

function FilterToggle({ pressed, onClick, children }: { pressed: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" aria-pressed={pressed} onClick={onClick}
    className={cn('inline-flex h-11 items-center gap-2 whitespace-nowrap rounded-lg border px-3 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
      pressed ? 'border-primary bg-accent text-primary' : 'border-border bg-card text-muted-foreground hover:text-foreground')}>{children}</button>;
}
