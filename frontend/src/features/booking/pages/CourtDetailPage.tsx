import { useEffect, useState } from 'react';
import { CalendarX } from 'lucide-react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { EmptyState } from '@/components/common/empty-state';
import { PageContainer, PageHeader } from '@/components/common/page-layout';
import { MatchBookingContext } from '../components/MatchBookingContext';
import { CourtDetailHeader } from '../components/CourtDetailHeader';
import { CourtTimeFilters } from '../components/CourtTimeFilters';
import { CourtAvailabilityPanel } from '../components/CourtAvailabilityPanel';
import { CourtSelectionSummary } from '../components/CourtSelectionSummary';
import { useBookingMatchContext } from '../hooks/useBookingMatchContext';
import { useCourtAvailability } from '../hooks/useCourtAvailability';
import { useNow } from '../hooks/useNow';
import { todayIso } from '../utils/booking';

export function CourtDetailPage() {
  const { forMatch } = useBookingMatchContext();
  const { courtId: courtIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courtId = Number(courtIdParam);
  const [date, setDate] = useState(() => searchParams.get('date') || todayIso());
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const { availability, status, error, refresh } = useCourtAvailability(
    Number.isFinite(courtId) ? courtId : null, date, durationMinutes,
  );
  const now = useNow();
  useEffect(() => { setSelectedStart(null); }, [date, durationMinutes]);
  const selectedInterval = availability?.intervals.find(interval => interval.startTime === selectedStart) ?? null;
  if (!Number.isFinite(courtId)) return <PageContainer>
    <PageHeader title="Chi tiết sân" />
    <EmptyState icon={CalendarX} title="Sân không hợp lệ" description="Đường dẫn không hợp lệ." />
  </PageContainer>;

  return <PageContainer className="pb-24">
    <MatchBookingContext />
    <CourtDetailHeader availability={availability} date={date} linkTo={forMatch} />
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <CourtTimeFilters date={date} durationMinutes={durationMinutes} now={now}
          onDateChange={setDate} onDurationChange={setDurationMinutes} dateLink={forMatch(`/courts/${courtId}/date`)} />
        <CourtAvailabilityPanel availability={availability} status={status} error={error} date={date}
          durationMinutes={durationMinutes} selectedStart={selectedStart} onSelect={setSelectedStart} onRetry={() => void refresh()} />
      </div>
      <CourtSelectionSummary interval={selectedInterval} date={date} durationMinutes={durationMinutes}
        onContinue={() => selectedInterval && navigate(forMatch(`/bookings/new?courtId=${courtId}&date=${date}&startTime=${selectedInterval.startTime}&durationMinutes=${durationMinutes}`))} />
    </div>
  </PageContainer>;
}
