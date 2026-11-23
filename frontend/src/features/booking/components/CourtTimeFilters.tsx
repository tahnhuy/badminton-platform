import { CalendarDays, Clock3 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { formatDuration } from '../utils/booking';

const DURATION_OPTIONS = [60, 90, 120, 150, 180];

interface CourtTimeFiltersProps {
  date: string;
  durationMinutes: number;
  startTime: string;
  endTime: string;
  minStartTime?: string;
  maxStartTime?: string;
  now: Date;
  dateLink: string;
  onDateChange: (date: string) => void;
  onDurationChange: (minutes: number) => void;
  onStartTimeChange: (time: string) => void;
}

export function CourtTimeFilters({ date, durationMinutes, startTime, endTime, minStartTime, maxStartTime, now, dateLink, onDateChange, onDurationChange, onStartTimeChange }: CourtTimeFiltersProps) {
  return <section aria-labelledby="court-time-title" className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
    <div className="mb-5 flex items-center gap-3">
      <span aria-hidden="true" className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-accent text-primary"><CalendarDays className="size-5" /></span>
      <div><h2 id="court-time-title" className="text-lg font-bold tracking-tight">Lên lịch ra sân</h2>
        <p className="mt-1 text-xs text-muted-foreground">Chọn ngày, giờ bắt đầu và thời lượng bạn muốn chơi.</p></div>
    </div>
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="court-date">Ngày chơi</Label>
        <Input id="court-date" type="date" value={date} onChange={event => onDateChange(event.target.value)} />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="court-duration">Thời lượng</Label>
        <Select id="court-duration" className="h-13 bg-soft text-base" value={String(durationMinutes)} onChange={value => onDurationChange(Number(value))} options={DURATION_OPTIONS.map(option => ({ value: String(option), label: formatDuration(option) }))} />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="court-start">Giờ bắt đầu</Label>
        <Input id="court-start" type="time" step={300} value={startTime} min={minStartTime} max={maxStartTime}
          aria-describedby="court-end-hint" onChange={event => onStartTimeChange(event.target.value)} />
      </div>
      <div className="flex min-w-0 flex-col gap-2">
        <Label htmlFor="court-end">Giờ kết thúc</Label>
        <Input id="court-end" type="time" value={endTime} readOnly tabIndex={-1} aria-describedby="court-end-hint"
          className="bg-muted text-muted-foreground" />
      </div>
    </div>
    <div className="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-border pt-3">
      <Button asChild variant="ghost" className="h-11 px-2 text-primary"><Link to={dateLink}>Chọn ngày khác</Link></Button>
      <p id="court-end-hint" className="flex items-center gap-2 text-xs text-muted-foreground"><Clock3 aria-hidden="true" className="size-4" />
        {startTime ? <>Kết thúc tự tính theo thời lượng · </> : <>Chọn giờ bắt đầu để tính giờ kết thúc · </>}
        Bây giờ <time className="font-medium tabular-nums">{now.toLocaleTimeString('vi-VN')}</time>
      </p>
    </div>
  </section>;
}
