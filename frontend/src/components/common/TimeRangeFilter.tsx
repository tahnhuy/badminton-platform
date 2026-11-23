import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { cn } from '@/shared/utils/cn';
import {
  TIME_RANGE_OPTIONS,
  addDaysToIsoDate,
  isIsoDate,
  todayIsoDate,
  type TimeRangePreset,
  type TimeRangeValue,
} from '../../shared/time-range';

interface TimeRangeFilterProps {
  value: TimeRangeValue;
  onChange: (value: TimeRangeValue) => void;
  disabled?: boolean;
  className?: string;
  label?: string;
  /** `inline` keeps the presets and the custom from/to inputs on one row. */
  layout?: 'stack' | 'inline';
}

export const TimeRangeFilter: React.FC<TimeRangeFilterProps> = ({
  value,
  onChange,
  disabled = false,
  className = '',
  label = 'Khoảng thời gian',
  layout = 'stack',
}) => {
  const inline = layout === 'inline';
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
    <div className={cn('flex flex-col gap-2.5 max-md:items-stretch', inline
      ? 'flex-row flex-wrap items-start gap-x-1 gap-y-2 max-md:flex-col max-md:items-stretch'
      : 'items-start', className)} data-testid="time-range-filter">
      <div className={cn('flex flex-wrap items-center gap-2.5 max-md:w-full max-md:flex-col max-md:items-stretch',
        inline && 'shrink-0 flex-nowrap flex-col items-start gap-1')}>
        <span className="text-xs font-bold whitespace-nowrap text-muted-foreground leading-4">{label}</span>

        <div className="inline-flex shrink-0 gap-0.5 rounded-lg border border-border bg-muted/60 p-1 max-md:grid max-md:w-full max-md:grid-cols-2" role="group" aria-label={label}>
          {TIME_RANGE_OPTIONS.map(option => (
            <Button variant="ghost"
              key={option.value}
              type="button"
              className={cn('h-8 rounded-md px-3 py-1.5 text-sm font-semibold whitespace-nowrap text-muted-foreground transition-colors',
                'hover:bg-accent hover:text-primary disabled:cursor-wait disabled:opacity-70',
                mode === option.value && 'bg-card text-primary shadow-sm')}
              aria-pressed={mode === option.value}
              data-range={option.value}
              disabled={disabled}
              onClick={() => selectPreset(option.value)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {mode === 'custom' && (
        <div className={cn('flex w-full flex-wrap items-end justify-end gap-3 max-md:w-full',
          inline && 'w-auto shrink-0 justify-start')}>
          <label className="flex shrink-0 flex-col items-start gap-1 text-2xs font-semibold text-muted-foreground max-md:w-full max-md:flex-1">
            <span>Từ ngày</span>
            <Input
              type="date"
              className={cn('h-9 rounded-lg border border-input bg-card px-2.5 text-sm text-foreground outline-none transition-colors hover:border-ring/40 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/10 disabled:cursor-not-allowed disabled:opacity-50',
                inline ? 'w-36' : 'w-44', 'max-md:w-full')}
              value={draftStart}
              max={isIsoDate(draftEnd) ? addDaysToIsoDate(draftEnd, -1) : undefined}
              disabled={disabled}
              onChange={event => setDraftStart(event.target.value)}
            />
          </label>

          <label className="flex shrink-0 flex-col items-start gap-1 text-2xs font-semibold text-muted-foreground max-md:w-full max-md:flex-1">
            <span>Đến ngày</span>
            <Input
              type="date"
              className={cn('h-9 rounded-lg border border-input bg-card px-2.5 text-sm text-foreground outline-none transition-colors hover:border-ring/40 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/10 disabled:cursor-not-allowed disabled:opacity-50',
                inline ? 'w-36' : 'w-44', 'max-md:w-full')}
              value={draftEnd}
              min={endMin}
              disabled={disabled}
              onChange={event => setDraftEnd(event.target.value)}
            />
          </label>

          <Button type="button" variant="brand" className="h-9 px-3.5 max-md:w-full"
            disabled={disabled || !canApply} onClick={applyCustom}>
            Áp dụng
          </Button>
        </div>
      )}

      {mode === 'custom' && rangeInvalid && (
        <p className="basis-full text-xs font-semibold text-danger" role="alert">
          Ngày kết thúc phải sau ngày bắt đầu.
        </p>
      )}
    </div>
  );
};
