import React from 'react';
import { ChartTooltip, useChartTooltip } from './ChartTooltip';
import type { DashboardChartPoint } from '../types/dashboard';

interface GrowthChartProps {
  newUsers: DashboardChartPoint[];
  newBookings: DashboardChartPoint[];
}

const WIDTH = 720;
const HEIGHT = 280;
const PADDING = { top: 24, right: 24, bottom: 40, left: 44 };
const LINE_HIT_DISTANCE = 9;

function formatShortDate(value: string): string {
  const [, month, day] = value.split('-');
  return `${day}/${month}`;
}

function buildPath(points: DashboardChartPoint[], max: number): string {
  if (points.length === 0) return '';
  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const step = points.length > 1 ? innerWidth / (points.length - 1) : 0;

  return points
    .map((point, index) => {
      const x = points.length === 1 ? PADDING.left + innerWidth / 2 : PADDING.left + step * index;
      const y = PADDING.top + innerHeight - (point.count / max) * innerHeight;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export const GrowthChart: React.FC<GrowthChartProps> = ({ newUsers, newBookings }) => {
  const { hostRef, tooltip, showTooltip, hideTooltip } = useChartTooltip();
  const dates = newUsers.map(point => point.date);
  const maxValue = Math.max(
    1,
    ...newUsers.map(point => point.count),
    ...newBookings.map(point => point.count),
  );
  const isEmpty = newUsers.every(point => point.count === 0) && newBookings.every(point => point.count === 0);

  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const gridLines = [0, 0.25, 0.5, 0.75, 1];

  const centerAt = (index: number) => {
    const step = newUsers.length > 1 ? innerWidth / (newUsers.length - 1) : 0;
    return newUsers.length === 1 ? PADDING.left + innerWidth / 2 : PADDING.left + step * index;
  };

  const positionAt = (index: number, count: number) => {
    const y = PADDING.top + innerHeight - (count / maxValue) * innerHeight;
    return { x: centerAt(index), y };
  };

  /**
   * Only show the tooltip when the pointer is close to one of the rendered data
   * lines (or their single-point marker), not anywhere inside the plot area.
   */
  const handleChartMouseMove = (event: React.MouseEvent<SVGSVGElement>) => {
    const svg = event.currentTarget;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0 || newUsers.length === 0) {
      hideTooltip();
      return;
    }

    const x = (event.clientX - rect.left) * (WIDTH / rect.width);
    const y = (event.clientY - rect.top) * (HEIGHT / rect.height);

    if (
      x < PADDING.left || x > WIDTH - PADDING.right
      || y < PADDING.top || y > PADDING.top + innerHeight
    ) {
      hideTooltip();
      return;
    }

    const centers = newUsers.map((_, index) => centerAt(index));

    const interpolatedY = (points: DashboardChartPoint[]): number | null => {
      if (points.length === 0) return null;
      if (points.length === 1) {
        return Math.abs(x - centers[0]) <= LINE_HIT_DISTANCE
          ? positionAt(0, points[0].count).y
          : null;
      }

      let left = 0;
      while (left < centers.length - 2 && x > centers[left + 1]) left += 1;

      const x0 = centers[left];
      const x1 = centers[left + 1];
      if (x < x0 || x > x1) return null;

      const y0 = positionAt(left, points[left].count).y;
      const y1 = positionAt(left + 1, points[left + 1].count).y;
      const ratio = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
      return y0 + (y1 - y0) * ratio;
    };

    const usersLineY = interpolatedY(newUsers);
    const bookingsLineY = interpolatedY(newBookings);
    const nearUsersLine = usersLineY !== null && Math.abs(y - usersLineY) <= LINE_HIT_DISTANCE;
    const nearBookingsLine = bookingsLineY !== null && Math.abs(y - bookingsLineY) <= LINE_HIT_DISTANCE;

    if (!nearUsersLine && !nearBookingsLine) {
      hideTooltip();
      return;
    }

    let nearestIndex = 0;
    let smallestDistance = Number.POSITIVE_INFINITY;
    centers.forEach((center, index) => {
      const distance = Math.abs(x - center);
      if (distance < smallestDistance) {
        smallestDistance = distance;
        nearestIndex = index;
      }
    });

    const point = newUsers[nearestIndex];
    if (!point) {
      hideTooltip();
      return;
    }

    showTooltip(event, {
      title: formatShortDate(point.date),
      rows: [
        { label: 'Người chơi mới', value: String(point.count), color: 'var(--color-brand)' },
        {
          label: 'Lượt đặt sân',
          value: String(newBookings[nearestIndex]?.count ?? 0),
          color: 'var(--color-brand-blue)',
        },
      ],
    });
  };

  return (
    <section className="dashboard-card dashboard-chart-card" data-testid="growth-chart">
      <header className="dashboard-card-header">
        <div>
          <h2>Tăng trưởng theo ngày</h2>
          <p>Người chơi mới và lượt đặt sân trong khoảng thời gian đã chọn.</p>
        </div>
        <div className="dashboard-chart-legend" aria-hidden="true">
          <span><i className="legend-dot users" />Người chơi mới</span>
          <span><i className="legend-dot bookings" />Lượt đặt sân</span>
        </div>
      </header>

      <div className="dashboard-chart-frame dashboard-chart-tooltip-host" ref={hostRef}>
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="Biểu đồ tăng trưởng người chơi mới và lượt đặt sân theo ngày"
          preserveAspectRatio="xMidYMid meet"
          onMouseMove={handleChartMouseMove}
          onMouseLeave={hideTooltip}
        >
          <title>Biểu đồ tăng trưởng theo ngày</title>
          {gridLines.map(ratio => {
            const y = PADDING.top + innerHeight - ratio * innerHeight;
            return (
              <g key={ratio}>
                <line
                  x1={PADDING.left}
                  x2={WIDTH - PADDING.right}
                  y1={y}
                  y2={y}
                  className="chart-grid-line"
                />
                <text x={PADDING.left - 8} y={y + 4} textAnchor="end" className="chart-axis-label">
                  {Math.round(maxValue * ratio)}
                </text>
              </g>
            );
          })}

          <path d={buildPath(newUsers, maxValue)} className="chart-line users" />
          <path d={buildPath(newBookings, maxValue)} className="chart-line bookings" />

          {newUsers.map((point, index) => {
            const bookingCount = newBookings[index]?.count ?? 0;
            const userPosition = positionAt(index, point.count);
            const bookingPosition = positionAt(index, bookingCount);
            return (
              <g key={point.date}>
                <circle cx={userPosition.x} cy={userPosition.y} r={3} className="chart-point users" />
                <circle cx={bookingPosition.x} cy={bookingPosition.y} r={3} className="chart-point bookings" />
              </g>
            );
          })}

          {dates.length > 0 && (
            <>
              <text x={PADDING.left} y={HEIGHT - 12} className="chart-axis-label" textAnchor="start">
                {formatShortDate(dates[0])}
              </text>
              {dates.length > 1 && (
                <text x={WIDTH - PADDING.right} y={HEIGHT - 12} className="chart-axis-label" textAnchor="end">
                  {formatShortDate(dates[dates.length - 1])}
                </text>
              )}
            </>
          )}
        </svg>

        {isEmpty && (
          <div className="dashboard-chart-empty">
            Chưa có dữ liệu tăng trưởng trong khoảng thời gian này.
          </div>
        )}
        <ChartTooltip tooltip={tooltip} />
      </div>
    </section>
  );
};
