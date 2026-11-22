import { heatmapColor } from './chart-style';
import React from 'react';
import { ChartCard } from './ChartCard';
import { ChartTooltip, useChartTooltip } from './ChartTooltip';
import type { BookingHeatmapCell } from '../types/dashboard';

interface BookingHeatmapProps {
  cells: BookingHeatmapCell[];
}

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export const BookingHeatmap: React.FC<BookingHeatmapProps> = ({ cells }) => {
  const { hostRef, tooltip, showTooltip, hideTooltip } = useChartTooltip();
  const max = Math.max(1, ...cells.map(cell => cell.count));
  const lookup = new Map(cells.map(cell => [`${cell.weekday}-${cell.hour}`, cell.count]));
  const isEmpty = cells.length === 0;

  return (
    <ChartCard
      title="Khung giờ đặt sân"
      description="Mật độ lượt đặt sân theo thứ và giờ bắt đầu."
      testId="chart-booking-heatmap"
      isEmpty={isEmpty}
      footnote="Chỉ tính booking CONFIRMED, IN_PROGRESS và COMPLETED trong kỳ."
    >
      <div className="dashboard-chart-tooltip-host relative" ref={hostRef}>
      <div className="dashboard-heatmap-scroll overflow-x-auto pb-1">
        <div className="dashboard-heatmap flex min-w-140 flex-col gap-1">
          <div className="dashboard-heatmap-hours grid grid-cols-[34px_repeat(24,minmax(16px,1fr))] items-center gap-1 [&_span]:text-center [&_span]:text-2xs [&_span]:whitespace-nowrap [&_span]:text-muted-foreground" aria-hidden="true">
            <span />
            {Array.from({ length: 24 }, (_, hour) => (
              <span key={hour}>{hour % 3 === 0 ? `${hour}h` : ''}</span>
            ))}
          </div>

          {WEEKDAYS.map((label, index) => {
            const weekday = index + 1;
            return (
              <div className="dashboard-heatmap-row grid grid-cols-[34px_repeat(24,minmax(16px,1fr))] items-center gap-1" key={label}>
                <span className="dashboard-heatmap-weekday text-xs font-bold text-muted-foreground">{label}</span>
                {Array.from({ length: 24 }, (_, hour) => {
                  const count = lookup.get(`${weekday}-${hour}`) ?? 0;
                  const intensity = count === 0 ? 0 : 0.18 + (count / max) * 0.82;
                  return (
                    <span
                      key={hour}
                      className="dashboard-heatmap-cell block h-4.5 rounded-md bg-muted hover:outline hover:outline-primary"
                      style={heatmapColor(intensity)}
                      aria-label={`${label} ${hour}h — ${count} lượt`}
                      onMouseMove={count > 0
                        ? event => showTooltip(event, {
                          title: `${label} · ${hour}:00`,
                          rows: [{ label: 'Lượt đặt sân', value: `${count} lượt`, color: 'var(--color-brand)' }],
                        })
                        : undefined}
                      onMouseLeave={count > 0 ? hideTooltip : undefined}
                    />
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <ChartTooltip tooltip={tooltip} />
      </div>
      <div className="dashboard-heatmap-legend mt-2.5 flex items-center justify-end gap-1.5 text-xs text-muted-foreground [&_i]:size-3 [&_i]:rounded-md">
        <span>Ít</span>
        <i className="bg-primary/20" />
        <i className="bg-primary/50" />
        <i className="bg-primary/80" />
        <i className="bg-primary" />
        <span>Nhiều</span>
      </div>
    </ChartCard>
  );
};
