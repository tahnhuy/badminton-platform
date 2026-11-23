import React from 'react';
import { ChartCard } from './ChartCard';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';
import type { RevenueChartPoint } from '../types/dashboard';

interface RevenueChartProps {
  points: RevenueChartPoint[];
}

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
  const data = points.map(point => ({ ...point, amount: Number(point.amount) }));
  const total = data.reduce((sum, point) => sum + point.amount, 0);
  return (
    <ChartCard
      title="Doanh thu ước tính theo ngày"
      description="Tổng thanh toán thành công theo ngày trong kỳ đã chọn."
      testId="chart-revenue"
      isEmpty={points.length === 0 || total === 0}
      footnote="Giá trị là ước tính, chưa trừ hoàn tiền và không phải số liệu kế toán."
    >
      <div className="h-60 w-full min-w-0" role="img" aria-label="Biểu đồ doanh thu ước tính theo ngày">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart data={data} margin={{ top: 20, right: 20, bottom: 8, left: 8 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
            <YAxis domain={[0, 'dataMax']} tickFormatter={formatCompact} tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }} />
            <Tooltip labelFormatter={value => formatShortDate(String(value))} formatter={value => [`${Number(value).toLocaleString('vi-VN')} VNĐ`, 'Doanh thu ước tính']} />
            <Bar dataKey="amount" fill="var(--primary)" maxBarSize={28} radius={[3, 3, 0, 0]} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartCard>
  );
};
