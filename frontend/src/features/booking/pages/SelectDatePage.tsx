import { useBookingMatchContext } from '../hooks/useBookingMatchContext';
import { MatchBookingContext } from '../components/MatchBookingContext';
import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { bookingService } from '../services/bookingService';
import { StateBlock } from '../components/StateBlocks';
import { ArrowLeftIcon } from '../../../components/common/Icons';
import { addDaysIso, formatCurrency, todayIso } from '../utils/booking';
import type { CourtAvailability } from '../types/booking';

interface DayInfo {
  date: string;
  availability: CourtAvailability | null;
  failed: boolean;
}

function weekdayLabel(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('vi-VN', { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(Date.UTC(year, month - 1, day))
  );
}

export function SelectDatePage() {
  const { forMatch } = useBookingMatchContext();
  const { courtId: courtIdParam } = useParams();
  const courtId = Number(courtIdParam);
  const navigate = useNavigate();
  const [days, setDays] = useState<DayInfo[]>([]);
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');

  const load = useCallback(async () => {
    if (!Number.isFinite(courtId)) return;
    setStatus('loading');
    const start = todayIso();
    const dates = Array.from({ length: 7 }, (_, index) => addDaysIso(start, index));
    const results = await Promise.allSettled(
      dates.map((date) => bookingService.getCourtAvailability(courtId, date, 60))
    );
    setDays(
      results.map((result, index) => ({
        date: dates[index],
        availability: result.status === 'fulfilled' ? result.value : null,
        failed: result.status === 'rejected',
      }))
    );
    setStatus('success');
  }, [courtId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!Number.isFinite(courtId)) {
    return <StateBlock title="Sân không hợp lệ" description="Đường dẫn không hợp lệ." />;
  }
  if (status === 'loading') {
    return <StateBlock title="Đang tải lịch..." description="Đang kiểm tra các ngày sắp tới." />;
  }

  const courtName = days.find((day) => day.availability)?.availability?.court.name ?? 'Sân';

  return (
    <div style={{ width: '100%', maxWidth: 1000, margin: '0 auto', padding: '32px 24px 64px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <MatchBookingContext />
      <Link to={forMatch('/courts')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--color-brand)' }}>
        <ArrowLeftIcon size={16} color="var(--color-brand)" />
        Danh sách sân
      </Link>

      <header>
        <h1 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 24, color: 'var(--text-primary)' }}>
          Bước 1/3: Chọn ngày chơi
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text-secondary)' }}>{courtName} · chọn 1 trong 7 ngày tới</p>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 }}>
        {days.map((day) => {
          const intervals = day.availability?.intervals ?? [];
          const cheapest = intervals.reduce<number | null>(
            (min, interval) => (interval.estimatedPrice !== null && (min === null || interval.estimatedPrice < min) ? interval.estimatedPrice : min),
            null
          );
          const disabled = day.failed || intervals.length === 0;
          return (
            <button
              key={day.date}
              type="button"
              disabled={disabled}
              onClick={() => navigate(forMatch(`/courts/${courtId}?date=${day.date}`))}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: 4,
                padding: 16,
                borderRadius: 12,
                textAlign: 'left',
                border: '1px solid var(--border-card)',
                backgroundColor: disabled ? 'var(--bg-table-header)' : 'var(--bg-card)',
                boxShadow: 'var(--shadow-sm)',
                opacity: disabled ? 0.6 : 1,
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{weekdayLabel(day.date)}</span>
              <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{day.date.slice(8, 10)}/{day.date.slice(5, 7)}</span>
              <span style={{ fontSize: 12, color: disabled ? 'var(--text-secondary)' : 'var(--color-brand)', fontWeight: 600 }}>
                {disabled ? 'Hết chỗ' : `${intervals.length} khung giờ`}
              </span>
              {!disabled && <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Từ {formatCurrency(cheapest)}/giờ</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
