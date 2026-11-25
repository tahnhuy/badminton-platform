import { useQuery } from '@tanstack/react-query';
import { ArrowDownRight, ArrowUpRight, Gauge, Lock, TrendingUp } from 'lucide-react';
import { m, LazyMotion, domAnimation, useReducedMotion } from 'motion/react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/shared/utils/cn';
import { formatDate } from '../format';
import { tournamentApi } from '../tournament-api';

/**
 * Own skill rating (PRD Decision #28: visible to its owner only; TRN-14): rating, progress to
 * the next level, recent rated matches and level history.
 */
export function SkillRatingCard() {
  const reduce = useReducedMotion();
  const query = useQuery({ queryKey: ['skill-rating', 'me'], queryFn: tournamentApi.ownSkillRating });
  if (query.isPending) return <Skeleton className="h-64 rounded-2xl" />;
  if (query.isError || !query.data) return null;
  const r = query.data;
  // Progress inside the band, from the demotion threshold to the promotion threshold.
  const low = r.previous ? r.previous.threshold : r.band.min;
  const high = r.next ? r.next.threshold : 100;
  const progress = Math.min(1, Math.max(0, (r.rating - low) / (high - low)));
  return <LazyMotion features={domAnimation} strict>
    <section aria-label="Điểm phong độ" className="relative flex min-w-0 flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-5 sm:p-6">
      <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 size-40 rounded-full bg-brand-lime/25 blur-2xl motion-safe:animate-drift" />
      <div className="relative flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight"><Gauge aria-hidden="true" className="size-5 text-primary" />Điểm phong độ</h2>
          <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground"><Lock aria-hidden="true" className="size-3" />Chỉ bạn nhìn thấy điểm này</p>
        </div>
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-bold', r.tentative ? 'bg-caution-bg text-caution' : 'bg-success-bg text-success')}>
          {r.tentative ? `Tạm thời · ${r.ratedMatchCount}/6 trận` : 'Đã xác nhận'}</span>
      </div>
      <div className="relative flex items-end gap-3">
        <m.span key={r.rating} initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="text-5xl font-extrabold tabular-nums tracking-tight text-brand-forest">{r.rating.toFixed(1)}</m.span>
        <span className="mb-1.5 text-sm text-muted-foreground">/ 100 · trình <b className="text-foreground">{r.level.name}</b></span>
      </div>
      <div className="relative">
        <div className="h-3 overflow-hidden rounded-full bg-muted">
          <m.div className="h-full origin-left rounded-full bg-linear-to-r from-brand-fern to-brand-lime" initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: progress }} transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }} />
        </div>
        <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
          <span>{r.previous ? `Xuống ${r.previous.name} nếu < ${r.previous.threshold}` : 'Bậc thấp nhất'}</span>
          <span>{r.next ? `Lên ${r.next.name} khi ≥ ${r.next.threshold}` : 'Bậc cao nhất'}</span>
        </div>
      </div>
      {r.next && <p className="relative rounded-lg bg-brand-light px-3 py-2 text-sm text-brand-forest"><TrendingUp aria-hidden="true" className="mr-1.5 inline size-4" />
        {r.next.remaining > 0 ? <>Còn <b>{r.next.remaining.toFixed(1)}</b> điểm để lên <b>{r.next.name}</b>. Trình độ được xét lại khi giải đấu kết thúc.</> : <>Đã đủ điểm lên <b>{r.next.name}</b> — sẽ cập nhật ở lần xét trình kế tiếp.</>}</p>}
      {r.events.length > 0 && <div className="relative">
        <h3 className="text-sm font-bold">Trận gần đây</h3>
        <ul className="mt-2 grid gap-1">
          {r.events.slice(0, 6).map(e => {
            const delta = e.after - e.before;
            return <li key={e.tournamentMatchId} className="flex items-center gap-2 text-sm">
              {delta >= 0 ? <ArrowUpRight aria-hidden="true" className="size-4 text-success" /> : <ArrowDownRight aria-hidden="true" className="size-4 text-danger" />}
              <span className="min-w-0 flex-1 truncate">{e.outcome ? 'Thắng' : 'Thua'} đối thủ {e.opponent.toFixed(0)} điểm · {e.tournament.name}</span>
              <span className={cn('tabular-nums font-semibold', delta >= 0 ? 'text-success' : 'text-danger')}>{delta >= 0 ? '+' : ''}{delta.toFixed(2)}</span>
            </li>;
          })}
        </ul>
      </div>}
      {r.changes.length > 0 && <div className="relative">
        <h3 className="text-sm font-bold">Lịch sử đổi trình</h3>
        <ul className="mt-2 grid gap-1 text-sm text-muted-foreground">
          {r.changes.map((c, i) => <li key={i}>{formatDate(c.at)}: {c.from} → <b className="text-foreground">{c.to}</b>{c.tournament ? ` · ${c.tournament.name}` : ''}{c.reason === 'RECALCULATION' ? ' (tính lại)' : ''}</li>)}
        </ul>
      </div>}
      {r.events.length === 0 && <p className="relative text-sm text-muted-foreground">Điểm khởi đầu từ bài khảo sát trình độ. Thi đấu giải chuyên nghiệp để điểm phản ánh phong độ thật — thắng đối thủ mạnh hơn được nhiều điểm hơn.</p>}
    </section>
  </LazyMotion>;
}
