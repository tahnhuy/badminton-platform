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
    <div className="dashboard-chart-tooltip-host" ref={hostRef}>
    <ul className="dashboard-bar-list">
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`} className="dashboard-bar-row">
          <div className="dashboard-bar-meta">
            <span>{item.label}</span>
            <strong>
              {formatValue(item.value)}
              {item.detail ? <em>{item.detail}</em> : null}
            </strong>
          </div>
          <div className="dashboard-bar-track">
            <span
              className={`dashboard-bar-fill ${item.tone ?? 'default'}`}
              style={{ width: `${Math.max(3, (item.value / max) * 100)}%` }}
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
