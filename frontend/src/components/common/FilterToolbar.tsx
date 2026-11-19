import React from 'react';
import { SearchIcon, ChevronDownIcon, CloseIcon } from './Icons';

export interface FilterSelectConfig {
  id: string;
  value: string;
  placeholder?: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  ariaLabel?: string;
}

export interface ActiveFilterChip {
  id: string;
  label: string;
  onRemove: () => void;
}

export interface FilterToolbarProps {
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  };
  filters?: FilterSelectConfig[];
  extra?: React.ReactNode;
  activeChips?: ActiveFilterChip[];
  totalCount?: number;
  totalCountLabel?: string;
  onClearAll?: () => void;
  rightActions?: React.ReactNode;
}

export const FilterToolbar: React.FC<FilterToolbarProps> = ({
  search,
  filters = [],
  extra,
  activeChips = [],
  totalCount,
  totalCountLabel = 'kết quả phù hợp',
  onClearAll,
  rightActions,
}) => {
  const hasActiveFilters = activeChips.length > 0 || Boolean(search?.value);

  return (
    <div className="filter-toolbar-container">
      {/* Search & Select Grid */}
      <div className="filter-toolbar-grid">
        {/* Search Input */}
        {search && (
          <div style={{ position: 'relative' }}>
            <div
              style={{
                position: 'absolute',
                left: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-secondary)',
                display: 'flex',
              }}
            >
              <SearchIcon size={16} />
            </div>
            <input
              type="text"
              value={search.value}
              onChange={(e) => search.onChange(e.target.value)}
              placeholder={search.placeholder || 'Tìm kiếm...'}
              style={{
                width: '100%',
                height: 40,
                paddingLeft: 40,
                paddingRight: 16,
                borderRadius: 8,
                backgroundColor: 'var(--bg-table-header)',
                fontSize: 13,
                color: 'var(--text-primary)',
              }}
            />
          </div>
        )}

        {/* Dynamic Filters */}
        {filters.map((f) => (
          <div key={f.id} style={{ position: 'relative' }}>
            <select
              value={f.value}
              onChange={(e) => f.onChange(e.target.value)}
              aria-label={f.ariaLabel || f.placeholder}
              style={{
                width: '100%',
                height: 40,
                paddingLeft: 12,
                paddingRight: 32,
                borderRadius: 8,
                backgroundColor: 'var(--bg-table-header)',
                fontSize: 13,
                fontWeight: 500,
                color: f.value ? 'var(--text-primary)' : 'var(--text-secondary)',
                cursor: 'pointer',
                appearance: 'none',
              }}
            >
              {f.placeholder && <option value="">{f.placeholder}</option>}
              {f.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <div
              style={{
                position: 'absolute',
                right: 12,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                color: 'var(--text-secondary)',
                display: 'flex',
              }}
            >
              <ChevronDownIcon size={14} />
            </div>
          </div>
        ))}

        {extra && <div style={{ gridColumn: '1 / -1', width: '100%' }}>{extra}</div>}

        {rightActions && <div>{rightActions}</div>}
      </div>

      {/* Active Filter Chips Bar */}
      {hasActiveFilters && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingTop: 12,
            borderTop: '1px solid var(--border-subtle)',
            flexWrap: 'wrap',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              ĐANG LỌC:
            </span>

            {search?.value && (
              <span className="badge badge-surface" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                Tìm kiếm: "{search.value}"
                <button
                  type="button"
                  onClick={() => search.onChange('')}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
                >
                  <CloseIcon size={12} />
                </button>
              </span>
            )}

            {activeChips.map((chip) => (
              <span
                key={chip.id}
                className="badge badge-surface"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {chip.label}
                <button
                  type="button"
                  onClick={chip.onRemove}
                  style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex' }}
                >
                  <CloseIcon size={12} />
                </button>
              </span>
            ))}

            {onClearAll && (
              <button
                type="button"
                onClick={onClearAll}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--primary-color)',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginLeft: 4,
                }}
              >
                Xóa tất cả
              </button>
            )}
          </div>

          {typeof totalCount === 'number' && (
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Tìm thấy <strong style={{ color: 'var(--text-primary)' }}>{totalCount}</strong> {totalCountLabel}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
