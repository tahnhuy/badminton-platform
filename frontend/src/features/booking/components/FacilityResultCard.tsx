import { Link } from 'react-router-dom';
import { ArrowRight, Clock, MapPin } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatTimeRange } from '../utils/booking';
import type { FacilitySearchItem } from '../types/booking';

interface FacilityResultCardProps {
  item: FacilitySearchItem;
  date: string;
  /** Applied time window; the badge is shown only when results were filtered by it. */
  window: { from: string; to: string } | null;
  linkTo: (path: string) => string;
}

/** One facility of the search results, with its matching courts as links to their availability. */
export function FacilityResultCard({ item, date, window, linkTo }: FacilityResultCardProps) {
  const { facility, courts, priceFrom } = item;
  const headingId = `facility-${facility.id}`;
  const address = facility.address.includes(facility.city) ? facility.address : `${facility.address}, ${facility.city}`;
  return <article aria-labelledby={headingId} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <h3 id={headingId} className="text-lg font-bold leading-snug tracking-tight">{facility.name}</h3>
        <p className="mt-0.5 text-xs text-muted-foreground">{courts.length} sân phù hợp</p>
      </div>
      {window && <Badge variant="success" className="mt-0.5"><Clock aria-hidden="true" />Trống {window.from}–{window.to}</Badge>}
    </div>
    <dl className="grid gap-1.5 text-sm text-muted-foreground">
      <div className="flex gap-2"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><dt className="sr-only">Địa chỉ</dt><dd>{address}</dd></div>
      <div className="flex gap-2"><Clock aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><dt className="sr-only">Giờ mở cửa</dt><dd>{formatTimeRange(facility.openingTime, facility.closingTime)} hằng ngày</dd></div>
    </dl>
    <div className="flex flex-wrap items-end justify-between gap-3 border-t border-border pt-4">
      <p className="text-sm text-muted-foreground">Giá từ <span className="text-xl font-extrabold tracking-tight text-foreground">{formatCurrency(priceFrom)}</span>/giờ</p>
      <Link to={linkTo(`/facilities/${facility.id}`)} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring">
        Xem cơ sở<span className="sr-only"> {facility.name}</span><ArrowRight aria-hidden="true" className="size-4" />
      </Link>
    </div>
    <div>
      <p id={`${headingId}-courts`} className="mb-2 text-xs font-semibold text-muted-foreground">Chọn sân để xem lịch trống</p>
      <ul aria-labelledby={`${headingId}-courts`} className="flex flex-wrap gap-2">
        {courts.map(court => <li key={court.id}>
          <Link to={linkTo(`/courts/${court.id}?date=${date}`)} className="flex min-h-11 flex-col justify-center rounded-lg border border-border bg-soft px-3.5 py-1.5 text-sm font-semibold leading-tight outline-none transition-colors hover:border-primary hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring">
            {court.name}<span className="text-xs font-normal text-muted-foreground">{formatCurrency(court.priceFrom)}/giờ</span>
            <span className="sr-only">, xem lịch trống tại {facility.name}</span>
          </Link>
        </li>)}
      </ul>
    </div>
  </article>;
}
