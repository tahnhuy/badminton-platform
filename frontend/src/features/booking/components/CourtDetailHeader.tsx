import { ArrowLeft, Clock3, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';
import { PageHeader } from '@/components/common/page-layout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { CourtAvailability } from '../types/booking';
import { formatTimeRange } from '../utils/booking';

/** Decorative court lines, built from vectors; no new image or facility data. */
function CourtLines() {
  return <svg aria-hidden="true" focusable="false" viewBox="0 0 320 200"
    className="pointer-events-none absolute -right-12 -top-4 hidden h-60 w-96 rotate-12 text-primary-foreground/20 sm:block">
    <rect x="30" y="20" width="260" height="160" rx="4" fill="currentColor" fillOpacity="0.2" />
    <g fill="none" stroke="currentColor" strokeWidth="1.5">
      <rect x="30" y="20" width="260" height="160" rx="4" />
      <path d="M46 20v160M274 20v160M30 42h260M30 158h260M30 76h260M30 124h260M160 20v56m0 48v56" />
      <path d="M14 100h292" strokeDasharray="4 4" strokeWidth="2" />
      <circle cx="106" cy="58" r="10" /><circle cx="215" cy="142" r="10" />
    </g>
  </svg>;
}

interface CourtDetailHeaderProps {
  availability: CourtAvailability | null;
  date: string;
  linkTo: (path: string) => string;
}

export function CourtDetailHeader({ availability, date, linkTo }: CourtDetailHeaderProps) {
  return <section className="relative isolate overflow-hidden rounded-panel border border-primary bg-primary bg-linear-to-br from-primary to-brand-hover p-6 text-primary-foreground shadow-panel sm:p-8">
    <CourtLines />
    <div className="relative flex flex-col gap-5">
      <Badge className="w-fit border border-primary-foreground/20 bg-primary-foreground/10 text-primary-foreground">LỊCH SÂN</Badge>
      <PageHeader title={availability?.court.name ?? 'Chi tiết sân'}
        actions={<Button asChild variant="outline" className="h-11 bg-card/95 text-foreground">
          <Link to={linkTo('/courts')}><ArrowLeft aria-hidden="true" />Quay lại danh sách sân</Link>
        </Button>} />
      {availability && <div className="flex max-w-2xl flex-col gap-3 text-sm">
        <Link to={linkTo(`/facilities/${availability.facility.id}?date=${date}`)}
          className="inline-flex min-h-11 w-fit items-center rounded-md font-semibold text-primary-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground">
          {availability.facility.name}
        </Link>
        <p className="flex items-start gap-2 text-primary-foreground/85"><MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {availability.facility.address}, {availability.facility.district}, {availability.facility.city}
        </p>
        <p className="flex w-fit items-center gap-2 rounded-lg border border-primary-foreground/20 bg-primary-foreground/10 px-3 py-2 text-xs font-medium text-primary-foreground">
          <Clock3 aria-hidden="true" className="size-4" />Giờ mở cửa: {formatTimeRange(availability.openingTime, availability.closingTime)}
        </p>
      </div>}
    </div>
  </section>;
}
