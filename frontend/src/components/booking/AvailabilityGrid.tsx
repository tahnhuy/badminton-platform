import { formatCurrency, formatTimeRange } from '../../utils/booking';
import type { FreeInterval } from '../../types/booking';

interface AvailabilityGridProps {
  intervals: FreeInterval[];
  durationMinutes: number;
  selectedStart: string | null;
  onSelect: (start: string) => void;
}

function segmentLabel(interval: FreeInterval): string {
  const prices = Array.from(new Set(interval.segments.map((segment) => segment.price)));
  if (prices.length === 1) {
    return `${formatCurrency(prices[0])}/giờ`;
  }
  return `${prices.length} mức giá`;
}

export function AvailabilityGrid({ intervals, durationMinutes, selectedStart, onSelect }: AvailabilityGridProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
      {intervals.map((interval) => {
        const fits = interval.durationMinutes >= durationMinutes;
        const isSelected = selectedStart === interval.startTime;
        return (
          <button
            key={interval.startTime}
            type="button"
            disabled={!fits}
            onClick={() => onSelect(interval.startTime)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 4,
              padding: '14px 16px',
              borderRadius: 12,
              textAlign: 'left',
              border: isSelected ? '2px solid var(--color-brand)' : '1px solid var(--border-card)',
              backgroundColor: isSelected ? 'var(--color-brand-light)' : 'var(--bg-card)',
              boxShadow: 'var(--shadow-sm)',
            }}
          >
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              {formatTimeRange(interval.startTime, interval.endTime)}
            </span>
            <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              {interval.durationMinutes} phút · {segmentLabel(interval)}
            </span>
            <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-brand)' }}>
              {fits
                ? interval.estimatedPrice !== null
                  ? `${formatCurrency(interval.estimatedPrice)} / ${durationMinutes} phút`
                  : 'Chọn khung giờ'
                : 'Không đủ thời lượng'}
            </span>
          </button>
        );
      })}
    </div>
  );
}
