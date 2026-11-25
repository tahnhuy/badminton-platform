import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle, CalendarDays, Check, ChevronLeft, Clock, Flag, MapPin, Radio, Settings2, Shuffle, Trophy, User, Users,
} from 'lucide-react';
import { domAnimation, LazyMotion, m, AnimatePresence, useReducedMotion } from 'motion/react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { EmptyState } from '@/components/common/empty-state';
import { PageContainer } from '@/components/common/page-layout';
import { ApiError } from '@/shared/api/http-client';
import { cn } from '@/shared/utils/cn';
import { Bracket } from '../components/Bracket';
import { RegisterDialog } from '../components/RegisterDialog';
import { Chip, Notice, PlayerAvatar, SeedBadge, StatusPill, sideName } from '../components/shared';
import {
  feeLabel, formatDateTime, formatDay, formatTime, levelRange, matchTypeLabel, roundName, unitLabel,
} from '../format';
import { useBracket, useParticipants, useSchedule, useTournament, useTournamentMutation } from '../queries';
import { tournamentApi } from '../tournament-api';
import type { Bracket as BracketData, ScheduleItem, TournamentDetail } from '../types';

const EASE = [0.2, 0.8, 0.2, 1] as const;
type Tab = 'info' | 'people' | 'bracket' | 'schedule';
const DRAWN = ['READY', 'IN_PROGRESS', 'COMPLETED'];

/** `/tournaments/:id` — detail with four tabs (TRN-07, prototype `viewDetail`). */
export function TournamentDetailPage() {
  const id = Number(useParams().id);
  const reduce = useReducedMotion();
  const [tab, setTab] = useState<Tab>('info');
  const detail = useTournament(id);
  const t = detail.data;
  const drawn = t ? DRAWN.includes(t.status) : false;
  const participants = useParticipants(id, Boolean(t));
  const bracket = useBracket(id, t?.status, drawn);
  const schedule = useSchedule(id, t?.status, drawn);

  if (detail.isPending) return <PageContainer><Skeleton className="h-72 rounded-panel" /><Skeleton className="h-12 rounded-2xl" /><Skeleton className="h-80 rounded-2xl" /></PageContainer>;
  if (detail.isError || !t) {
    const notFound = detail.error instanceof ApiError && detail.error.statusCode === 404;
    return <PageContainer><EmptyState icon={Trophy} title={notFound ? 'Không tìm thấy giải đấu' : 'Không tải được giải đấu'}
      description={notFound ? 'Giải có thể đã bị xoá hoặc chưa được công bố.' : 'Kiểm tra kết nối rồi thử lại.'}
      action={notFound ? undefined : { label: 'Thử lại', onClick: () => detail.refetch() }} role="alert" /></PageContainer>;
  }

  const tabs: Array<{ key: Tab; label: string; icon: typeof Flag; count?: number }> = [
    { key: 'info', label: 'Thông tin', icon: Flag },
    { key: 'people', label: 'Người tham gia', icon: Users, count: t.confirmedCount },
    { key: 'bracket', label: 'Nhánh đấu', icon: Trophy },
    { key: 'schedule', label: 'Lịch thi đấu', icon: Clock },
  ];

  return <LazyMotion features={domAnimation} strict>
    <PageContainer className="gap-5">
      <Hero tournament={t} />
      <div role="tablist" aria-label="Nội dung giải" className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1 shadow-panel">
        {tabs.map(({ key, label, icon: Icon, count }) => <button key={key} type="button" role="tab" id={`tab-${key}`} aria-selected={tab === key} aria-controls={`panel-${key}`}
          onClick={() => setTab(key)}
          className={cn('relative flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-sm font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
            tab === key ? 'text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}>
          {tab === key && <m.span layoutId="tournament-tab" aria-hidden="true" className="absolute inset-0 rounded-lg bg-brand-forest" transition={{ duration: reduce ? 0 : 0.3, ease: EASE }} />}
          <Icon aria-hidden="true" className="relative size-4" /><span className="relative">{label}</span>
          {count !== undefined && <span className={cn('relative rounded-full px-1.5 text-2xs', tab === key ? 'bg-primary-foreground/20' : 'bg-muted')}>{count}</span>}
        </button>)}
      </div>
      <AnimatePresence mode="wait">
        <m.div key={tab} role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}
          initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reduce ? undefined : { opacity: 0, y: -6 }} transition={{ duration: 0.22, ease: EASE }}>
          {tab === 'info' && <InfoTab tournament={t} schedule={schedule.data?.matches} bracket={bracket.data} />}
          {tab === 'people' && <PeopleTab tournament={t} loading={participants.isPending} participants={participants.data ?? []} />}
          {tab === 'bracket' && (!drawn ? <NotDrawn tournament={t} /> : bracket.isPending ? <Skeleton className="h-96 rounded-2xl" />
            : bracket.data ? <Bracket bracket={bracket.data} highlightRegistrationId={t.viewer.registrationId} /> : null)}
          {tab === 'schedule' && (!drawn ? <NotDrawn tournament={t} /> : <ScheduleTab tournament={t} items={schedule.data?.matches} bracket={bracket.data} />)}
        </m.div>
      </AnimatePresence>
    </PageContainer>
  </LazyMotion>;
}

