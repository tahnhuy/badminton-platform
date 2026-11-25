import { useEffect, useRef, type ComponentType } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { CalendarClock, ChevronLeft, ExternalLink, Flag, PartyPopper, Settings2, Shuffle, ShieldAlert, Swords, Trophy, Users } from 'lucide-react';
import { AnimatePresence, domAnimation, LazyMotion, m, useReducedMotion } from 'motion/react';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/common/empty-state';
import { PageContainer } from '@/components/common/page-layout';
import { ApiError } from '@/shared/api/http-client';
import { cn } from '@/shared/utils/cn';
import { StatusPill } from '../components/shared';
import { FinishPanel } from '../console/FinishPanel';
import { MatchesPanel } from '../console/MatchesPanel';
import { ParticipantsAdmin } from '../console/ParticipantsAdmin';
import { ScheduleBoard } from '../console/ScheduleBoard';
import { SeedsPanel } from '../console/SeedsPanel';
import { SetupForm } from '../console/SetupForm';
import { useTournament } from '../queries';
import { useTournamentLive } from '../live';
import type { TournamentDetail, TournamentStatus } from '../types';

const EASE = [0.2, 0.8, 0.2, 1] as const;
type Section = 'setup' | 'participants' | 'seeds' | 'schedule' | 'matches' | 'finish';
const SECTIONS: Array<{ key: Section; label: string; icon: ComponentType<{ className?: string }> }> = [
  { key: 'setup', label: 'Thiết lập', icon: Settings2 },
  { key: 'participants', label: 'Người tham gia', icon: Users },
  { key: 'seeds', label: 'Hạt giống & bốc thăm', icon: Shuffle },
  { key: 'schedule', label: 'Lịch thi đấu', icon: CalendarClock },
  { key: 'matches', label: 'Trận đấu', icon: Swords },
  { key: 'finish', label: 'Kết thúc giải', icon: PartyPopper },
];
const STEPS: Array<{ label: string; reached: TournamentStatus[] }> = [
  { label: 'Nháp', reached: ['DRAFT', 'OPEN_FOR_REGISTRATION', 'REGISTRATION_CLOSED', 'READY', 'IN_PROGRESS', 'COMPLETED'] },
  { label: 'Mở đăng ký', reached: ['OPEN_FOR_REGISTRATION', 'REGISTRATION_CLOSED', 'READY', 'IN_PROGRESS', 'COMPLETED'] },
  { label: 'Đóng đăng ký', reached: ['REGISTRATION_CLOSED', 'READY', 'IN_PROGRESS', 'COMPLETED'] },
  { label: 'Đã bốc thăm', reached: ['READY', 'IN_PROGRESS', 'COMPLETED'] },
  { label: 'Đang diễn ra', reached: ['IN_PROGRESS', 'COMPLETED'] },
  { label: 'Kết thúc', reached: ['COMPLETED'] },
];

/** The section that needs the Organizer next. */
function defaultSection(status: TournamentStatus): Section {
  switch (status) {
    case 'OPEN_FOR_REGISTRATION': return 'participants';
    case 'REGISTRATION_CLOSED': return 'seeds';
    case 'READY': return 'schedule';
    case 'IN_PROGRESS': return 'matches';
    case 'COMPLETED': return 'finish';
    default: return 'setup';
  }
}

/** `/tournaments/new` and `/tournaments/:id/manage` — Organizer console (TRN-08, prototype `viewConsole`). */
export function TournamentManagePage() {
  const params = useParams();
  if (!params.id) return <LazyMotion features={domAnimation} strict><NewTournament /></LazyMotion>;
  return <LazyMotion features={domAnimation} strict><ManageTournament id={Number(params.id)} /></LazyMotion>;
}

