import type { CSSProperties } from 'react';
import { SearchIcon } from '../common/Icons';

export interface CourtSearchFilterValue {
  city: string;
  district: string;
  date: string;
  startTime: string;
  endTime: string;
}

interface CourtSearchFiltersProps {
  value: CourtSearchFilterValue;
  onChange: (patch: Partial<CourtSearchFilterValue>) => void;
  onSubmit: () => void;
  onReset: () => void;
}

const inputStyle: CSSProperties = {
  height: 42,
  padding: '0 12px',
  borderRadius: 8,
  backgroundColor: 'var(--bg-table-header)',
  fontSize: 13,
  color: 'var(--text-primary)',
  width: '100%',
};

export function CourtSearchFilters({ value, onChange, onSubmit, onReset }: CourtSearchFiltersProps) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
        gap: 12,
        alignItems: 'end',
        padding: 20,
        backgroundColor: 'var(--bg-card)',
        border: '1px solid var(--border-card)',
        borderRadius: 14,
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
        TỈNH / THÀNH PHỐ
        <input
          style={inputStyle}
          value={value.city}
          placeholder="VD: TP. Hồ Chí Minh"
          onChange={(event) => onChange({ city: event.target.value })}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
        QUẬN / HUYỆN
        <input
          style={inputStyle}
          value={value.district}
          placeholder="VD: Quận 7"
          onChange={(event) => onChange({ district: event.target.value })}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
        NGÀY CHƠI
        <input
          type="date"
          style={inputStyle}
          value={value.date}
          onChange={(event) => onChange({ date: event.target.value })}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
        TỪ GIỜ
        <input
          type="time"
          style={inputStyle}
          value={value.startTime}
          onChange={(event) => onChange({ startTime: event.target.value })}
        />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
        ĐẾN GIỜ
        <input
          type="time"
          style={inputStyle}
          value={value.endTime}
          onChange={(event) => onChange({ endTime: event.target.value })}
        />
      </label>
      <div style={{ display: 'flex', gap: 10 }}>
        <button
          type="submit"
          style={{
            flex: 1,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            height: 42,
            borderRadius: 8,
            backgroundColor: 'var(--color-brand)',
            color: '#FFFFFF',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          <SearchIcon size={15} color="#FFFFFF" />
          Tìm sân
        </button>
        <button
          type="button"
          onClick={onReset}
          style={{
            height: 42,
            padding: '0 16px',
            borderRadius: 8,
            backgroundColor: 'var(--bg-tag-uid)',
            color: 'var(--text-primary)',
            fontWeight: 600,
            fontSize: 13,
          }}
        >
          Xóa lọc
        </button>
      </div>
    </form>
  );
}