// ---------------------------------------------------------------------------------------- hero

function Hero({ tournament: t }: { tournament: TournamentDetail }) {
  const reduce = useReducedMotion();
  const stats = [
    { label: 'Lệ phí', value: feeLabel(t.entryFee) },
    { label: 'Trình độ', value: levelRange(t.minSkillLevel, t.maxSkillLevel) },
    { label: 'Số lượng', value: `${t.confirmedCount}/${t.participantLimit} ${unitLabel(t.matchType)}` },
    { label: 'Thể thức', value: 'Loại trực tiếp · 3 set 21' },
  ];
  return <m.section initial={reduce ? false : { opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
    className="relative overflow-hidden rounded-panel bg-linear-to-br from-brand-moss via-brand-forest to-brand-forest-deep p-6 text-primary-foreground shadow-panel sm:p-8">
    <span aria-hidden="true" className="pointer-events-none absolute -right-20 -top-24 size-96 rounded-full bg-brand-lime/20 blur-3xl motion-safe:animate-drift" />
    <span aria-hidden="true" className="pointer-events-none absolute -bottom-32 left-10 size-80 rounded-full bg-brand-fern/40 blur-3xl motion-safe:animate-drift-slow" />
    <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
      <div className="min-w-0">
        <Link to="/tournaments" className="inline-flex items-center gap-1 rounded-md text-sm font-semibold text-brand-mint outline-none hover:text-primary-foreground focus-visible:ring-2 focus-visible:ring-brand-lime">
          <ChevronLeft aria-hidden="true" className="size-4" />Tất cả giải
        </Link>
        <div className="mt-3 flex flex-wrap gap-2">
          <StatusPill status={t.status} onDark />
          <Chip icon={Trophy} className="bg-primary-foreground/10 text-primary-foreground">Chuyên nghiệp</Chip>
          <Chip className="bg-primary-foreground/10 text-primary-foreground">{matchTypeLabel(t.matchType)}</Chip>
        </div>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{t.name}</h1>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm text-brand-mint">
          <span className="flex items-center gap-1.5"><CalendarDays aria-hidden="true" className="size-4" />{formatDateTime(t.tournamentStart)}</span>
          {t.venueNote && <span className="flex items-center gap-1.5"><MapPin aria-hidden="true" className="size-4" />{t.venueNote}</span>}
          {t.organizer && <span className="flex items-center gap-1.5"><User aria-hidden="true" className="size-4" />Tổ chức: {t.organizer.fullName}</span>}
        </div>
      </div>
      <HeroAction tournament={t} />
    </div>
    <dl className="relative mt-6 grid grid-cols-2 overflow-hidden rounded-2xl bg-primary-foreground/10 lg:grid-cols-4">
      {stats.map((s, i) => <m.div key={s.label} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: EASE, delay: reduce ? 0 : 0.15 + i * 0.07 }}
        className="border-primary-foreground/10 bg-brand-forest-deep/50 px-4 py-3 odd:border-r lg:border-r lg:last:border-r-0">
        <dt className="text-xs text-brand-mint">{s.label}</dt><dd className="mt-0.5 font-bold">{s.value}</dd>
      </m.div>)}
    </dl>
  </m.section>;
}

