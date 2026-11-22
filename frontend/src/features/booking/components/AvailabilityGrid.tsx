import { Check, Clock3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/shared/utils/cn';
import { formatCurrency, formatDuration, formatTime, formatTimeRange } from '../utils/booking';
import type { FreeInterval } from '../types/booking';

interface AvailabilityGridProps {
  intervals: FreeInterval[];
  durationMinutes: number;
  selectedStart: string | null;
  onSelect: (start: string) => void;
}

function segmentLabel(interval: FreeInterval): string {
  const prices = Array.from(new Set(interval.segments.map(segment => segment.price)));
  if (prices.length === 1) return `${formatCurrency(prices[0])}/giờ`;
  return `${prices.length} mức giá`;
}

interface IntervalCardProps extends Pick<AvailabilityGridProps, 'durationMinutes' | 'onSelect'> {
  interval: FreeInterval;
  isSelected: boolean;
}

function IntervalCard({ interval, durationMinutes, isSelected, onSelect }: IntervalCardProps) {
  const fits = interval.durationMinutes >= durationMinutes;
  return <Button type="button" variant="outline" disabled={!fits} aria-pressed={isSelected}
    aria-label={`Khoảng sân trống ${formatTimeRange(interval.startTime, interval.endTime)}`}
    onClick={() => onSelect(formatTime(interval.startTime))}
    className={cn('group h-auto w-full min-w-0 flex-col items-stretch gap-4 whitespace-normal rounded-2xl p-4 text-left font-normal shadow-sm transition-[background-color,border-color,box-shadow,transform] duration-200 motion-safe:hover:-translate-y-0.5 sm:p-5',
      isSelected ? 'border-primary bg-accent shadow-primary ring-1 ring-primary hover:bg-accent' : 'hover:border-primary/50 hover:bg-soft')}>
    <span className="flex items-center justify-between gap-3 text-xs font-semibold text-muted-foreground">
      <span className="flex items-center gap-2"><Clock3 aria-hidden="true" className="text-primary" />Khoảng sân trống</span>
      <span aria-hidden="true" className={cn('flex size-6 shrink-0 items-center justify-center rounded-full border',
        isSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-input bg-card group-hover:border-primary/50')}>
        {isSelected && <Check className="size-4" />}
      </span>
    </span>
    <span className="text-2xl font-extrabold tracking-tight tabular-nums">{formatTimeRange(interval.startTime, interval.endTime)}</span>
    <span className="text-xs text-muted-foreground">{interval.durationMinutes} phút trống · {segmentLabel(interval)}</span>
    <span className="flex flex-wrap items-end justify-between gap-2 border-t border-border pt-3">
      <span className="flex flex-col gap-1 text-xs text-muted-foreground">Bắt đầu {formatTime(interval.startTime)}
        <span className="text-sm font-bold text-primary">{fits ? interval.estimatedPrice !== null
          ? `${formatCurrency(interval.estimatedPrice)} / ${formatDuration(durationMinutes)}` : 'Chọn khung giờ' : 'Không đủ thời lượng'}</span>
      </span>
      <span className={cn('text-xs font-semibold', isSelected ? 'text-primary' : 'text-muted-foreground')}>
        {isSelected ? 'Đã chọn' : fits ? 'Chọn khoảng này' : 'Không thể chọn'}
      </span>
    </span>
  </Button>;
}

export function AvailabilityGrid({ intervals, durationMinutes, selectedStart, onSelect }: AvailabilityGridProps) {
  return <div className="grid gap-3 sm:grid-cols-2">
    {intervals.map(interval => <IntervalCard key={interval.startTime} interval={interval} durationMinutes={durationMinutes}
      isSelected={selectedStart === formatTime(interval.startTime)} onSelect={onSelect} />)}
  </div>;
}
