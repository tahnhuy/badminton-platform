import { CalendarDays, ChevronDown, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { formatDuration } from '../utils/booking';

const DURATION_OPTIONS = [60, 90, 120, 150, 180];

interface CourtTimeFiltersProps {
  date: string;
  durationMinutes: number;
  now: Date;
  dateLink: string;
  onDateChange: (date: string) => void;
  onDurationChange: (minutes: number) => void;
}

export function CourtTimeFilters({ date, durationMinutes, now, dateLink, onDateChange, onDurationChange }: CourtTimeFiltersProps) {
  return <section aria-labelledby="court-time-title" className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
    <div className="mb-5 flex items-center gap-3">
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><CalendarDays className="size-5" /></span>
      <div><h2 id="court-time-title" className="text-lg font-bold tracking-tight">Lên lịch ra sân</h2>
        <p className="mt-1 text-xs text-muted-foreground">Chọn ngày và thời lượng bạn muốn chơi.</p></div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="court-date">Ngày chơi</Label>
        <Input id="court-date" type="date" value={date} onChange={event => onDateChange(event.target.value)} />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="court-duration">Thời lượng</Label>
        <div className="relative">
          <select id="court-duration" value={durationMinutes} onChange={event => onDurationChange(Number(event.target.value))}
            className="h-13 w-full appearance-none rounded-lg border border-input bg-soft pl-3 pr-10 text-base text-foreground transition-colors hover:border-ring/40 focus-visible:border-ring focus-visible:bg-card focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/10">
            {DURATION_OPTIONS.map(option => <option key={option} value={option}>{formatDuration(option)}</option>)}
          </select>
          <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-3 top-4 size-5 text-muted-foreground" />
        </div>
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-3">
      <Button asChild variant="ghost" className="h-11 px-2 text-primary"><Link to={dateLink}>Chọn ngày khác</Link></Button>
      <p className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="size-4" />
        Giờ hiện tại <time className="font-medium tabular-nums">{now.toLocaleTimeString('vi-VN')}</time>
      </p>
    </div>
  </section>;
}