function HeroAction({ tournament: t }: { tournament: TournamentDetail }) {
  const [registerOpen, setRegisterOpen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const register = useTournamentMutation(t.id, () => tournamentApi.register(t.id), 'Đăng ký thành công — chúc bạn thi đấu tốt!');
  const withdraw = useTournamentMutation(t.id, () => tournamentApi.withdraw(t.id, t.viewer.registrationId!),
    r => (r.refundedAt ? 'Đã rút đăng ký và hoàn lệ phí về ví.' : 'Đã rút đăng ký.'));
  const note = (text: string) => <p className="max-w-xs text-sm text-brand-mint lg:text-right">{text}</p>;
  const wrap = (children: React.ReactNode) => <div className="flex flex-col items-start gap-2.5 lg:items-end">{children}</div>;
  const open = t.status === 'OPEN_FOR_REGISTRATION';

  if (t.viewer.isOrganizer) return wrap(<>
    <Button asChild className="h-12 bg-brand-lime px-6 text-brand-forest hover:bg-brand-lime-deep"><Link to={`/tournaments/${t.id}/manage`}><Settings2 aria-hidden="true" />Quản lý giải</Link></Button>
    {note('Bạn là Organizer của giải này.')}
  </>);
  if (t.viewer.registrationId !== null) return wrap(<>
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-lime px-3 py-1.5 text-sm font-bold text-brand-forest"><Check aria-hidden="true" className="size-4" />Bạn đã đăng ký</span>
    {open
      ? <Button type="button" variant="outline" className="h-10 border-primary-foreground/30 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground" onClick={() => setWithdrawOpen(true)}>Rút đăng ký</Button>
      : note('Đã đóng đăng ký: không thể rút. Vắng mặt sẽ bị xử thua, không hoàn lệ phí.')}
    {withdrawOpen && <ConfirmDialog title="Rút đăng ký?" tone="danger" confirmLabel="Rút đăng ký" busyLabel="Đang rút…" busy={withdraw.isPending}
      description={t.entryFee > 0 ? <p>Bạn được hoàn <b>{feeLabel(t.entryFee)}</b> về ví ngay. Có thể đăng ký lại khi giải còn chỗ.</p> : <p>Bạn có thể đăng ký lại khi giải còn chỗ.</p>}
      onCancel={() => setWithdrawOpen(false)} onConfirm={() => withdraw.mutate(undefined, { onSettled: () => setWithdrawOpen(false) })} />}
  </>);
  if (!open) return wrap(note(t.status === 'CANCELLED' ? `Giải đã huỷ${t.cancelReason ? `: ${t.cancelReason}` : ''}.` : 'Giải không còn nhận đăng ký.'));
  if (t.matchType === 'DOUBLES') return wrap(<>
    <Button type="button" disabled className="h-12 bg-brand-lime px-6 text-brand-forest">Đăng ký theo đội</Button>
    {note('Đăng ký giải đôi theo đội sẽ có trong bản cập nhật tới.')}
  </>);
  const reason = t.viewer.ineligibleReason;
  if (reason === 'BELOW_MIN_LEVEL' || reason === 'ABOVE_MAX_LEVEL') return wrap(<>
    <Button type="button" disabled className="h-12 bg-brand-lime px-6 text-brand-forest">Đăng ký</Button>
    <p className="flex max-w-xs gap-1.5 text-sm text-brand-mint lg:text-right"><AlertTriangle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />Giải dành cho trình {levelRange(t.minSkillLevel, t.maxSkillLevel)}.</p>
  </>);
  if (t.slotsLeft === 0) return wrap(note('Giải đã đủ người.'));
  return wrap(<>
    <m.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.98 }}>
      <Button type="button" className="relative h-12 overflow-hidden bg-brand-lime px-6 text-base text-brand-forest shadow-lg hover:bg-brand-lime-deep" onClick={() => setRegisterOpen(true)}>
        <span aria-hidden="true" className="absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-primary-foreground/40 motion-safe:animate-shine" />
        <span className="relative">Đăng ký · {feeLabel(t.entryFee)}</span>
      </Button>
    </m.div>
    {note(t.entryFee > 0 ? 'Trừ ví khi đăng ký. Rút trước hạn được hoàn 100%.' : 'Miễn phí — xác nhận ngay.')}
    <RegisterDialog tournament={t} open={registerOpen} onOpenChange={setRegisterOpen} busy={register.isPending}
      onConfirm={() => register.mutate(undefined, { onSuccess: () => setRegisterOpen(false) })} />
  </>);
}

