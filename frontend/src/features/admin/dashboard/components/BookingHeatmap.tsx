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
      <div className="dashboard-chart-tooltip-host" ref={hostRef}>
      <div className="dashboard-heatmap-scroll">
        <div className="dashboard-heatmap">
          <div className="dashboard-heatmap-hours" aria-hidden="true">
            <span />
            {Array.from({ length: 24 }, (_, hour) => (
              <span key={hour}>{hour % 3 === 0 ? `${hour}h` : ''}</span>
            ))}
          </div>

          {WEEKDAYS.map((label, index) => {
            const weekday = index + 1;
            return (
              <div className="dashboard-heatmap-row" key={label}>
                <span className="dashboard-heatmap-weekday">{label}</span>
                {Array.from({ length: 24 }, (_, hour) => {
                  const count = lookup.get(`${weekday}-${hour}`) ?? 0;
                  const intensity = count === 0 ? 0 : 0.18 + (count / max) * 0.82;
                  return (
                    <span
                      key={hour}
                      className="dashboard-heatmap-cell"
                      style={{ backgroundColor: count === 0 ? undefined : `rgba(0, 107, 44, ${intensity})` }}
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
      <div className="dashboard-heatmap-legend">
        <span>Ít</span>
        <i style={{ backgroundColor: 'rgba(0, 107, 44, 0.18)' }} />
        <i style={{ backgroundColor: 'rgba(0, 107, 44, 0.5)' }} />
        <i style={{ backgroundColor: 'rgba(0, 107, 44, 0.8)' }} />
        <i style={{ backgroundColor: 'rgba(0, 107, 44, 1)' }} />
        <span>Nhiều</span>
      </div>
    </ChartCard>
  );
};
