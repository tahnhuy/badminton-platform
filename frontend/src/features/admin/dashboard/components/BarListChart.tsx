import { chartWidth } from './chart-style';
import React from 'react';
import { ChartTooltip, useChartTooltip } from './ChartTooltip';

export interface BarListItem {
  label: string;
  value: number;
  tone?: 'success' | 'info' | 'warning' | 'danger' | 'default';
  detail?: string;
}

interface BarListChartProps {
  items: BarListItem[];
  formatValue?: (value: number) => string;
}

export const BarListChart: React.FC<BarListChartProps> = ({ items, formatValue = value => value.toLocaleString('vi-VN') }) => {
  const { hostRef, tooltip, showTooltip, hideTooltip } = useChartTooltip();
  const max = Math.max(1, ...items.map(item => item.value));

  return (
    <div className="dashboard-chart-tooltip-host relative" ref={hostRef}>
    <ul className="dashboard-bar-list m-0 flex list-none flex-col gap-3 p-0">
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`} className="dashboard-bar-row flex cursor-default flex-col gap-1.5">
          <div className="dashboard-bar-meta flex items-baseline justify-between gap-3 text-sm text-muted-foreground [&_strong]:text-sm [&_strong]:text-foreground [&_strong]:whitespace-nowrap [&_em]:ml-1 [&_em]:text-xs [&_em]:font-medium [&_em]:not-italic">
            <span>{item.label}</span>
            <strong>
              {formatValue(item.value)}
              {item.detail ? <em>{item.detail}</em> : null}
            </strong>
          </div>
          <div className="dashboard-bar-track flex h-2.5 overflow-hidden rounded-full bg-muted">
            <span
              className={`dashboard-bar-fill block h-full rounded-full bg-muted-foreground transition-[width] [&.success]:bg-primary [&.info]:bg-info [&.warning]:bg-caution [&.danger]:bg-destructive ${item.tone ?? 'default'}`}
              style={chartWidth(Math.max(3, (item.value / max) * 100))}
              onMouseMove={item.value > 0
                ? event => showTooltip(event, {
                  title: item.label,
                  rows: [{ label: 'Số lượng', value: formatValue(item.value) }],
                })
                : undefined}
              onMouseLeave={item.value > 0 ? hideTooltip : undefined}
            />
          </div>
        </li>
      ))}
    </ul>
    <ChartTooltip tooltip={tooltip} />
    </div>
  );
};
