import { useBookingMatchContext } from '../hooks/useBookingMatchContext';
import { MatchBookingContext } from '../components/MatchBookingContext';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/use-auth';
import { bookingService } from '../services/bookingService';
import { useCourtAvailability } from '../hooks/useCourtAvailability';
import { BookingPageState as StateBlock } from '../components/BookingPageState';
import { ApiError } from '../../../shared/api/http-client';
import { ArrowLeft, CalendarDays, ReceiptText, ShieldCheck, UserRound, Wallet } from 'lucide-react';
import { PageContainer, PageHeader } from '@/components/common/page-layout';
import { ContentPanel, DetailRow } from '@/components/common/content-panel';
import { Button } from '@/components/ui/button';
import {
  formatCurrency,
  formatDisplayDate,
  formatDuration,
  formatTimeRange,
  round2,
  timeToMinutes,
} from '../utils/booking';
import type { FreeInterval } from '../types/booking';

interface PricedLine {
  startTime: string;
  endTime: string;
  amount: number;
}

function minutesToLabel(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

function priceOverWindow(interval: FreeInterval, startMinutes: number, durationMinutes: number): PricedLine[] {
  const endMinutes = startMinutes + durationMinutes;
  const lines: PricedLine[] = [];
  for (const segment of interval.segments) {
    const segmentStart = timeToMinutes(segment.startTime);
    const segmentEnd = timeToMinutes(segment.endTime);
    const overlapStart = Math.max(segmentStart, startMinutes);
    const overlapEnd = Math.min(segmentEnd, endMinutes);
    if (overlapEnd <= overlapStart) continue;
    lines.push({
      startTime: minutesToLabel(overlapStart),
      endTime: minutesToLabel(overlapEnd),
      amount: round2(segment.price * ((overlapEnd - overlapStart) / 60)),
    });
  }
  return lines;
}

export function BookingSummaryPage() {
  const { forMatch } = useBookingMatchContext();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const courtId = Number(searchParams.get('courtId'));
  const date = searchParams.get('date') ?? '';
  const startTime = searchParams.get('startTime') ?? '';
  const durationMinutes = Number(searchParams.get('durationMinutes') ?? 60);

  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const isValid = Number.isFinite(courtId) && Boolean(date && startTime) && durationMinutes > 0;
  const { availability, status, error, isStale } = useCourtAvailability(
    isValid ? courtId : null,
    date,
    durationMinutes
  );

  // Match by coverage, not by an exact start string: the server may round the
  // offered start to a step boundary, so identity matching would false-negative.
  const coveringInterval = useMemo(() => {
    if (!availability || !startTime) return null;
    const startMinutes = timeToMinutes(startTime);
    const endMinutes = startMinutes + durationMinutes;
    return (
      availability.intervals.find((interval) => {
        const intervalStart = timeToMinutes(interval.startTime);
        const intervalEnd = timeToMinutes(interval.endTime);
        return intervalStart <= startMinutes && intervalEnd >= endMinutes;
      }) ?? null
    );
  }, [availability, startTime, durationMinutes]);

  const lines = useMemo(() => {
    if (!coveringInterval || !startTime) return [];
    return priceOverWindow(coveringInterval, timeToMinutes(startTime), durationMinutes);
  }, [coveringInterval, startTime, durationMinutes]);

  const total = round2(lines.reduce((sum, line) => sum + line.amount, 0));

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const booking = await bookingService.createBooking({
        courtId,
        bookingDate: date,
        startTime,
        durationMinutes,
      });
      navigate(forMatch(`/bookings/${booking.id}/pending`));
    } catch (err) {
      setSubmitError(
        err instanceof ApiError
          ? err.code === 'BOOKING_SLOT_UNAVAILABLE'
            ? 'Khung giờ vừa được người khác đặt. Vui lòng chọn khung giờ khác.'
            : err.message
          : 'Không thể tạo đơn đặt sân. Vui lòng thử lại.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!isValid) {
    return <StateBlock title="Thiếu thông tin đặt sân" description="Vui lòng chọn sân và khung giờ trước." />;
  }
  if (status === 'loading') {
    return <StateBlock title="Đang tải..." description="Đang kiểm tra khung giờ và giá." />;
  }
  if (status === 'error' && !availability) {
    return (
      <StateBlock
        title="Không tải được thông tin"
        description={error ?? 'Vui lòng thử lại.'}
        actionLabel="Tải lại"
        onAction={() => navigate(forMatch(`/courts/${courtId}?date=${date}`))}
      />
    );
  }
  if (!coveringInterval) {
    return (
      <StateBlock
        title="Khung giờ không còn khả dụng"
        description="Khung giờ đã được đặt hoặc không còn trống. Vui lòng chọn khung giờ khác."
        actionLabel="Chọn khung giờ khác"
        onAction={() => navigate(forMatch(`/courts/${courtId}?date=${date}`))}
      />
    );
  }

  return (
    <PageContainer>
      <MatchBookingContext />
      <PageHeader title="Xác nhận thông tin & Thanh toán" description="Kiểm tra lại lịch đặt trước khi tiến hành thanh toán giữ chỗ."
        actions={<Button asChild variant="outline"><Link to={forMatch(`/courts/${courtId}?date=${date}`)}><ArrowLeft aria-hidden="true" />Chỉnh sửa khung giờ</Link></Button>} />
      {isStale && <p role="status" className="rounded-lg border border-caution/20 bg-caution-bg p-4 text-sm text-caution">Đang tạm mất kết nối cập nhật thời gian thực — thông tin hiển thị có thể chưa phải mới nhất.</p>}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex min-w-0 flex-col gap-5">
          <ContentPanel title="Thông tin người đặt" icon={UserRound}>
            <p className="break-all text-sm font-semibold">{user?.email ?? 'Tài khoản người chơi'}</p>
            <p className="text-xs text-muted-foreground">Đồng bộ tự động từ hồ sơ SmashPro.</p>
          </ContentPanel>
          <ContentPanel title="Chi tiết lịch thi đấu" icon={CalendarDays}>
            <p className="text-lg font-bold">{availability?.court.name}</p>
            <p className="text-sm leading-6 text-muted-foreground">{availability?.facility.name} · {availability?.facility.address}, {availability?.facility.district}</p>
            <p className="rounded-lg border border-primary/10 bg-accent p-4 text-sm font-semibold leading-6">{formatDisplayDate(date)}<br />{formatTimeRange(startTime, minutesToLabel(timeToMinutes(startTime) + durationMinutes))} ({formatDuration(durationMinutes)})</p>
          </ContentPanel>
          <ContentPanel title="Phương thức thanh toán" icon={Wallet}>
            <p className="text-sm font-semibold">Thanh toán bằng ví SmashPro</p>
            <p className="text-sm leading-6 text-muted-foreground">Tiền sân sẽ được trừ từ số dư ví khi bạn xác nhận thanh toán ở bước tiếp theo. Vui lòng đảm bảo ví có đủ {formatCurrency(total)}.</p>
            <Link to="/wallet" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center self-start rounded-md text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">Nạp tiền vào ví (mở tab mới)</Link>
          </ContentPanel>
          <label className="flex min-h-13 cursor-pointer items-start gap-3 rounded-2xl border border-border bg-card p-5 text-sm leading-6 text-muted-foreground shadow-sm">
            <input type="checkbox" checked={agreed} onChange={event => setAgreed(event.target.checked)} className="mt-1 size-5 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring" />
            Tôi đã đọc và đồng ý với Quy định đặt sân & Chính sách hoàn tiền của SmashPro.
          </label>
        </div>
        <ContentPanel title="Chi tiết thanh toán" icon={ReceiptText} className="border-t-4 border-t-primary shadow-panel lg:sticky lg:top-24">
          {lines.map(line => <DetailRow key={`${line.startTime}-${line.endTime}`} label={formatTimeRange(line.startTime, line.endTime)} value={formatCurrency(line.amount)} />)}
          <div className="rounded-lg bg-accent p-4"><p className="text-xs font-semibold text-muted-foreground">TỔNG CỘNG</p><p className="mt-2 text-3xl font-extrabold tracking-tight text-primary">{formatCurrency(total)}</p></div>
          {submitError && <p role="alert" className="rounded-lg bg-danger-bg p-3 text-sm text-danger">{submitError}</p>}
          <Button type="button" variant="brand" disabled={!agreed || submitting} onClick={handleSubmit} className="h-auto min-h-13 whitespace-normal py-3">
            {submitting ? 'Đang tạo đơn...' : `Tiến hành thanh toán (${formatCurrency(total)})`}
          </Button>
          <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground"><ShieldCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-primary" />Khung giờ được giữ tối đa 10 phút để bạn thanh toán.</p>
        </ContentPanel>
      </div>
    </PageContainer>
  );
}
