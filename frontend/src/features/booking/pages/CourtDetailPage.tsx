import { useMemo, useState } from 'react';
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
import { addMinutesToTime, findCoveringInterval, formatTime, priceForWindow, todayIso } from '../utils/booking';

export function CourtDetailPage() {
  const { forMatch } = useBookingMatchContext();
  const { courtId: courtIdParam } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const courtId = Number(courtIdParam);
  const [date, setDate] = useState(() => searchParams.get('date') || todayIso());
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [startTime, setStartTime] = useState('');
  const { availability, status, error, refresh } = useCourtAvailability(
    Number.isFinite(courtId) ? courtId : null, date, durationMinutes,
  );
  const now = useNow();
  const normalizedStart = startTime ? formatTime(startTime) : '';
  const endTime = normalizedStart ? addMinutesToTime(normalizedStart, durationMinutes) : '';
  const coveringInterval = useMemo(
    () => (availability && normalizedStart ? findCoveringInterval(availability.intervals, normalizedStart, durationMinutes) : null),
    [availability, normalizedStart, durationMinutes],
  );
  const estimatedPrice = useMemo(() => {
    if (!coveringInterval || !normalizedStart) return null;
    // The server estimate is authoritative when the chosen start is the
    // interval start; for a custom start we derive it from the priced segments.
    return normalizedStart === formatTime(coveringInterval.startTime)
      ? coveringInterval.estimatedPrice
      : priceForWindow(coveringInterval, normalizedStart, durationMinutes);
  }, [coveringInterval, normalizedStart, durationMinutes]);
  const minStartTime = availability ? formatTime(availability.openingTime) : undefined;
  const maxStartTime = availability ? addMinutesToTime(formatTime(availability.closingTime), -durationMinutes) : undefined;
  if (!Number.isFinite(courtId)) return <PageContainer>
    <PageHeader title="Chi tiết sân" />
    <EmptyState icon={CalendarX} title="Sân không hợp lệ" description="Đường dẫn không hợp lệ." />
  </PageContainer>;

  const handleContinue = () => {
    if (!normalizedStart || !coveringInterval) return;
    navigate(forMatch(`/bookings/new?courtId=${courtId}&date=${date}&startTime=${normalizedStart}&durationMinutes=${durationMinutes}`));
  };

  return <PageContainer className="pb-24">
    <MatchBookingContext />
    <CourtDetailHeader availability={availability} date={date} linkTo={forMatch} />
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <CourtTimeFilters date={date} durationMinutes={durationMinutes} startTime={normalizedStart} endTime={endTime}
          minStartTime={minStartTime} maxStartTime={maxStartTime} now={now}
          onDateChange={setDate} onDurationChange={setDurationMinutes} onStartTimeChange={setStartTime}
          dateLink={forMatch(`/courts/${courtId}/date`)} />
        <CourtAvailabilityPanel availability={availability} status={status} error={error} date={date}
          durationMinutes={durationMinutes} selectedStart={normalizedStart || null}
          onSelect={value => setStartTime(formatTime(value))} onRetry={() => void refresh()} />
      </div>
      <CourtSelectionSummary date={date} durationMinutes={durationMinutes} startTime={normalizedStart || null}
        endTime={endTime || null} estimatedPrice={estimatedPrice} available={Boolean(coveringInterval)}
        checking={status === 'loading'} onContinue={handleContinue} />
    </div>
  </PageContainer>;
}
