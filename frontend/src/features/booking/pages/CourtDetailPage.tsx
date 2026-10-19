import { useBookingMatchContext } from '../hooks/useBookingMatchContext';
import { MatchBookingContext } from '../components/MatchBookingContext';
import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useCourtAvailability } from '../hooks/useCourtAvailability';
import { useNow } from '../hooks/useNow';
import { AvailabilityGrid } from '../components/AvailabilityGrid';
import { LoadingCards, StateBlock } from '../components/StateBlocks';
import { ArrowLeftIcon, SyncIcon } from '../../../components/common/Icons';
import { formatCurrency, formatDisplayDate, formatDuration, formatTimeRange, todayIso } from '../utils/booking';

const DURATION_OPTIONS = [60, 90, 120, 150, 180];

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
    Number.isFinite(courtId) ? courtId : null,
    date,
    durationMinutes
  );
  const now = useNow();

  useEffect(() => {
    setSelectedStart(null);
  }, [date, durationMinutes]);

  const selectedInterval = availability?.intervals.find((interval) => interval.startTime === selectedStart) ?? null;

  if (!Number.isFinite(courtId)) {
    return <StateBlock title="Sân không hợp lệ" description="Đường dẫn không hợp lệ." />;
  }

  return (
    <div style={{ width: '100%', maxWidth: 1200, margin: '0 auto', padding: '32px 24px 64px', display: 'flex', flexDirection: 'column', gap: 24 }}>
      <MatchBookingContext />
      <Link to={forMatch('/courts')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--color-brand)' }}>
        <ArrowLeftIcon size={16} color="var(--color-brand)" />
        Quay lại danh sách sân
      </Link>

      {availability && (
        <header style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 26, letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
            {availability.court.name}
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            <Link to={forMatch(`/facilities/${availability.facility.id}?date=${date}`)} style={{ color: 'var(--color-brand)', fontWeight: 600 }}>
              {availability.facility.name}
            </Link>{' '}
            · {availability.facility.address}, {availability.facility.district}, {availability.facility.city}
          </p>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Giờ mở cửa: {formatTimeRange(availability.openingTime, availability.closingTime)}
          </p>
        </header>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'end' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
          NGÀY CHƠI
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            style={{ height: 42, padding: '0 12px', borderRadius: 8, backgroundColor: 'var(--bg-table-header)', fontSize: 13, color: 'var(--text-primary)' }}
          />
        </label>
        <Link
          to={forMatch(`/courts/${courtId}/date`)}
          style={{ display: 'inline-flex', alignItems: 'center', height: 42, padding: '0 16px', borderRadius: 8, backgroundColor: 'var(--bg-tag-uid)', color: 'var(--text-primary)', fontWeight: 600, fontSize: 13 }}
        >
          Chọn ngày khác
        </Link>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
          THỜI LƯỢNG
          <select
            value={durationMinutes}
            onChange={(event) => setDurationMinutes(Number(event.target.value))}
            style={{ height: 42, padding: '0 12px', borderRadius: 8, backgroundColor: 'var(--bg-table-header)', fontSize: 13, color: 'var(--text-primary)' }}
          >
            {DURATION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {formatDuration(option)}
              </option>
            ))}
          </select>
        </label>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-secondary)', marginLeft: 'auto' }}>
          <SyncIcon size={15} color="var(--color-brand)" />
          Cập nhật thời gian thực
          <span>· {now.toLocaleTimeString('vi-VN')}</span>
        </div>
      </div>

      <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)' }}>
            Khung giờ trống ngày {formatDisplayDate(date)}
          </h2>
        </div>

        {status === 'loading' && <LoadingCards count={4} />}
        {status === 'error' && error && (
          <StateBlock title="Không tải được lịch trống" description={error} actionLabel="Thử lại" onAction={() => void refresh()} />
        )}
        {status === 'success' && availability && availability.intervals.length === 0 && (
          <StateBlock
            title="Hết khung giờ trống"
            description="Ngày này đã kín lịch hoặc chưa có bảng giá. Vui lòng chọn ngày khác."
          />
        )}
        {status === 'success' && availability && availability.intervals.length > 0 && (
          <AvailabilityGrid
            intervals={availability.intervals}
            durationMinutes={durationMinutes}
            selectedStart={selectedStart}
            onSelect={setSelectedStart}
          />
        )}
      </section>

      {selectedInterval && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            padding: 20,
            borderRadius: 14,
            backgroundColor: 'var(--color-brand-light)',
            border: '1px solid var(--border-card)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>KHUNG GIỜ ĐÃ CHỌN</span>
            <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
              {formatDisplayDate(date)} · {formatTimeRange(selectedInterval.startTime, selectedInterval.endTime)}
            </span>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Thời lượng: {formatDuration(durationMinutes)} · Tạm tính{' '}
              {formatCurrency(selectedInterval.estimatedPrice)}
            </span>
          </div>
          <button
            type="button"
            onClick={() =>
              navigate(
                forMatch(`/bookings/new?courtId=${courtId}&date=${date}&startTime=${selectedInterval.startTime}&durationMinutes=${durationMinutes}`)
              )
            }
            style={{ padding: '12px 22px', borderRadius: 8, backgroundColor: 'var(--color-brand)', color: '#FFFFFF', fontWeight: 600, fontSize: 14 }}
          >
            Tiếp tục đặt sân
          </button>
        </div>
      )}
    </div>
  );
}
