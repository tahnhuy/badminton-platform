import { chartWidth } from './chart-style';
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
      <div className="dashboard-chart-tooltip-host relative" ref={hostRef}>
      <ul className="dashboard-bar-list m-0 flex list-none flex-col gap-3 p-0">
        {items.map(item => {
          const total = item.open + item.resolved;
          const width = Math.max(4, (total / max) * 100);
          const openRatio = total > 0 ? item.open / total : 0;
          return (
            <li key={item.reasonCode} className="dashboard-bar-row flex cursor-default flex-col gap-1.5">
              <div className="dashboard-bar-meta flex items-baseline justify-between gap-3 text-sm text-muted-foreground [&_strong]:text-sm [&_strong]:text-foreground [&_strong]:whitespace-nowrap [&_em]:ml-1 [&_em]:text-xs [&_em]:font-medium [&_em]:not-italic">
                <span>{REASON_LABELS[item.reasonCode] ?? item.reasonCode}</span>
                <strong>{total.toLocaleString('vi-VN')}</strong>
              </div>
              <div className="dashboard-bar-track flex h-2.5 overflow-hidden rounded-full bg-muted" style={chartWidth(width)}>
                {item.open > 0 && (
                  <span
                    className="dashboard-bar-fill block h-full rounded-full bg-muted-foreground transition-[width] [&.success]:bg-primary [&.info]:bg-info [&.warning]:bg-caution [&.danger]:bg-destructive danger"
                    style={chartWidth(openRatio * 100)}
                    onMouseMove={event => showTooltip(event, {
                      title: REASON_LABELS[item.reasonCode] ?? item.reasonCode,
                      rows: [{ label: 'Đang mở', value: String(item.open), color: 'var(--color-danger)' }],
                    })}
                    onMouseLeave={hideTooltip}
                  />
                )}
                {item.resolved > 0 && (
                  <span
                    className="dashboard-bar-fill block h-full rounded-full bg-muted-foreground transition-[width] [&.success]:bg-primary [&.info]:bg-info [&.warning]:bg-caution [&.danger]:bg-destructive success"
                    style={chartWidth((1 - openRatio) * 100)}
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
      <div className="dashboard-chart-legend flex flex-wrap gap-3.5 text-xs font-semibold text-muted-foreground [&_span]:inline-flex [&_span]:items-center [&_span]:gap-1.5 dashboard-report-legend mt-3 justify-end">
        <span><i className="legend-dot inline-block size-2.5 rounded-full [&.users]:bg-primary [&.bookings]:bg-info [&.open]:bg-destructive [&.resolved]:bg-primary open" />Đang mở</span>
        <span><i className="legend-dot inline-block size-2.5 rounded-full [&.users]:bg-primary [&.bookings]:bg-info [&.open]:bg-destructive [&.resolved]:bg-primary resolved" />Đã xử lý</span>
      </div>
    </ChartCard>
  );
};