// ---------------------------------------------------------------------------------------- tabs

function NotDrawn({ tournament: t }: { tournament: TournamentDetail }) {
  return <EmptyState icon={Shuffle} title="Chưa bốc thăm"
    description={`Nhánh đấu và lịch thi đấu xuất hiện sau khi Organizer đóng đăng ký và bốc thăm${t.status === 'OPEN_FOR_REGISTRATION' ? ` (hạn đăng ký ${formatDateTime(t.registrationEnd)})` : ''}.`} />;
}

function nextMatchOf(registrationId: number | null, items?: ScheduleItem[]) {
  if (registrationId === null || !items) return null;
  return items.filter(m => (m.registration1Id === registrationId || m.registration2Id === registrationId) && (m.status === 'CONFIRMED' || m.status === 'IN_PROGRESS'))
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))[0] ?? null;
}

function opponentName(item: ScheduleItem, registrationId: number, bracket?: BracketData) {
  const match = bracket?.rounds.flatMap(r => r.matches).find(m => m.id === item.id);
  if (!match) return null;
  const other = match.slot1.registrationId === registrationId ? match.slot2 : match.slot1;
  return other.registrationId === null ? null : { name: sideName(other.players, other.teamName), seed: other.seedNo };
}

function InfoTab({ tournament: t, schedule, bracket }: { tournament: TournamentDetail; schedule?: ScheduleItem[]; bracket?: BracketData }) {
  const reduce = useReducedMotion();
  const next = nextMatchOf(t.viewer.registrationId, schedule);
  const opponent = next && t.viewer.registrationId !== null ? opponentName(next, t.viewer.registrationId, bracket) : null;
  const rows: Array<[string, string]> = [
    ['Thời gian thi đấu', `${formatDateTime(t.tournamentStart)} → ${formatDateTime(t.tournamentEnd)}`],
    ['Hạn đăng ký', formatDateTime(t.registrationEnd)],
    ['Địa điểm', t.venueNote ?? 'Chưa cập nhật'],
    ['Nội dung', `${matchTypeLabel(t.matchType)} · loại trực tiếp · 3 set, set 21 điểm (cách 2, tối đa 30)`],
    ['Trình độ', levelRange(t.minSkillLevel, t.maxSkillLevel)],
    ['Lệ phí', t.entryFee === 0 ? 'Miễn phí' : `${feeLabel(t.entryFee)} — trừ ví khi đăng ký; rút trước hạn hoàn 100%`],
    ['Sân thi đấu', `${t.schedule.courtCount} sân · mỗi trận ~${t.schedule.matchDurationMinutes} phút · ${t.schedule.dailyStartTime}–${t.schedule.dailyEndTime}`],
  ];
  return <div className="grid gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(18rem,1fr)]">
    <section className="rounded-2xl border border-border bg-card p-5 shadow-panel sm:p-6">
      <h2 className="text-lg font-bold tracking-tight">Thông tin giải</h2>
      <dl className="mt-4 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-[10rem_minmax(0,1fr)]">
        {rows.map(([k, v]) => <div key={k} className="contents"><dt className="text-muted-foreground">{k}</dt><dd className="font-semibold">{v}</dd></div>)}
      </dl>
      {t.description && <><h2 className="mt-6 text-lg font-bold tracking-tight">Thể lệ</h2><p className="mt-2 whitespace-pre-line text-sm leading-6 text-muted-foreground">{t.description}</p></>}
    </section>
    <div className="flex flex-col gap-4">
      {next && <m.section initial={reduce ? false : { opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: EASE }}
        className="relative overflow-hidden rounded-2xl border border-brand-mint bg-linear-to-br from-brand-light to-card p-5 shadow-panel">
        <span aria-hidden="true" className="absolute -right-8 -top-8 size-28 rounded-full bg-brand-lime/40 blur-2xl motion-safe:animate-float" />
        <p className="relative text-2xs font-bold uppercase tracking-widest text-primary">{next.status === 'IN_PROGRESS' ? 'Bạn đang thi đấu' : 'Trận tiếp theo của bạn'}</p>
        <p className="relative mt-2 flex items-center gap-2 text-2xl font-extrabold tracking-tight text-brand-forest"><Clock aria-hidden="true" className="size-6" />{formatTime(next.scheduledAt)} · {next.courtLabel ?? 'Chưa xếp sân'}</p>
        <p className="relative mt-1 text-sm">{formatDay(next.scheduledAt)} · {bracket ? roundName(next.roundIndex, bracket.totalRounds) : ''}{opponent && <> · gặp <b>{opponent.name}</b>{opponent.seed ? ` (hạt giống ${opponent.seed})` : ''}</>}</p>
        <Notice tone="info" icon={Radio} className="relative mt-3">Giờ thi đấu có thể đổi — trang tự cập nhật khi giải đang diễn ra.</Notice>
      </m.section>}
      {t.status === 'IN_PROGRESS' && <Notice tone="info" icon={Radio}>Nhánh đấu, lịch và tỉ số tự làm mới mỗi 30 giây.</Notice>}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-panel">
        <h2 className="text-lg font-bold tracking-tight">Quy định</h2>
        <ul className="mt-3 grid list-disc gap-1.5 pl-5 text-sm text-muted-foreground">
          <li>Đã đóng đăng ký thì không rút được.</li>
          <li>Vắng mặt: xử thua (walkover), không hoàn lệ phí.</li>
          <li>Bỏ cuộc giữa trận: ghi nhận các set đã đánh, đối thủ thắng.</li>
          <li>Kết quả dùng để ghi nhận thành tích và phong độ.</li>
        </ul>
      </section>
    </div>
  </div>;
}

