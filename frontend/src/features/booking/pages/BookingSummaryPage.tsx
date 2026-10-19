import { useBookingMatchContext } from '../hooks/useBookingMatchContext';
import { MatchBookingContext } from '../components/MatchBookingContext';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../auth/use-auth';
import { bookingService } from '../services/bookingService';
import { useCourtAvailability } from '../hooks/useCourtAvailability';
import { StateBlock } from '../components/StateBlocks';
import { ApiError } from '../../../shared/api/http-client';
import { ArrowLeftIcon, CheckShieldIcon } from '../../../components/common/Icons';
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
    <div className="booking-page" style={{ width: '100%', maxWidth: 1100, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <MatchBookingContext />
      <Link to={forMatch(`/courts/${courtId}?date=${date}`)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--color-brand)' }}>
        <ArrowLeftIcon size={16} color="var(--color-brand)" />
        Chỉnh sửa khung giờ
      </Link>

      <header>
        <h1 className="booking-page-title" style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
          Xác nhận thông tin & Thanh toán
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>Kiểm tra lại lịch đặt trước khi tiến hành thanh toán giữ chỗ.</p>
      </header>

      {isStale && (
        <span style={{ fontSize: 12, color: 'var(--color-warning)' }}>
          Đang tạm mất kết nối cập nhật thời gian thực — thông tin hiển thị có thể chưa phải mới nhất.
        </span>
      )}

      <div className="booking-summary-layout">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section style={cardStyle}>
            <h2 style={cardTitleStyle}>Thông tin người đặt</h2>
            <span style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{user?.email ?? 'Tài khoản người chơi'}</span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Đồng bộ tự động từ hồ sơ SmashPro.</span>
          </section>

          <section style={cardStyle}>
            <h2 style={cardTitleStyle}>Chi tiết lịch thi đấu</h2>
            <p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600 }}>{availability?.court.name}</p>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              {availability?.facility.name} · {availability?.facility.address}, {availability?.facility.district}
            </p>
            <p style={{ fontSize: 13, color: 'var(--text-primary)', marginTop: 8 }}>
              {formatDisplayDate(date)} · {formatTimeRange(startTime, minutesToLabel(timeToMinutes(startTime) + durationMinutes))} ({formatDuration(durationMinutes)})
            </p>
          </section>

          <section style={cardStyle}>
            <h2 style={cardTitleStyle}>Phương thức thanh toán</h2>
            <p style={{ fontSize: 13, color: 'var(--text-primary)' }}>Cổng thanh toán điện tử trực tuyến (VNPAY)</p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Bạn sẽ được chuyển tới cổng thanh toán an toàn để hoàn tất giữ chỗ.</p>
          </section>

          <label style={{ ...cardStyle, flexDirection: 'row', alignItems: 'flex-start', gap: 10, cursor: 'pointer' }}>
            <input type="checkbox" checked={agreed} onChange={(event) => setAgreed(event.target.checked)} style={{ marginTop: 3 }} />
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Tôi đã đọc và đồng ý với Quy định đặt sân & Chính sách hoàn tiền của SmashPro.
            </span>
          </label>
        </div>

        <aside className="booking-summary-aside" style={{ ...cardStyle, gap: 14 }}>
          <h2 style={cardTitleStyle}>Chi tiết thanh toán</h2>
          {lines.map((line) => (
            <div key={`${line.startTime}-${line.endTime}`} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span style={{ color: 'var(--text-secondary)' }}>{formatTimeRange(line.startTime, line.endTime)}</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{formatCurrency(line.amount)}</span>
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: 12 }}>
            <span style={{ fontWeight: 700 }}>TỔNG CỘNG</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 18 }}>{formatCurrency(total)}</span>
          </div>
          {submitError && <span role="alert" style={{ fontSize: 13, color: 'var(--color-danger)' }}>{submitError}</span>}
          <button
            type="button"
            disabled={!agreed || submitting}
            onClick={handleSubmit}
            style={{ padding: '12px 18px', borderRadius: 8, backgroundColor: 'var(--color-brand)', color: '#FFFFFF', fontWeight: 700, fontSize: 14 }}
          >
            {submitting ? 'Đang tạo đơn...' : `Tiến hành thanh toán (${formatCurrency(total)})`}
          </button>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)' }}>
            <CheckShieldIcon size={14} color="var(--color-brand)" />
            Khung giờ được giữ tối đa 10 phút để bạn thanh toán.
          </span>
        </aside>
      </div>
    </div>
  );
}

const cardStyle = {
  display: 'flex',
  flexDirection: 'column' as const,
  gap: 4,
  padding: 20,
  borderRadius: 14,
  backgroundColor: 'var(--bg-card)',
  border: '1px solid var(--border-card)',
  boxShadow: 'var(--shadow-sm)',
};

const cardTitleStyle = {
  fontFamily: 'Inter, sans-serif',
  fontWeight: 700,
  fontSize: 15,
  color: 'var(--text-primary)',
  marginBottom: 6,
};
