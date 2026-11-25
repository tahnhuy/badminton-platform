import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Crown, Mail, Plus, Ticket, Trophy } from 'lucide-react';
import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { PageContainer } from '@/components/common/page-layout';
import { Pagination } from '@/components/common/pagination';
import { cn } from '@/shared/utils/cn';
import { TournamentCard } from '../components/TournamentCard';
import { useMyTournaments } from '../queries';

const EASE = [0.2, 0.8, 0.2, 1] as const;
type Role = 'organized' | 'registered' | 'invited';
const TABS: Array<{ role: Role; label: string; icon: typeof Trophy; empty: string; hint: string }> = [
  { role: 'registered', label: 'Đã đăng ký', icon: Ticket, empty: 'Bạn chưa đăng ký giải nào', hint: 'Tìm một giải hợp trình và đăng ký ngay.' },
  { role: 'organized', label: 'Tôi tổ chức', icon: Crown, empty: 'Bạn chưa tổ chức giải nào', hint: 'Tạo giải đầu tiên — hệ thống lo bốc thăm và xếp lịch.' },
  { role: 'invited', label: 'Lời mời', icon: Mail, empty: 'Không có lời mời nào', hint: 'Lời mời ghép đội đánh đôi sẽ xuất hiện ở đây.' },
];

/** `/tournaments/mine` — tournaments the Player organizes, joined or is invited to (TRN-07/08). */
export function MyTournamentsPage() {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const requested = params.get('role') as Role | null;
  const role: Role = requested && TABS.some(x => x.role === requested) ? requested : 'registered';
  const requestedPage = Number(params.get('page') ?? 1);
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1;
  const setPage = (next: number) => setParams({ role, page: String(next) });
  const list = useMyTournaments(role, page);
  const tab = TABS.find(x => x.role === role)!;
  const items = list.data?.data ?? [];
  // Past the last page (withdrew the only item there, or a stale link): go to the last real page.
  const lastPage = list.data?.meta.totalPages ?? 0;
  useEffect(() => {
    if (!list.isPlaceholderData && lastPage >= 1 && page > lastPage) setParams({ role, page: String(lastPage) }, { replace: true });
  }, [lastPage, page, role, list.isPlaceholderData, setParams]);

  return <LazyMotion features={domAnimation} strict>
    <PageContainer className="gap-5">
      <m.header initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
        className="relative flex flex-wrap items-end justify-between gap-4 overflow-hidden rounded-panel bg-linear-to-br from-brand-moss via-brand-forest to-brand-forest-deep p-6 text-primary-foreground shadow-panel">
        <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-brand-lime/20 blur-3xl motion-safe:animate-drift" />
        <div className="relative">
          <Link to="/tournaments" className="text-sm font-semibold text-brand-mint outline-none hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-brand-lime">Giải đấu</Link>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight">Giải của tôi</h1>
        </div>
        <Button asChild variant="brand" className="relative h-11"><Link to="/tournaments/new"><Plus aria-hidden="true" />Tạo giải</Link></Button>
      </m.header>

      <div role="tablist" aria-label="Loại giải" className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1 shadow-panel">
        {TABS.map(({ role: r, label, icon: Icon }) => <button key={r} type="button" role="tab" aria-selected={role === r} onClick={() => setParams({ role: r }, { replace: true })}
          className={cn('relative flex min-h-11 flex-1 shrink-0 items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
            role === r ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
          {role === r && <m.span layoutId="mine-tab" aria-hidden="true" className="absolute inset-0 rounded-lg bg-brand-forest" transition={{ duration: reduce ? 0 : 0.3, ease: EASE }} />}
          <Icon aria-hidden="true" className="relative size-4" /><span className="relative">{label}</span>
        </button>)}
      </div>

      <AnimatePresence mode="wait">
        <m.div key={role} role="tabpanel" aria-label={tab.label} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.2, ease: EASE }}>
          {list.isPending ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className="h-60 rounded-2xl" />)}</div>
            : list.isError ? <EmptyState icon={Trophy} title="Không tải được danh sách" description="Kiểm tra kết nối rồi thử lại." action={{ label: 'Thử lại', onClick: () => list.refetch() }} role="alert" />
              : items.length === 0 ? <EmptyState icon={tab.icon} title={tab.empty} description={tab.hint}
                action={role === 'organized' ? { label: 'Tạo giải', onClick: () => navigate('/tournaments/new') } : role === 'registered' ? { label: 'Khám phá giải đấu', onClick: () => navigate('/tournaments') } : undefined} />
                : <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {items.map((t, i) => <li key={t.id}><TournamentCard tournament={t} index={i} href={role === 'organized' ? `/tournaments/${t.id}/manage` : undefined} /></li>)}
                </ul>}
        </m.div>
      </AnimatePresence>
      {list.data && list.data.meta.totalPages > 1 && <Pagination page={page} totalPages={list.data.meta.totalPages} onPageChange={setPage} disabled={list.isFetching} />}
    </PageContainer>
  </LazyMotion>;
}