function PeopleTab({ tournament: t, participants, loading }: { tournament: TournamentDetail; participants: ReturnType<typeof useParticipants>['data'] & object; loading: boolean }) {
  const reduce = useReducedMotion();
  const seeded = DRAWN.includes(t.status);
  if (loading) return <div className="grid gap-2 sm:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>;
  if (participants.length === 0) return <EmptyState icon={Users} title="Chưa có người đăng ký" description="Hãy là người đầu tiên tham gia giải này." />;
  return <section className="rounded-2xl border border-border bg-card p-5 shadow-panel sm:p-6">
    <h2 className="text-lg font-bold tracking-tight">{participants.length} {unitLabel(t.matchType)}</h2>
    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
      {participants.map((p, i) => <m.li key={p.registrationId} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE, delay: reduce ? 0 : Math.min(i, 12) * 0.03 }}
        className={cn('flex items-center gap-3 rounded-2xl border border-border px-3 py-2.5 transition-colors hover:border-brand-mint', p.registrationId === t.viewer.registrationId && 'border-primary bg-accent')}>
        <SeedBadge seed={seeded ? p.seedNo : null} />
        <div className="flex -space-x-2">{p.players.map(player => <PlayerAvatar key={player.id} player={player} />)}</div>
        <div className="min-w-0">
          <p className="truncate font-semibold">{p.teamName ?? p.players.map(player => player.fullName).join(' / ')}</p>
          <p className="truncate text-xs text-muted-foreground">{p.players.map(player => player.skillLevel?.name ?? '—').join(' · ')}</p>
        </div>
      </m.li>)}
    </ul>
    <p className="mt-4 text-xs text-muted-foreground">{seeded ? 'Số bên trái là hạt giống.' : 'Hạt giống được công bố sau khi bốc thăm.'} Không hiển thị email hay số điện thoại.</p>
  </section>;
}