function NewTournament() {
  const reduce = useReducedMotion();
  return <PageContainer className="gap-5">
    <m.header initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
      className="relative overflow-hidden rounded-panel bg-linear-to-br from-brand-moss via-brand-forest to-brand-forest-deep p-6 text-primary-foreground shadow-panel">
      <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-brand-lime/20 blur-3xl motion-safe:animate-drift" />
      <BackLink to="/tournaments/mine?role=organized" label="Giải của tôi" />
      <h1 className="relative mt-2 text-3xl font-extrabold tracking-tight">Tạo giải đấu</h1>
      <p className="relative mt-1 text-sm text-brand-mint">Giải được lưu ở trạng thái nháp — chỉ bạn thấy cho tới khi mở đăng ký.</p>
    </m.header>
    <SetupForm tournament={null} />
  </PageContainer>;
}

function ManageTournament({ id }: { id: number }) {
  const reduce = useReducedMotion();
  const navigate = useNavigate();
  const detail = useTournament(id);
  const [params, setParams] = useSearchParams();
  const t = detail.data;
  useTournamentLive(id, Boolean(t?.viewer.isOrganizer) && t?.status !== 'CANCELLED');
  const requested = params.get('section') as Section | null;
  const section: Section = requested && SECTIONS.some(s => s.key === requested) ? requested : t ? defaultSection(t.status) : 'setup';
  const go = (next: Section) => setParams(p => { p.set('section', next); return p; }, { replace: true });
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // Keep the active section visible in the horizontal mobile menu.
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && active && nav.scrollWidth > nav.clientWidth) nav.scrollTo({ left: active.offsetLeft - 16, behavior: reduce ? 'auto' : 'smooth' });
  }, [section, reduce, detail.isPending]);

  if (detail.isPending) return <PageContainer><Skeleton className="h-40 rounded-panel" /><div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)]"><Skeleton className="h-72 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></div></PageContainer>;
  if (detail.isError || !t) {
    const notFound = detail.error instanceof ApiError && detail.error.statusCode === 404;
    return <PageContainer><EmptyState icon={Trophy} title={notFound ? 'Không tìm thấy giải đấu' : 'Không tải được giải đấu'} role="alert"
      description={notFound ? 'Giải có thể đã bị xoá.' : 'Kiểm tra kết nối rồi thử lại.'} action={notFound ? undefined : { label: 'Thử lại', onClick: () => detail.refetch() }} /></PageContainer>;
  }
  if (!t.viewer.isOrganizer) {
    return <PageContainer><EmptyState icon={ShieldAlert} title="Bạn không phải người tổ chức giải này" description="Chỉ người tạo giải mới quản lý được."
      action={{ label: 'Xem trang giải', onClick: () => navigate(`/tournaments/${t.id}`) }} role="alert" /></PageContainer>;
  }

  return <PageContainer className="gap-5">
    <ConsoleHeader tournament={t} />
    <div className="grid gap-5 lg:grid-cols-[15rem_minmax(0,1fr)] lg:items-start">
      <nav ref={navRef} aria-label="Mục quản lý" className="relative flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1.5 shadow-panel lg:sticky lg:top-20 lg:flex-col">
        {SECTIONS.map(({ key, label, icon: Icon }) => <button key={key} type="button" aria-current={section === key ? 'page' : undefined} onClick={() => go(key)}
          className={cn('relative flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg px-3 text-left text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
            section === key ? 'text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground')}>
          {section === key && <m.span layoutId="console-nav" aria-hidden="true" className="absolute inset-0 rounded-lg bg-brand-forest" transition={{ duration: reduce ? 0 : 0.3, ease: EASE }} />}
          <Icon className="relative size-4 shrink-0" /><span className="relative">{label}</span>
          {key === defaultSection(t.status) && section !== key && <span aria-label="Cần làm" className="relative ml-auto size-2 rounded-full bg-brand-lime-deep motion-safe:animate-pulse" />}
        </button>)}
      </nav>
      <AnimatePresence mode="wait">
        <m.div key={section} initial={reduce ? false : { opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? undefined : { opacity: 0, x: -8 }} transition={{ duration: 0.22, ease: EASE }} className="min-w-0">
          {section === 'setup' && <SetupForm tournament={t} />}
          {section === 'participants' && <ParticipantsAdmin tournament={t} />}
          {section === 'seeds' && <SeedsPanel tournament={t} onDrawn={() => go('schedule')} />}
          {section === 'schedule' && <ScheduleBoard tournament={t} />}
          {section === 'matches' && <MatchesPanel tournament={t} />}
          {section === 'finish' && <FinishPanel tournament={t} />}
        </m.div>
      </AnimatePresence>
    </div>
  </PageContainer>;
}

