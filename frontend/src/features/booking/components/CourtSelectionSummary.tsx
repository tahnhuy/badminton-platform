import { ArrowRight, CalendarDays, Check, Clock3, MousePointer2 } from 'lucide-react';
import { domAnimation, LazyMotion, m } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import type { FreeInterval } from '../types/booking';
import { formatCurrency, formatDisplayDate, formatDuration, formatTime, formatTimeRange } from '../utils/booking';

interface CourtSelectionSummaryProps {
  interval: FreeInterval | null;
  date: string;
  durationMinutes: number;
  onContinue: () => void;
}

function SelectionDetails({ interval, date, durationMinutes }: Omit<CourtSelectionSummaryProps, 'onContinue'> & { interval: FreeInterval }) {
  return <div role="status" aria-atomic="true" className="flex flex-col gap-5">
    <div className="rounded-2xl border border-primary/15 bg-accent p-4">
      <p className="mb-1 text-xs font-medium text-muted-foreground">Bắt đầu</p>
      <p className="text-3xl font-extrabold tracking-tight tabular-nums text-primary">{formatTime(interval.startTime)}</p>
      <p className="mt-3 border-t border-primary/10 pt-3 text-xs leading-5 text-muted-foreground">
        Khoảng sân trống <span className="font-semibold text-foreground">{formatTimeRange(interval.startTime, interval.endTime)}</span>
      </p>
    </div>
    <dl className="flex flex-col gap-4 text-sm">
      <div className="flex gap-3"><CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div><dt className="text-xs text-muted-foreground">Ngày chơi</dt><dd className="mt-1 font-semibold capitalize">{formatDisplayDate(date)}</dd></div></div>
      <div className="flex gap-3"><Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div><dt className="text-xs text-muted-foreground">Thời lượng</dt><dd className="mt-1 font-semibold">{formatDuration(durationMinutes)}</dd></div></div>
    </dl>
    <div className="flex items-end justify-between gap-3 border-t border-dashed border-border pt-5 lg:justify-start">
      <p className="text-sm text-muted-foreground">Tạm tính<span className="mt-1 block text-xs">Cho {formatDuration(durationMinutes)} chơi</span></p>
      <p className="text-2xl font-extrabold tracking-tight tabular-nums">{formatCurrency(interval.estimatedPrice)}</p>
    </div>
  </div>;
}

export function CourtSelectionSummary({ interval, date, durationMinutes, onContinue }: CourtSelectionSummaryProps) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  return <aside aria-labelledby="court-selection-title" className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-panel lg:sticky lg:top-24">
    <div className="h-1 bg-linear-to-r from-primary via-primary/60 to-primary/20" />
    <div className="p-5 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h2 id="court-selection-title" className="text-lg font-bold tracking-tight">Lựa chọn của bạn</h2>
        {interval && <Badge variant="success"><Check aria-hidden="true" />Đã chọn</Badge>}
      </div>
      {interval ? <LazyMotion features={domAnimation} strict>
        <m.div key={`${date}-${durationMinutes}-${interval.startTime}`} initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}>
          <SelectionDetails interval={interval} date={date} durationMinutes={durationMinutes} />
          <Button type="button" variant="brand" size="comfortable" onClick={onContinue} className="mt-6 w-full lg:w-auto">
            Tiếp tục đặt sân<ArrowRight aria-hidden="true" />
          </Button>
        </m.div>
      </LazyMotion> : <div className="flex flex-col items-center gap-4 py-5 text-center">
        <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-2xl border border-primary/10 bg-accent text-primary"><MousePointer2 className="size-7" /></span>
        <p className="text-sm font-semibold">Một khoảng trống, một buổi chơi.</p>
        <p className="max-w-64 text-sm leading-6 text-muted-foreground">Chọn khoảng sân trống để xem giờ bắt đầu, thời lượng và chi phí tạm tính tại đây.</p>
      </div>}
    </div>
  </aside>;
}