function ScheduleTab({ tournament: t, items, bracket }: { tournament: TournamentDetail; items?: ScheduleItem[]; bracket?: BracketData }) {
  const reduce = useReducedMotion();
  const byMatch = useMemo(() => new Map((bracket?.rounds.flatMap(r => r.matches) ?? []).map(m => [m.id, m])), [bracket]);
  if (!items || !bracket) return <Skeleton className="h-80 rounded-2xl" />;
  const days = [...new Set(items.map(i => formatDay(i.scheduledAt)))];
  return <div className="flex flex-col gap-5">
    <p className="text-sm text-muted-foreground">{t.schedule.courtCount} sân ảo · mỗi trận ~{t.schedule.matchDurationMinutes} phút · nghỉ tối thiểu {t.schedule.minRestMinutes} phút giữa hai trận của một VĐV.</p>
    {days.map(day => <section key={day}>
      <h2 className="mb-2 text-sm font-bold uppercase tracking-widest text-muted-foreground">{day}</h2>
      <ol className="grid gap-2">
        {items.filter(i => formatDay(i.scheduledAt) === day).map((item, i) => {
          const match = byMatch.get(item.id);
          const mine = t.viewer.registrationId !== null && (item.registration1Id === t.viewer.registrationId || item.registration2Id === t.viewer.registrationId);
          const live = item.status === 'IN_PROGRESS';
          return <m.li key={item.id} initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, ease: EASE, delay: reduce ? 0 : Math.min(i, 12) * 0.03 }}
            className={cn('grid grid-cols-[4.5rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 rounded-2xl border bg-card px-4 py-3 shadow-panel sm:grid-cols-[4.5rem_6rem_minmax(0,1fr)_auto]',
              mine ? 'border-primary ring-2 ring-primary/15' : 'border-border', live && 'border-danger/40')}>
            <time dateTime={item.scheduledAt} className="text-lg font-extrabold tabular-nums text-brand-forest">{formatTime(item.scheduledAt)}</time>
            <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground sm:order-none">{item.courtLabel ?? '—'}</span>
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <p className="truncate font-semibold">{match ? sideName(match.slot1.players, match.slot1.teamName) : 'Chờ đối thủ'} <span className="font-normal text-muted-foreground">vs</span> {match ? sideName(match.slot2.players, match.slot2.teamName) : 'Chờ đối thủ'}</p>
              <p className="text-xs text-muted-foreground">{roundName(item.roundIndex, bracket.totalRounds)}{mine ? ' · trận của bạn' : ''}</p>
            </div>
            <span className={cn('col-span-2 w-fit rounded-full px-2.5 py-1 text-xs font-semibold sm:col-span-1',
              live ? 'bg-danger-bg text-danger' : item.status === 'COMPLETED' ? 'bg-caution-bg text-caution' : item.status === 'CANCELLED' ? 'bg-muted text-muted-foreground' : 'bg-accent text-primary')}>
              {live ? 'Đang đánh' : item.status === 'COMPLETED' ? 'Đã xong' : item.status === 'CANCELLED' ? 'Đã huỷ' : 'Sắp đấu'}
            </span>
          </m.li>;
        })}
      </ol>
    </section>)}
  </div>;
}
