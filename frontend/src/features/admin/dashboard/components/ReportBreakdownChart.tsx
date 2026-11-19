import React from 'react';
import { ChartCard } from './ChartCard';
import { ChartTooltip, useChartTooltip } from './ChartTooltip';
import { REASON_LABELS } from '../../reports/types/report';
import type { ReportBreakdownPoint } from '../types/dashboard';

interface ReportBreakdownChartProps {
  items: ReportBreakdownPoint[];
}

export const ReportBreakdownChart: React.FC<ReportBreakdownChartProps> = ({ items }) => {
  const { hostRef, tooltip, showTooltip, hideTooltip } = useChartTooltip();
  const max = Math.max(1, ...items.map(item => item.open + item.resolved));

  return (
    <ChartCard
      title="Báo cáo theo loại"
      description="Tỷ lệ báo cáo đã xử lý và còn mở theo lý do."
      testId="chart-report-breakdown"
      isEmpty={items.length === 0}
      footnote="Chỉ tính báo cáo được tạo trong khoảng thời gian đã chọn."
    >
      <div className="dashboard-chart-tooltip-host" ref={hostRef}>
      <ul className="dashboard-bar-list">
        {items.map(item => {
          const total = item.open + item.resolved;
          const width = Math.max(4, (total / max) * 100);
          const openRatio = total > 0 ? item.open / total : 0;
          return (
            <li key={item.reasonCode} className="dashboard-bar-row">
              <div className="dashboard-bar-meta">
                <span>{REASON_LABELS[item.reasonCode] ?? item.reasonCode}</span>
                <strong>{total.toLocaleString('vi-VN')}</strong>
              </div>
              <div className="dashboard-bar-track" style={{ width: `${width}%` }}>
                {item.open > 0 && (
                  <span
                    className="dashboard-bar-fill danger"
                    style={{ width: `${openRatio * 100}%` }}
                    onMouseMove={event => showTooltip(event, {
                      title: REASON_LABELS[item.reasonCode] ?? item.reasonCode,
                      rows: [{ label: 'Đang mở', value: String(item.open), color: 'var(--color-danger)' }],
                    })}
                    onMouseLeave={hideTooltip}
                  />
                )}
                {item.resolved > 0 && (
                  <span
                    className="dashboard-bar-fill success"
                    style={{ width: `${(1 - openRatio) * 100}%` }}
                    onMouseMove={event => showTooltip(event, {
                      title: REASON_LABELS[item.reasonCode] ?? item.reasonCode,
                      rows: [{ label: 'Đã xử lý', value: String(item.resolved), color: 'var(--color-brand)' }],
                    })}
                    onMouseLeave={hideTooltip}
                  />
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <ChartTooltip tooltip={tooltip} />
      </div>
      <div className="dashboard-chart-legend dashboard-report-legend">
        <span><i className="legend-dot open" />Đang mở</span>
        <span><i className="legend-dot resolved" />Đã xử lý</span>
      </div>
    </ChartCard>
  );
};
