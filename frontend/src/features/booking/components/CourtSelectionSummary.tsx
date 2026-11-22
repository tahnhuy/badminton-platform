import { ArrowRight, CalendarDays, Check, Clock3, MousePointer2, TriangleAlert } from 'lucide-react';
import { domAnimation, LazyMotion, m } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useMediaQuery } from '@/shared/hooks/use-media-query';
import { cn } from '@/shared/utils/cn';
import { formatCurrency, formatDisplayDate, formatDuration, formatTime } from '../utils/booking';

interface CourtSelectionSummaryProps {
  startTime: string | null;
  endTime: string | null;
  date: string;
  durationMinutes: number;
  estimatedPrice: number | null;
  available: boolean;
  checking: boolean;
  onContinue: () => void;
}

function SelectionDetails({ startTime, endTime, date, durationMinutes, estimatedPrice, available, checking }: Omit<CourtSelectionSummaryProps, 'onContinue'> & { startTime: string; endTime: string }) {
  const unavailable = !checking && !available;
  return <div role="status" aria-atomic="true" className="flex flex-col gap-5">
    <div className={cn('rounded-2xl border p-4', unavailable ? 'border-caution/30 bg-caution-bg' : 'border-primary/15 bg-accent')}>
      <p className="mb-1 text-xs font-medium text-muted-foreground">Bắt đầu</p>
      <p className="text-3xl font-extrabold tracking-tight tabular-nums text-primary">{formatTime(startTime)}</p>
      <p className="mt-3 border-t border-primary/10 pt-3 text-xs leading-5 text-muted-foreground">
        Kết thúc <span className="font-semibold text-foreground">{formatTime(endTime)}</span>
      </p>
    </div>
    {unavailable && <p role="alert" className="flex items-start gap-2 rounded-lg bg-caution-bg p-3 text-xs leading-5 text-caution">
      <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      Khung giờ này không còn trống cho thời lượng đã chọn. Vui lòng chọn giờ bắt đầu khác.
    </p>}
    <dl className="flex flex-col gap-4 text-sm">
      <div className="flex gap-3"><CalendarDays aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div><dt className="text-xs text-muted-foreground">Ngày chơi</dt><dd className="mt-1 font-semibold capitalize">{formatDisplayDate(date)}</dd></div></div>
      <div className="flex gap-3"><Clock3 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
        <div><dt className="text-xs text-muted-foreground">Thời lượng</dt><dd className="mt-1 font-semibold">{formatDuration(durationMinutes)}</dd></div></div>
    </dl>
    <div className="flex items-end justify-between gap-3 border-t border-dashed border-border pt-5 lg:justify-start">
      <p className="text-sm text-muted-foreground">Tạm tính<span className="mt-1 block text-xs">Cho {formatDuration(durationMinutes)} chơi</span></p>
      <p className="text-2xl font-extrabold tracking-tight tabular-nums">{checking ? '…' : available ? formatCurrency(estimatedPrice) : '—'}</p>
    </div>
  </div>;
}

export function CourtSelectionSummary({ startTime, endTime, date, durationMinutes, estimatedPrice, available, checking, onContinue }: CourtSelectionSummaryProps) {
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  const hasSelection = Boolean(startTime && endTime);
  const canContinue = hasSelection && available && !checking;
  return <aside aria-labelledby="court-selection-title" className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card shadow-panel lg:sticky lg:top-24">
    <div className="h-1 bg-linear-to-r from-primary via-primary/60 to-primary/20" />
    <div className="p-5 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <h2 id="court-selection-title" className="text-lg font-bold tracking-tight">Lựa chọn của bạn</h2>
        {hasSelection && <Badge variant={checking ? 'neutral' : available ? 'success' : 'caution'}>{checking ? 'Đang kiểm tra' : available ? <><Check aria-hidden="true" />Đã chọn</> : <><TriangleAlert aria-hidden="true" />Không khả dụng</>}</Badge>}
      </div>
      {hasSelection && startTime && endTime ? <LazyMotion features={domAnimation} strict>
        <m.div key={`${date}-${durationMinutes}-${startTime}`} initial={reducedMotion ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.2 }}>
          <SelectionDetails startTime={startTime} endTime={endTime} date={date} durationMinutes={durationMinutes}
            estimatedPrice={estimatedPrice} available={available} checking={checking} />
          {canContinue && <Button type="button" variant="brand" size="comfortable" onClick={onContinue} className="mt-6 w-full lg:w-auto">
            Tiếp tục đặt sân<ArrowRight aria-hidden="true" />
          </Button>}
        </m.div>
      </LazyMotion> : <div className="flex flex-col items-center gap-4 py-5 text-center">
        <span aria-hidden="true" className="flex size-16 items-center justify-center rounded-2xl border border-primary/10 bg-accent text-primary"><MousePointer2 className="size-7" /></span>
        <p className="text-sm font-semibold">Chọn giờ bắt đầu cho buổi chơi.</p>
        <p className="max-w-64 text-sm leading-6 text-muted-foreground">Nhập giờ bắt đầu hoặc chọn một khoảng trống để xem giờ kết thúc, thời lượng và chi phí tạm tính tại đây.</p>
      </div>}
    </div>
  </aside>;
}
