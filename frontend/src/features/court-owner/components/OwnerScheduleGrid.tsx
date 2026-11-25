import { CalendarDays } from 'lucide-react';
import { ContentPanel } from '@/components/common/content-panel';
import { cn } from '@/shared/utils/cn';
import { labels } from '../types/labels';
import type { Schedule } from '../types/owner';

const minutes = (time: string) => { const [h, m] = time.split(':').map(Number); return h * 60 + m; };
const clock = (time: number) => `${String(Math.floor(time / 60)).padStart(2, '0')}:${String(time % 60).padStart(2, '0')}`;
const tones: Record<string, string> = { FREE: 'bg-emerald-500 text-emerald-950', BOOKED: 'bg-blue-600 text-white', BLOCKED: 'bg-orange-400 text-orange-950', UNAVAILABLE: 'bg-slate-300 text-slate-800' };

/** Include hourly ticks and every server boundary so partial-hour bookings remain exact. */
export function OwnerScheduleGrid({ schedule, detail }: { schedule: Schedule; detail: (id: number) => void }) {
  const boundaries = [...new Set([...Array.from({ length: 25 }, (_, hour) => hour * 60), ...schedule.courts.flatMap(court => court.slots.flatMap(slot => [minutes(slot.startTime), minutes(slot.endTime)]))])].filter(time => time >= 0 && time <= 1440).sort((a, b) => a - b);
  return <ContentPanel title="Lịch sân & Giám sát" icon={CalendarDays}>
    <p className="text-sm text-muted-foreground">Toàn bộ 24 giờ trong ngày, từ 00:00 đến 24:00. Cuộn ngang để xem các giờ, cuộn dọc để xem các sân. Chọn lịch đã đặt để xem chi tiết.</p>
    <div role="region" aria-label="Lịch sân 24 giờ" tabIndex={0} className="max-h-[min(60svh,36rem)] max-w-full overflow-auto overscroll-contain rounded-xl border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <table className="w-full border-separate border-spacing-0 text-left text-sm">
        <caption className="sr-only">Lịch sân ngày {schedule.date}, đủ giờ 00:00 – 24:00</caption>
        <thead className="sticky top-0 z-20"><tr><th className="sticky left-0 z-30 min-w-40 border-b border-r border-border bg-card p-3">Sân / Giờ</th>{boundaries.slice(0, -1).map((start, index) => <th key={start} className="min-w-28 whitespace-nowrap border-b border-r border-border bg-card p-3 font-semibold">{clock(start)}–{clock(boundaries[index + 1])}</th>)}</tr></thead>
        <tbody>{schedule.courts.map(court => <tr key={court.courtId}><th scope="row" className="sticky left-0 z-10 min-w-40 border-b border-r border-border bg-card p-3"><span className="block max-w-48 break-words">{court.courtName}</span><span className="text-xs font-normal text-muted-foreground">{labels[court.status] ?? court.status}</span></th>{boundaries.slice(0, -1).map((start, index) => {
          const end = boundaries[index + 1];
          const slot = court.slots.find(value => minutes(value.startTime) <= start && minutes(value.endTime) >= end);
          const state = slot?.state ?? 'UNAVAILABLE';
          const label = `${court.courtName}, ${clock(start)}–${clock(end)}, ${labels[state]}`;
          return <td key={start} className="border-b border-r border-border p-1">{slot?.bookingId ? <button type="button" onClick={() => detail(slot.bookingId!)} aria-label={`${label}, xem chi tiết lịch đặt`} className={cn('block h-11 w-full rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring', tones[state])} /> : <div role="img" aria-label={label} className={cn('h-11 rounded-md', tones[state])} />}</td>;
        })}</tr>)}</tbody>
      </table>
      {!schedule.courts.length && <p className="p-6 text-sm text-muted-foreground">Chưa có sân để hiển thị.</p>}
    </div>
    <div className="flex flex-wrap gap-3" aria-label="Chú thích lịch sân">{Object.keys(tones).map(state => <span key={state} className={cn('rounded-lg px-3 py-2 text-xs font-semibold', tones[state])}>{labels[state]}</span>)}</div>
  </ContentPanel>;
}
