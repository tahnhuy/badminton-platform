import { CalendarDays, CalendarX, CircleAlert } from 'lucide-react';
import { EmptyState } from '@/components/common/empty-state';
import { Skeleton } from '@/components/ui/skeleton';
import type { AvailabilityStatus } from '../hooks/useCourtAvailability';
import type { CourtAvailability } from '../types/booking';
import { formatDisplayDate } from '../utils/booking';
import { AvailabilityGrid } from './AvailabilityGrid';

interface CourtAvailabilityPanelProps {
  availability: CourtAvailability | null;
  status: AvailabilityStatus;
  error: string | null;
  date: string;
  durationMinutes: number;
  selectedStart: string | null;
  onSelect: (start: string) => void;
  onRetry: () => void;
}

function AvailabilitySkeleton() {
  return <div role="status" className="grid gap-3 sm:grid-cols-2">
    <span className="sr-only">Đang tải lịch trống</span>
    {Array.from({ length: 4 }, (_, index) => <div key={index} className="flex flex-col gap-4 rounded-2xl border border-border p-5">
      <Skeleton className="h-4 w-28" /><Skeleton className="h-8 w-40" />
      <Skeleton className="h-3 w-full" /><Skeleton className="mt-2 h-9 w-32" />
    </div>)}
  </div>;
}

export function CourtAvailabilityPanel({ availability, status, error, date, durationMinutes, selectedStart, onSelect, onRetry }: CourtAvailabilityPanelProps) {
  return <section aria-labelledby="court-availability-title" aria-busy={status === 'loading'} className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
    <div className="mb-5 flex flex-col gap-3">
      <div className="flex items-center gap-2"><CalendarDays aria-hidden="true" className="size-5 text-primary" />
        <h2 id="court-availability-title" className="text-lg font-bold tracking-tight">Khoảng sân trống</h2></div>
      <p className="text-sm font-medium capitalize text-muted-foreground">{formatDisplayDate(date)}</p>
      <p className="text-xs leading-5 text-muted-foreground">Chọn một khoảng trống. Giờ bắt đầu và thời lượng sẽ được hiển thị trong lựa chọn của bạn.</p>
    </div>
    {status === 'loading' && <AvailabilitySkeleton />}
    {status === 'error' && error && <EmptyState icon={CircleAlert} role="alert" title="Không tải được lịch trống" description={error} action={{ label: 'Thử lại', onClick: onRetry }} />}
    {status === 'success' && availability && availability.intervals.length === 0 && <EmptyState icon={CalendarX}
      title="Hết khung giờ trống" description="Ngày này đã kín lịch hoặc chưa có bảng giá. Vui lòng chọn ngày khác." />}
    {status === 'success' && availability && availability.intervals.length > 0 && <AvailabilityGrid
      intervals={availability.intervals} durationMinutes={durationMinutes} selectedStart={selectedStart} onSelect={onSelect} />}
  </section>;
}