function BackLink({ to, label }: { to: string; label: string }) {
  return <Link to={to} className="relative inline-flex items-center gap-1 rounded-md text-sm font-semibold text-brand-mint outline-none hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-brand-lime">
    <ChevronLeft aria-hidden="true" className="size-4" />{label}
  </Link>;
}

function ConsoleHeader({ tournament: t }: { tournament: TournamentDetail }) {
  const reduce = useReducedMotion();
  const cancelled = t.status === 'CANCELLED';
  const reachedCount = STEPS.filter(s => s.reached.includes(t.status)).length;
  return <m.header initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: EASE }}
    className="relative overflow-hidden rounded-panel bg-linear-to-br from-brand-moss via-brand-forest to-brand-forest-deep p-6 text-primary-foreground shadow-panel">
    <span aria-hidden="true" className="pointer-events-none absolute -right-16 -top-20 size-72 rounded-full bg-brand-lime/20 blur-3xl motion-safe:animate-drift" />
    <span aria-hidden="true" className="pointer-events-none absolute -bottom-24 left-1/3 size-64 rounded-full bg-brand-fern/40 blur-3xl motion-safe:animate-drift-slow" />
    <div className="relative flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <BackLink to="/tournaments/mine?role=organized" label="Giải của tôi" />
        <p className="mt-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-brand-mint"><Flag aria-hidden="true" className="size-3.5" />Bảng điều khiển người tổ chức</p>
        <h1 className="mt-1 truncate text-2xl font-extrabold tracking-tight sm:text-3xl">{t.name}</h1>
      </div>
      <div className="flex items-center gap-2">
        <StatusPill status={t.status} onDark />
        {t.status !== 'DRAFT' && <Link to={`/tournaments/${t.id}`} className="inline-flex min-h-9 items-center gap-1.5 rounded-full bg-primary-foreground/10 px-3 text-sm font-semibold outline-none hover:bg-primary-foreground/20 focus-visible:ring-2 focus-visible:ring-brand-lime">
          Trang công khai<ExternalLink aria-hidden="true" className="size-3.5" /></Link>}
      </div>
    </div>
    {cancelled ? <p className="relative mt-5 rounded-2xl bg-danger-bg px-4 py-3 text-sm font-semibold text-danger">Giải đã bị huỷ{t.cancelReason ? `: ${t.cancelReason}` : ''}. Lệ phí đã được hoàn cho người tham gia.</p>
      : <ol aria-label="Tiến trình giải" className="relative mt-5 grid grid-cols-6 gap-1.5">
        {STEPS.map((step, i) => {
          const reached = i < reachedCount;
          const current = i === reachedCount - 1;
          return <li key={step.label} aria-current={current ? 'step' : undefined} className="min-w-0">
            <span className="block h-1.5 overflow-hidden rounded-full bg-primary-foreground/15">
              <m.span className="block h-full origin-left rounded-full bg-brand-lime" initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: reached ? 1 : 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : 0.2 + i * 0.12 }} />
            </span>
            <span className={cn('mt-1.5 hidden truncate text-xs sm:block', current ? 'font-bold text-primary-foreground' : reached ? 'text-brand-mint' : 'text-primary-foreground/50')}>{step.label}</span>
          </li>;
        })}
      </ol>}
    <p className="relative mt-2 text-xs text-brand-mint sm:hidden">Bước {reachedCount}/6: {STEPS[reachedCount - 1]?.label}</p>
  </m.header>;
}
