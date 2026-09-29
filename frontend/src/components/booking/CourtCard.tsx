import { CourtIcon, ChevronRightIcon } from '../common/Icons';
import { formatCurrency, formatTimeRange } from '../../utils/booking';
import type { CourtSummary } from '../../types/booking';

interface CourtCardProps {
  court: CourtSummary;
  onView: (courtId: number) => void;
}

export function CourtCard({ court, onView }: CourtCardProps) {
  return (
    <article
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: 14,
        padding: 20,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: 'var(--bg-tag-green)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-brand)',
              flexShrink: 0,
            }}
          >
            <CourtIcon size={22} color="var(--color-brand)" />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <h3 style={{ fontFamily: 'Inter, sans-serif', fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>
              {court.facility.name}
            </h3>
            <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{court.name}</span>
          </div>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 10px',
            borderRadius: 9999,
            fontSize: 11,
            fontWeight: 700,
            backgroundColor: 'var(--bg-tag-green)',
            color: 'var(--color-brand)',
            whiteSpace: 'nowrap',
          }}
        >
          {court.available ? 'Còn trống' : 'Hết chỗ'}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, color: 'var(--text-secondary)' }}>
        <span>{court.facility.address}</span>
        <span>
          {court.facility.ward}, {court.facility.district}, {court.facility.city}
        </span>
        <span>
          Mở cửa: {formatTimeRange(court.facility.openingTime, court.facility.closingTime)} hàng ngày
        </span>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          borderTop: '1px solid var(--border-subtle)',
          paddingTop: 14,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', color: 'var(--text-secondary)' }}>
            GIÁ CHỈ TỪ
          </span>
          <span style={{ fontFamily: 'Inter, sans-serif', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)' }}>
            {formatCurrency(court.priceFrom)}
            <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}> /giờ</span>
          </span>
        </div>
        <button
          type="button"
          onClick={() => onView(court.id)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '10px 16px',
            borderRadius: 8,
            backgroundColor: 'var(--color-brand)',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Xem lịch trống
          <ChevronRightIcon size={14} color="#FFFFFF" />
        </button>
      </div>
    </article>
  );
}
