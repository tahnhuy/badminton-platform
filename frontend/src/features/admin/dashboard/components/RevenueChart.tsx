import React from 'react';
import { ChartCard } from './ChartCard';
import { ChartTooltip, useChartTooltip } from './ChartTooltip';
import type { RevenueChartPoint } from '../types/dashboard';

interface RevenueChartProps {
  points: RevenueChartPoint[];
}

const WIDTH = 720;
const HEIGHT = 240;
const PADDING = { top: 20, right: 20, bottom: 36, left: 48 };

function formatCompact(value: number): string {
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)} tỷ`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)} tr`;
  if (value >= 1_000) return `${Math.round(value / 1_000)}k`;
  return String(Math.round(value));
}

function formatShortDate(value: string): string {
  const [, month, day] = value.split('-');
  return `${day}/${month}`;
}

export const RevenueChart: React.FC<RevenueChartProps> = ({ points }) => {
  const { hostRef, tooltip, showTooltip, hideTooltip } = useChartTooltip();
  const amounts = points.map(point => Number(point.amount));
  const total = amounts.reduce((sum, value) => sum + value, 0);
  const max = Math.max(1, ...amounts);
  const innerWidth = WIDTH - PADDING.left - PADDING.right;
  const innerHeight = HEIGHT - PADDING.top - PADDING.bottom;
  const step = points.length > 0 ? innerWidth / points.length : innerWidth;
  const barWidth = Math.max(3, Math.min(28, step * 0.6));

  return (
    <ChartCard
      title="Doanh thu ước tính theo ngày"
      description="Tổng thanh toán thành công theo ngày trong kỳ đã chọn."
      testId="chart-revenue"
      isEmpty={points.length === 0 || total === 0}
      footnote="Giá trị là ước tính, chưa trừ hoàn tiền và không phải số liệu kế toán."
    >
      <div className="dashboard-chart-tooltip-host" ref={hostRef}>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Biểu đồ doanh thu ước tính theo ngày"
        preserveAspectRatio="xMidYMid meet"
      >
        <title>Doanh thu ước tính theo ngày</title>
        {[0, 0.5, 1].map(ratio => {
          const y = PADDING.top + innerHeight - ratio * innerHeight;
          return (
            <g key={ratio}>
              <line x1={PADDING.left} x2={WIDTH - PADDING.right} y1={y} y2={y} className="chart-grid-line" />
              <text x={PADDING.left - 8} y={y + 4} textAnchor="end" className="chart-axis-label">
                {formatCompact(max * ratio)}
              </text>
            </g>
          );
        })}

        {points.map((point, index) => {
          const amount = Number(point.amount);
          const height = (amount / max) * innerHeight;
          const x = PADDING.left + step * index + (step - barWidth) / 2;
          const y = PADDING.top + innerHeight - height;
          return (
            <rect
              key={point.date}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(amount > 0 ? 2 : 0, height)}
              rx={3}
              className="chart-revenue-bar"
              onMouseMove={event => showTooltip(event, {
                title: formatShortDate(point.date),
                rows: [{
                  label: 'Doanh thu ước tính',
                  value: `${Number(point.amount).toLocaleString('vi-VN')} VNĐ`,
                  color: 'var(--color-brand)',
                }],
              })}
              onMouseLeave={hideTooltip}
            />
          );
        })}

        {points.length > 0 && (
          <>
            <text x={PADDING.left} y={HEIGHT - 10} className="chart-axis-label" textAnchor="start">
              {formatShortDate(points[0].date)}
            </text>
            {points.length > 1 && (
              <text x={WIDTH - PADDING.right} y={HEIGHT - 10} className="chart-axis-label" textAnchor="end">
                {formatShortDate(points[points.length - 1].date)}
              </text>
            )}
          </>
        )}
      </svg>
      <ChartTooltip tooltip={tooltip} />
      </div>
    </ChartCard>
  );
};
