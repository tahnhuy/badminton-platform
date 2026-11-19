import React, { useEffect, useState } from 'react';
import {
  TIME_RANGE_OPTIONS,
  addDaysToIsoDate,
  isIsoDate,
  todayIsoDate,
  type TimeRangePreset,
  type TimeRangeValue,
} from '../../shared/time-range';
import './time-range-filter.css';

interface TimeRangeFilterProps {
  value: TimeRangeValue;
  onChange: (value: TimeRangeValue) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
}

export const TimeRangeFilter: React.FC<TimeRangeFilterProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
  label = 'Khoảng thời gian',
}) => {
  const [mode, setMode] = useState<TimeRangePreset>(value.preset);
  const [draftStart, setDraftStart] = useState(value.startDate ?? '');
  const [draftEnd, setDraftEnd] = useState(value.endDate ?? '');

  useEffect(() => {
    setMode(value.preset);
    if (value.preset === 'custom') {
      setDraftStart(value.startDate ?? '');
      setDraftEnd(value.endDate ?? '');
    }
  }, [value.preset, value.startDate, value.endDate]);

  const hasBothDates = isIsoDate(draftStart) && isIsoDate(draftEnd);
  const rangeInvalid = hasBothDates && draftEnd <= draftStart;
  const canApply = hasBothDates && !rangeInvalid;

  const selectPreset = (preset: TimeRangePreset) => {
    setMode(preset);
    if (preset !== 'custom') {
      onChange({ preset });
      return;
    }
    const today = todayIsoDate();
    setDraftStart(value.startDate ?? today);
    setDraftEnd(value.endDate ?? '');
  };

  const applyCustom = () => {
    if (!canApply) return;
    onChange({ preset: 'custom', startDate: draftStart, endDate: draftEnd });
  };

  const endMin = isIsoDate(draftStart) ? addDaysToIsoDate(draftStart, 1) : undefined;

  return (
    <div className={`time-range-filter ${className}`.trim()} data-testid="time-range-filter">
      <div className="time-range-filter-main">
        <span className="time-range-filter-label">{label}</span>

        <div className="time-range-filter-presets" role="group" aria-label={label}>
          {TIME_RANGE_OPTIONS.map(option => (
            <button
              key={option.value}
              type="button"
              className={`time-range-filter-preset${mode === option.value ? ' active' : ''}`}
              aria-pressed={mode === option.value}
              data-range={option.value}
              disabled={disabled}
              onClick={() => selectPreset(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      {mode === 'custom' && (
        <div className="time-range-filter-custom">
          <label>
            <span>Từ ngày</span>
            <input
              type="date"
              value={draftStart}
              max={isIsoDate(draftEnd) ? addDaysToIsoDate(draftEnd, -1) : undefined}
              disabled={disabled}
              onChange={event => setDraftStart(event.target.value)}
            />
          </label>

          <label>
            <span>Đến ngày</span>
            <input
              type="date"
              value={draftEnd}
              min={endMin}
              disabled={disabled}
              onChange={event => setDraftEnd(event.target.value)}
            />
          </label>

          <button
            type="button"
            className="time-range-filter-apply"
            disabled={disabled || !canApply}
            onClick={applyCustom}
          >
            Áp dụng
          </button>
        </div>
      )}

      {mode === 'custom' && rangeInvalid && (
        <p className="time-range-filter-error" role="alert">
          Ngày kết thúc phải sau ngày bắt đầu.
        </p>
      )}
    </div>
  );
};
